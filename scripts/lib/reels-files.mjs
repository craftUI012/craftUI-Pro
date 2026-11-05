// The video files Studio writes and how they're cleared. Used by
// `pnpm reels:clean` and, before every render, by Studio (7 days).

import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

/** Folder → which of its entries are video files (never .gitkeep). */
export const REEL_FOLDERS = {
  "reels/benchmarks": () => true,
  "reels/out": () => true,
  "reels/specs": (name) => name.endsWith(".json"),
};

/**
 * Deletes video files; with `olderThanDays` > 0, only those last changed
 * before then. Returns how many entries went.
 */
export const pruneReels = async (olderThanDays = 0) => {
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [folder, keep] of Object.entries(REEL_FOLDERS)) {
    const dir = path.join(ROOT, folder);
    let names = [];
    try {
      names = await readdir(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name === ".gitkeep" || !keep(name)) {
        continue;
      }
      const full = path.join(dir, name);
      if (olderThanDays > 0) {
        const info = await stat(full);
        if (info.mtimeMs > cutoff) {
          continue;
        }
      }
      await rm(full, { force: true, recursive: true });
      removed += 1;
    }
  }
  return removed;
};
