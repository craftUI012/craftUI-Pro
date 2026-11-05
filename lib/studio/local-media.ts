import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { repoPath } from "@/lib/studio/paths";

// Video files the Studio leaves on a dev machine: downloaded benchmark
// videos and our renders. Both folders are ignored by git; nothing here is
// kept anywhere else, so emptying a folder deletes its files for good.
// Benchmark breakdowns and scores are text in the video-director skill and
// are never touched.

export const MEDIA_FOLDERS = {
  benchmarks: { dir: "reels/benchmarks", label: "Benchmark videos" },
  renders: { dir: "reels/out", label: "Renders and stills" },
  storyboards: { dir: "reels/specs", label: "Storyboards" },
} as const;

/** Files that keep a folder in git; never counted or deleted. */
const KEEP = new Set([".gitkeep"]);

export type MediaFolderId = keyof typeof MEDIA_FOLDERS;

export interface MediaFolderInfo {
  bytes: number;
  dir: string;
  files: number;
  id: MediaFolderId;
  label: string;
  /** Finished videos at the folder's top level (renders), newest first. */
  videos: { name: string; bytes: number }[];
}

const absolute = (id: MediaFolderId) => repoPath(MEDIA_FOLDERS[id].dir);

const walk = async (dir: string): Promise<{ bytes: number; files: number }> => {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return { bytes: 0, files: 0 };
  }
  let bytes = 0;
  let files = 0;
  for (const entry of entries) {
    if (KEEP.has(entry.name)) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = await walk(full);
      bytes += sub.bytes;
      files += sub.files;
    } else if (entry.isFile()) {
      const info = await stat(full);
      bytes += info.size;
      files += 1;
    }
  }
  return { bytes, files };
};

const MP4 = /\.mp4$/;

const topVideos = async (id: MediaFolderId) => {
  if (id !== "renders") {
    return [];
  }
  const dir = absolute(id);
  let names: string[];
  try {
    const all = await readdir(dir);
    names = all.filter((n) => MP4.test(n));
  } catch {
    return [];
  }
  const videos = await Promise.all(
    names.map(async (file) => {
      const info = await stat(path.join(dir, file));
      return {
        bytes: info.size,
        modified: info.mtimeMs,
        name: file.replace(MP4, ""),
      };
    })
  );
  return videos
    .toSorted((a, b) => b.modified - a.modified)
    .map(({ bytes, name }) => ({ bytes, name }));
};

export const readMediaFolders = (): Promise<MediaFolderInfo[]> =>
  Promise.all(
    (Object.keys(MEDIA_FOLDERS) as MediaFolderId[]).map(async (id) => ({
      ...(await walk(absolute(id))),
      dir: MEDIA_FOLDERS[id].dir,
      id,
      label: MEDIA_FOLDERS[id].label,
      videos: await topVideos(id),
    }))
  );

/** Deletes everything inside the folder and keeps the folder itself. */
export const emptyMediaFolder = async (id: MediaFolderId) => {
  const dir = absolute(id);
  let entries: string[];
  try {
    const names = await readdir(dir);
    entries = names.filter((name) => !KEEP.has(name));
  } catch {
    return;
  }
  await Promise.all(
    entries.map((name) =>
      rm(path.join(dir, name), { force: true, recursive: true })
    )
  );
};
