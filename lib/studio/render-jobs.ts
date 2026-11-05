import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

import { repoPath } from "@/lib/studio/paths";

// Renders started from Studio, dev machine only. A render is
// `node scripts/video.mjs <spec>` run as a child of the dev server: it films
// the video page (/reels/video?spec=<spec>) from this same server, frame by
// frame, into reels/out/<spec>.mp4. Jobs live in memory (on globalThis, so they
// survive hot reloads); there is no database: once the video is downloaded
// and the folder emptied, nothing is left.

export type RenderStatus = "running" | "done" | "failed";

export interface RenderJob {
  name: string;
  status: RenderStatus;
  startedAt: number;
  finishedAt?: number;
  /** The last lines the script printed, newest last. */
  log: string[];
  /** The line it is printing now (progress), not yet ended. */
  current: string;
  error?: string;
}

const LOG_LINES = 40;

const store = globalThis as typeof globalThis & {
  __studioRenders?: Map<string, RenderJob>;
};
const jobs = (store.__studioRenders ??= new Map<string, RenderJob>());

export const videoFile = (name: string) => repoPath("reels/out", `${name}.mp4`);

export const getRenderJob = (name: string) => jobs.get(name) ?? null;

export const anyRenderRunning = () =>
  [...jobs.values()].some((job) => job.status === "running");

// Reads the script's output the way a terminal shows it: the filming
// progress is appended to its line ("filming 1s 2s 3s") and the render
// percentage rewrites its line with \r. `current` is the line being written.
const pushOutput = (job: RenderJob, chunk: string) => {
  for (const char of chunk) {
    if (char === "\n") {
      if (job.current.trim()) {
        job.log.push(job.current.trim());
      }
      job.current = "";
    } else if (char === "\r") {
      job.current = "";
    } else {
      job.current += char;
    }
  }
  if (job.log.length > LOG_LINES) {
    job.log.splice(0, job.log.length - LOG_LINES);
  }
};

/** Starts a render; one at a time, since filming needs the whole machine. */
export const startRender = (name: string): RenderJob => {
  const job: RenderJob = {
    current: "",
    log: [],
    name,
    startedAt: Date.now(),
    status: "running",
  };
  jobs.set(name, job);

  const base = `http://localhost:${process.env.PORT ?? 3000}`;
  const child = spawn(
    process.execPath,
    ["scripts/video.mjs", name, "--base", base],
    {
      cwd: repoPath(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  child.stdout.setEncoding("utf-8");
  child.stderr.setEncoding("utf-8");
  child.stdout.on("data", (chunk: string) => pushOutput(job, chunk));
  child.stderr.on("data", (chunk: string) => pushOutput(job, chunk));
  child.on("error", (error) => {
    job.status = "failed";
    job.error = error.message;
    job.finishedAt = Date.now();
  });
  child.on("close", (code) => {
    job.finishedAt = Date.now();
    if (job.current.trim()) {
      job.log.push(job.current.trim());
      job.current = "";
    }
    if (code === 0 && existsSync(videoFile(name))) {
      job.status = "done";
      return;
    }
    job.status = "failed";
    job.error =
      job.log.findLast((line) => /error/i.test(line)) ??
      `The render stopped (exit code ${code}).`;
  });
  return job;
};
