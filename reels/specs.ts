import { readFile } from "node:fs/promises";

import { repoPath } from "@/lib/studio/paths";
import { parseSpec } from "@/reels/spec";
import type { VideoSpec } from "@/reels/spec";

// Storyboards on disk, reels/specs/<name>.json, written by Studio's Save or
// Render. The video page and the render script only ever see a parsed
// VideoSpec.

export const isSpecName = (name: string) => /^[a-z0-9-]+$/.test(name);

export const readSpec = async (name: string): Promise<VideoSpec> => {
  if (!isSpecName(name)) {
    throw new Error(`bad spec name "${name}"`);
  }
  const raw = await readFile(repoPath("reels/specs", `${name}.json`), "utf-8");
  return parseSpec(JSON.parse(raw));
};
