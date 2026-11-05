#!/usr/bin/env node
// Renders a storyboard (reels/specs/<name>.json) to a 1080 × 1920 MP4.
//
//   pnpm video <name> [--base http://localhost:3000] [--stills 2.5,8]
//
// The whole video is one page, /reels/video?spec=<name>: every shot played
// in order on one stageshow Stage (reels/video/reel.tsx). The frame-stepped
// recorder (scripts/lib/film.mjs) films that page at 2x, one frame per
// virtual-clock step, straight to reels/out/<name>.mp4.
//
// --stills  also save PNGs at these seconds, for checking frames
//
// Needs the dev server (pnpm dev) and ffmpeg.

import { execFile } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs, promisify } from "node:util";

import { filmClip } from "./lib/film.mjs";
import { pruneReels } from "./lib/reels-files.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    base: { default: "http://localhost:3000", type: "string" },
    stills: { default: "", type: "string" },
  },
});

const [name] = positionals;
if (!name || !/^[a-z0-9-]+$/.test(name)) {
  console.error(
    "usage: pnpm video <spec-name>   (reels/specs/<spec-name>.json)"
  );
  process.exit(2);
}

const { PAGE, parseSpec } = await import(path.join(ROOT, "reels/spec.ts"));
const spec = parseSpec(
  JSON.parse(readFileSync(path.join(ROOT, `reels/specs/${name}.json`), "utf-8"))
);

const outDir = path.join(ROOT, "reels/out");
mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${name}.mp4`);

const log = (msg) => console.log(`video: ${msg}`);

// Storyboards and renders never pile up: anything older than a week goes.
const pruned = await pruneReels(7);
if (pruned > 0) {
  log(
    `removed ${pruned} storyboard/render file${pruned === 1 ? "" : "s"} older than 7 days`
  );
}
log(`${spec.title} (${spec.type}, ${spec.shots.length} shots, ${spec.fps}fps)`);

const started = Date.now();
process.stdout.write("video: filming");
const { frames, marks } = await filmClip({
  fps: spec.fps,
  height: PAGE.height,
  log: (m) => process.stdout.write(` ${m}`),
  maxSeconds: 120,
  out,
  stills: values.stills.split(",").filter(Boolean).map(Number),
  theme: spec.theme,
  url: `${values.base}/reels/video?spec=${name}`,
  width: PAGE.width,
});
process.stdout.write("\n");

const shots = Object.entries(marks)
  .filter(([mark]) => mark.startsWith("shot-"))
  .map(([mark, frame]) => `${mark.slice(5)}@${(frame / spec.fps).toFixed(1)}s`)
  .join(" ");
log(`shots ${shots}`);
log(
  `${frames} frames (${(frames / spec.fps).toFixed(1)}s) in ${((Date.now() - started) / 1000).toFixed(0)}s`
);
// The feed cut and the covers come from the same render (growth.md): the
// reel keeps everything that matters inside its central 4:5 area.
const ffmpeg = (args) =>
  promisify(execFile)("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const FEED = "crop=1080:1350:0:285";
const base = out.replace(/\.mp4$/, "");
const coverAt = String(Math.min(1.6, frames / spec.fps - 0.1));
await ffmpeg([
  "-i",
  out,
  "-vf",
  FEED,
  "-c:v",
  "libx264",
  "-preset",
  "slow",
  "-crf",
  "16",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  `${base}-4x5.mp4`,
]);
await ffmpeg([
  "-ss",
  coverAt,
  "-i",
  out,
  "-frames:v",
  "1",
  "-q:v",
  "2",
  `${base}-cover.jpg`,
]);
await ffmpeg([
  "-ss",
  coverAt,
  "-i",
  out,
  "-vf",
  FEED,
  "-frames:v",
  "1",
  "-q:v",
  "2",
  `${base}-cover-4x5.jpg`,
]);

log(`done → ${path.relative(ROOT, out)} (+ 4:5 cut, covers)`);
