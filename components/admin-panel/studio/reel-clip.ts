import type {
  ReelBox,
  ReelFormat,
  ReelSceneProps,
  ReelText,
} from "./reel-scene";
import { FORMATS, ReelScene, TEXT_FONT } from "./reel-scene";

// Reading a recording and exporting the reel. Both run in the browser: the
// video never leaves this machine. The heavy parts (Mediabunny, the ProRes
// decoder, Remotion's renderer) load only when they're first needed.

export interface ReelClip {
  codec: string;
  duration: number;
  // Kept for the moment finder, which reads the frames again.
  file: File;
  hasAudio: boolean;
  height: number;
  name: string;
  size: number;
  src: string;
  width: number;
}

const CODEC_LABELS: Record<string, string> = {
  av1: "AV1",
  avc: "H.264",
  hevc: "HEVC",
  prores: "ProRes",
  vp8: "VP8",
  vp9: "VP9",
};

export const codecLabel = (codec: string) =>
  CODEC_LABELS[codec] ?? codec.toUpperCase();

// Browsers can't decode ProRes, so Mediabunny's WebAssembly decoder is
// registered the first time a ProRes file comes in. It's shared with
// Remotion (one copy of mediabunny), so the preview and export use it too.
let proresReady = false;
const enableProres = async () => {
  if (proresReady) {
    return;
  }
  const { registerProresDecoder } = await import("@mediabunny/prores");
  registerProresDecoder();
  proresReady = true;
};

export const readClip = async (file: File): Promise<ReelClip> => {
  const { ALL_FORMATS, BlobSource, Input } = await import("mediabunny");
  const input = new Input({
    formats: ALL_FORMATS,
    source: new BlobSource(file),
  });
  try {
    const video = await input.getPrimaryVideoTrack().catch(() => {
      throw new Error(
        "Couldn't read this file. Use a video: .mov, .mp4 or .webm."
      );
    });
    if (!video) {
      throw new Error("This file has no video in it.");
    }
    if (video.codec === "prores") {
      await enableProres();
    }
    if (!(video.codec && (await video.canDecode()))) {
      const kind = video.codec ? `${codecLabel(video.codec)} video` : "it";
      throw new Error(
        `This browser can't play ${kind}. Export the recording as an H.264 MP4 and try again.`
      );
    }
    const [duration, audio] = await Promise.all([
      input.computeDuration(),
      input.getPrimaryAudioTrack(),
    ]);
    return {
      codec: video.codec,
      duration,
      file,
      hasAudio: audio !== null,
      height: video.displayHeight,
      name: file.name,
      size: file.size,
      src: URL.createObjectURL(file),
      width: video.displayWidth,
    };
  } finally {
    input.dispose();
  }
};

// A background image, read in the browser like the clip. Browsers open
// PNG, JPEG, WebP, AVIF and GIF (the first frame); HEIC needs converting.
export interface ReelImage {
  height: number;
  name: string;
  size: number;
  src: string;
  width: number;
}

export const readImage = async (file: File): Promise<ReelImage> => {
  const src = URL.createObjectURL(file);
  const image = new Image();
  image.src = src;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(src);
    throw new Error(
      "This browser can't open this image. Use a PNG, JPG or WebP."
    );
  }
  return {
    height: image.naturalHeight,
    name: file.name,
    size: file.size,
    src,
    width: image.naturalWidth,
  };
};

// Where a clip lands in a frame: as wide as the frame less a margin,
// centred. A clip too tall for that (a phone recording, or any screen
// recording in a 16:9 frame) is fitted by height instead.
const MARGIN = 60;
export const fitBox = (
  clip: Pick<ReelClip, "height" | "width">,
  format: ReelFormat
): ReelBox => {
  const frame = FORMATS[format];
  const aspect = clip.width / clip.height;
  let w = frame.width - MARGIN * 2;
  let h = w / aspect;
  if (h > frame.height - MARGIN * 2) {
    h = frame.height - MARGIN * 2;
    w = h * aspect;
  }
  return {
    h: Math.round(h),
    w: Math.round(w),
    x: Math.round((frame.width - w) / 2),
    y: Math.round((frame.height - h) / 2),
  };
};

export const framesFor = (duration: number, fps: number) =>
  Math.max(1, Math.floor(duration * fps));

// The renderer draws text with the page's fonts, so make sure Inter's
// weights are loaded (not just declared) before it starts.
const loadTextFonts = async (texts: ReelText[]) => {
  const probe = document.createElement("span");
  probe.style.fontFamily = TEXT_FONT;
  document.body.append(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  const sample = texts.map((item) => item.text).join("");
  await Promise.all(
    [...new Set(texts.map((item) => item.weight))].map((weight) =>
      document.fonts.load(`${weight} 64px ${family}`, sample)
    )
  );
};

export const exportReel = async ({
  fps,
  onProgress,
  props,
  signal,
}: {
  fps: number;
  onProgress: (progress: number) => void;
  props: ReelSceneProps & { duration: number };
  signal: AbortSignal;
}) => {
  const { renderMediaOnWeb } = await import("@remotion/web-renderer");
  const { duration, ...inputProps } = props;
  // No audio track at all only when nothing in the reel makes a sound.
  const muted =
    (inputProps.muted || inputProps.clipVolume === 0) &&
    inputProps.cues.length === 0 &&
    inputProps.music === null;
  if (inputProps.texts.length > 0) {
    await loadTextFonts(inputProps.texts);
  }
  const frame = FORMATS[inputProps.format];
  const { getBlob } = await renderMediaOnWeb({
    composition: {
      component: ReelScene,
      defaultProps: inputProps,
      durationInFrames: framesFor(duration, fps),
      fps,
      height: frame.height,
      id: "reel",
      width: frame.width,
    },
    inputProps,
    // craftUI is under Remotion's free-licence headcount (3 people or
    // fewer). Above that it needs a company licence: remotion.dev/license.
    licenseKey: "free-license",
    muted,
    onProgress: (progress) => onProgress(progress.progress),
    signal,
    videoBitrate: "very-high",
  });
  const blob = await getBlob();
  if (muted) {
    return blob;
  }
  // Undo the AAC encoder's priming delay (reel-audio-sync.ts).
  const { audioLead, shiftAudio } = await import("./reel-audio-sync");
  const lead = await audioLead();
  return lead > 0 ? shiftAudio(blob, lead) : blob;
};

const pad = (value: number) => String(value).padStart(2, "0");

// reel-2026-11-11-1430.mp4, or reel-2026-11-11-1430-16x9.mp4 for 16:9.
export const reelFileName = (format: ReelFormat, date = new Date()) =>
  `reel-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${format === "16:9" ? "-16x9" : ""}.mp4`;

export const saveBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const formatTime = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${pad(whole % 60)}`;
};

export const formatBytes = (bytes: number) =>
  bytes >= 1_000_000
    ? `${(bytes / 1_000_000).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1000))} KB`;
