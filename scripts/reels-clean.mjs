#!/usr/bin/env node
// Clears the video files Studio leaves on this machine, so they never pile
// up: storyboards (reels/specs/*.json), renders and stills (reels/out) and
// benchmark downloads (reels/benchmarks). Nothing here is committed.
//
//   pnpm reels:clean               everything
//   pnpm reels:clean --older 7     only files older than 7 days
//
// Studio runs the same pruning (7 days) before every render.

import { parseArgs } from "node:util";

import { pruneReels } from "./lib/reels-files.mjs";

const { values } = parseArgs({
  options: { older: { default: "0", type: "string" } },
});

const days = Number(values.older);
const removed = await pruneReels(Number.isFinite(days) ? days : 0);
console.log(
  `reels: removed ${removed} file${removed === 1 ? "" : "s"}${days > 0 ? ` older than ${days} days` : ""}`
);
