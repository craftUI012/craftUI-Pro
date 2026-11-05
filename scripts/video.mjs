#!/usr/bin/env node
// Renders a storyboard (reels/specs/<name>.json) to a 1080 x 1920 MP4.
//
//   pnpm video <name> [--base http://localhost:3000] [--reuse] [--stills 1:2.5,3:4]
//
// 1. Films each live shot from /reels/shot?spec=<name>&shot=<i> with the
//    frame-stepped recorder (scripts/lib/film.mjs).
// 2. Highlights code shots with shiki.
// 3. Composes everything in Remotion (reels/remotion) and renders it.
//
// --reuse   skip filming when a shot's clip already exists (compose only)
// --stills  save PNGs of live shots at <shot>:<seconds>, for checking frames
//
// Needs the dev server (pnpm dev) for the live shots, and ffmpeg.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { bundle } from "@remotion/bundler";
import {
  ensureBrowser,
  renderMedia,
  selectComposition,
} from "@remotion/renderer";
import { codeToTokens } from "shiki";

import { filmClip } from "./lib/film.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

// The scenes (the shot page and the composition) were deleted on 2026-11-04
// to be rebuilt from the polished video-director skill. Until they exist
// again there is nothing to film or compose.
if (!existsSync(path.join(ROOT, "reels/remotion/index.ts"))) {
  console.error(
    "video: no video scenes yet. They were removed to be rebuilt from the video-director skill (.agents/skills/video-director)."
  );
  process.exit(1);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    base: { default: "http://localhost:3000", type: "string" },
    reuse: { default: false, type: "boolean" },
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

const { CLIP, parseSpec } = await import(path.join(ROOT, "reels/spec.ts"));
const spec = parseSpec(
  JSON.parse(readFileSync(path.join(ROOT, `reels/specs/${name}.json`), "utf-8"))
);

const work = path.join(ROOT, "reels/out", name);
mkdirSync(work, { recursive: true });
const out = path.join(ROOT, "reels/out", `${name}.mp4`);

const stills = {};
for (const pair of values.stills.split(",").filter(Boolean)) {
  const [shot, secs] = pair.split(":");
  (stills[shot] ??= []).push(Number(secs));
}

const log = (msg) => console.log(`video: ${msg}`);
log(`${spec.title} (${spec.type}, ${spec.shots.length} shots, ${spec.fps}fps)`);

// 1. Live shots ---------------------------------------------------------------
const clips = {};
const metaFile = path.join(work, "clips.json");
const known = existsSync(metaFile)
  ? JSON.parse(readFileSync(metaFile, "utf-8"))
  : {};
for (const [i, shot] of spec.shots.entries()) {
  if (shot.kind !== "live") {
    continue;
  }
  const src = `shot-${i}.mp4`;
  const file = path.join(work, src);
  if (values.reuse && existsSync(file) && known[i]) {
    clips[i] = known[i];
    log(`shot ${i}: reusing ${src}`);
    continue;
  }
  const size = CLIP[shot.frame];
  const started = Date.now();
  process.stdout.write(`video: shot ${i} (live, ${shot.frame}) filming`);
  const { frames, marks } = await filmClip({
    fps: spec.fps,
    height: size.height,
    log: (m) => process.stdout.write(` ${m}`),
    out: file,
    stills: stills[i] ?? [],
    theme: shot.theme ?? spec.theme,
    url: `${values.base}/reels/shot?spec=${name}&shot=${i}`,
    width: size.width,
  });
  process.stdout.write(`\n`);
  clips[i] = { frames, marks, src };
  log(
    `shot ${i}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`
  );
}
writeFileSync(metaFile, JSON.stringify(clips, null, 2));

// 2. Code ---------------------------------------------------------------------
const code = {};
for (const [i, shot] of spec.shots.entries()) {
  if (shot.kind !== "code") {
    continue;
  }
  const { tokens } = await codeToTokens(shot.code, {
    lang: shot.lang,
    theme:
      spec.theme === "dark" ? "github-dark-default" : "github-light-default",
  });
  code[i] = tokens.map((line) =>
    line.map((t) => ({ color: t.color, content: t.content }))
  );
}

// 3. Compose ------------------------------------------------------------------
copyFileSync(
  path.join(ROOT, "public/logo/logo-mark-256.png"),
  path.join(work, "logo-mark.png")
);

log("bundling the composition");
const serveUrl = await bundle({
  entryPoint: path.join(ROOT, "reels/remotion/index.ts"),
  publicDir: work,
  webpackOverride: (config) => ({
    ...config,
    resolve: {
      ...config.resolve,
      alias: { ...config.resolve?.alias, "@": ROOT },
    },
  }),
});

const inputProps = { clips, code, spec };
// Its own port: Remotion's default (3000) is where Next's dev server runs.
const port = 3456;
// Remotion's own chrome-headless-shell (downloaded once into
// node_modules/.remotion): desktop Chrome crashes under parallel rendering.
await ensureBrowser();
const composition = await selectComposition({
  id: "Reel",
  inputProps,
  port,
  serveUrl,
});

log(
  `rendering ${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(1)}s)`
);
let lastShown = -1;
await renderMedia({
  codec: "h264",
  colorSpace: "bt709",
  composition,
  crf: 16,
  inputProps,
  onProgress: ({ progress }) => {
    const pct = Math.floor(progress * 10) * 10;
    if (pct !== lastShown) {
      lastShown = pct;
      process.stdout.write(`\rvideo: rendering ${pct}%`);
    }
  },
  outputLocation: out,
  pixelFormat: "yuv420p",
  port,
  serveUrl,
});
process.stdout.write("\n");
log(`done → ${path.relative(ROOT, out)}`);
