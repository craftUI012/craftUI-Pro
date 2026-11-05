import { readFile } from "node:fs/promises";
import path from "node:path";

import { parseSpec } from "@/reels/spec";
import type { VideoSpec } from "@/reels/spec";

// Storyboards on disk, reels/specs/<name>.json. The admin dashboard will
// keep them in MongoDB instead; the shooter and composer only ever see a
// parsed VideoSpec, wherever it came from.

const DIR = path.join(process.cwd(), "reels/specs");

export const isSpecName = (name: string) => /^[a-z0-9-]+$/.test(name);

export const readSpec = async (name: string): Promise<VideoSpec> => {
  if (!isSpecName(name)) {
    throw new Error(`bad spec name "${name}"`);
  }
  const raw = await readFile(path.join(DIR, `${name}.json`), "utf-8");
  return parseSpec(JSON.parse(raw));
};
