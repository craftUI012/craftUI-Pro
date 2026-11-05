import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Reads a reference video for the director, frame by frame, without saving
// it anywhere. A page link (Instagram, YouTube, TikTok…) is resolved to its
// media stream with yt-dlp (`-g` prints the URL, it downloads nothing);
// ffmpeg then reads that stream once and, in the same pass, finds the scene
// cuts and samples about one frame a second as small JPEGs kept in memory.
// Needs ffmpeg, ffprobe and yt-dlp on the machine, so dev only.

export interface ReferenceFrame {
  /** Seconds from the start. */
  t: number;
  /** Base64 JPEG, about 360px wide. */
  jpeg: string;
}

export interface ReferenceAnalysis {
  url: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
  /** Seconds where the picture cuts to a new shot. */
  cuts: number[];
  frames: ReferenceFrame[];
}

/** What the admin sees: the analysis without the images. */
export interface ReferenceSummary {
  url: string;
  duration: number;
  width: number;
  height: number;
  cuts: number[];
  frames: number;
}

const MAX_SECONDS = 120;
const MAX_FRAMES = 30;
const SCENE_THRESHOLD = 0.1;
const TIMEOUT_MS = 90_000;
const MEDIA_FILE = /\.(?:mp4|m4v|mov|webm|m3u8)(?:$|\?)/i;
const CUT = /pts_time:([\d.]+)/g;
const JPEG_START = Buffer.from([0xFF, 0xD8, 0xFF]);

const exec = promisify(execFile);

const installHint = (command: string) =>
  command === "yt-dlp" ? "brew install yt-dlp" : "brew install ffmpeg";

/** Runs a tool and returns its output as buffers, with a readable error. */
const run = async (command: string, args: string[]) => {
  try {
    const { stderr, stdout } = await exec(command, args, {
      encoding: "buffer",
      killSignal: "SIGKILL",
      maxBuffer: 64 * 1024 * 1024,
      timeout: TIMEOUT_MS,
    });
    return { stderr: stderr.toString("utf-8"), stdout };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      killed?: boolean;
      stderr?: Buffer;
    };
    if (failure.code === "ENOENT") {
      throw new Error(
        `${command} isn't installed. Reference videos need it on this machine (${installHint(command)}).`,
        { cause: error }
      );
    }
    if (failure.killed) {
      throw new Error(`${command} took longer than ${TIMEOUT_MS / 1000}s.`, {
        cause: error,
      });
    }
    const last = failure.stderr?.toString("utf-8").trim().split("\n").at(-1);
    throw new Error(`${command} failed: ${last || failure.message}`, {
      cause: error,
    });
  }
};

/** The media stream behind a link; a direct file link is used as it is. */
const streamUrl = async (url: string) => {
  if (MEDIA_FILE.test(new URL(url).pathname)) {
    return url;
  }
  // A post with several items (an Instagram carousel) prints one URL per
  // video and fails on the image slides; the URLs it printed still count.
  let stdout: Buffer;
  try {
    ({ stdout } = await run("yt-dlp", [
      "--quiet",
      "--no-warnings",
      "--ignore-errors",
      "--get-url",
      "--format",
      "bv*[ext=mp4]/bv*/b",
      url,
    ]));
  } catch (error) {
    const printed = (error as { cause?: { stdout?: Buffer } }).cause?.stdout;
    if (!printed?.length) {
      throw error;
    }
    stdout = printed;
  }
  // A post with several items prints one URL each; the first video wins.
  const first = stdout
    .toString("utf-8")
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("http"));
  if (!first) {
    throw new Error(`No video found at ${url}.`);
  }
  return first;
};

const probe = async (media: string) => {
  const { stdout } = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate:format=duration",
    "-of",
    "json",
    media,
  ]);
  const info = JSON.parse(stdout.toString("utf-8")) as {
    format?: { duration?: string };
    streams?: { width?: number; height?: number; r_frame_rate?: string }[];
  };
  const stream = info.streams?.[0];
  const [num, den] = (stream?.r_frame_rate ?? "0/1").split("/").map(Number);
  return {
    duration: Number(info.format?.duration ?? 0),
    fps: den ? Math.round((num / den) * 100) / 100 : 0,
    height: stream?.height ?? 0,
    width: stream?.width ?? 0,
  };
};

/** Splits concatenated JPEGs (ffmpeg's image2pipe) into single images. */
const splitJpegs = (data: Buffer) => {
  const starts: number[] = [];
  let at = data.indexOf(JPEG_START);
  while (at !== -1) {
    starts.push(at);
    at = data.indexOf(JPEG_START, at + JPEG_START.length);
  }
  return starts.map((start, i) => data.subarray(start, starts[i + 1]));
};

export const analyzeReference = async (
  url: string
): Promise<ReferenceAnalysis> => {
  const media = await streamUrl(url);
  const meta = await probe(media);
  const seconds = Math.min(meta.duration || MAX_SECONDS, MAX_SECONDS);
  // About one frame a second, fewer for long videos.
  const rate = Math.min(1, MAX_FRAMES / Math.max(seconds, 1));

  const { stdout, stderr } = await run("ffmpeg", [
    "-v",
    "info",
    "-t",
    String(seconds),
    "-i",
    media,
    "-filter_complex",
    `[0:v]split=2[a][b];[a]select='gt(scene,${SCENE_THRESHOLD})',showinfo[s];[b]fps=${rate},scale='if(gt(iw,ih),480,360)':-2[f]`,
    "-map",
    "[s]",
    "-f",
    "null",
    "-",
    "-map",
    "[f]",
    "-c:v",
    "mjpeg",
    "-q:v",
    "5",
    "-f",
    "image2pipe",
    "-",
  ]);

  const cuts = [...stderr.matchAll(CUT)].map(
    (m) => Math.round(Number(m[1]) * 100) / 100
  );
  const frames = splitJpegs(stdout)
    .slice(0, MAX_FRAMES)
    .map((jpeg, i) => ({
      jpeg: jpeg.toString("base64"),
      t: Math.round((i / rate) * 10) / 10,
    }));
  if (frames.length === 0) {
    throw new Error(`ffmpeg read no frames from ${url}.`);
  }
  return { ...meta, cuts, frames, url };
};

export const summarize = (r: ReferenceAnalysis): ReferenceSummary => ({
  cuts: r.cuts,
  duration: r.duration,
  frames: r.frames.length,
  height: r.height,
  url: r.url,
  width: r.width,
});
