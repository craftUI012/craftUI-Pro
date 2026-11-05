"use server";

import { writeFile } from "node:fs/promises";

import { z } from "zod";

import { requireAdmin } from "@/lib/admin/session";
import { showReels } from "@/lib/flags";
import { direct } from "@/lib/studio/director";
import type { DirectResult } from "@/lib/studio/director";
import {
  emptyMediaFolder,
  MEDIA_FOLDERS,
  readMediaFolders,
} from "@/lib/studio/local-media";
import type { MediaFolderId, MediaFolderInfo } from "@/lib/studio/local-media";
import {
  AUDIENCES,
  GROUNDS,
  HOOK_STYLES,
  LENGTHS,
  VIDEO_TYPES,
} from "@/lib/studio/options";
import { repoPath } from "@/lib/studio/paths";
import {
  anyRenderRunning,
  getRenderJob,
  startRender,
} from "@/lib/studio/render-jobs";
import type { RenderJob } from "@/lib/studio/render-jobs";
import { parseSpec } from "@/reels/spec";

// The Studio's actions. Planning reads the repo and calls Claude; nothing is
// filmed or rendered here. Saving writes the storyboard where
// `pnpm video <name>` reads it, so it only works on a dev machine.

const ids = <T extends { id: string | number }>(list: readonly T[]) =>
  list.map((o) => o.id) as [T["id"], ...T["id"][]];

const DirectInputSchema = z.object({
  audience: z.enum(ids(AUDIENCES) as [string, ...string[]]),
  ground: z.enum(ids(GROUNDS) as [string, ...string[]]).default("auto"),
  hook: z.enum(ids(HOOK_STYLES) as [string, ...string[]]),
  instructions: z
    .string()
    .max(2000, "Keep the instructions under 2,000 characters.")
    .default(""),
  item: z.string().regex(/^[a-z0-9-]+$/),
  length: z.union(
    LENGTHS.map((l) => z.literal(l.id)) as [
      z.ZodLiteral<15>,
      z.ZodLiteral<30>,
      z.ZodLiteral<45>,
    ]
  ),
  references: z
    .array(
      z.url({
        message: "Each reference must be a full link (https://…).",
        protocol: /^https?$/,
      })
    )
    .max(3, "Use at most 3 reference videos.")
    .default([]),
  type: z.enum(ids(VIDEO_TYPES) as [string, ...string[]]),
});

export type DirectAnswer =
  | { error: string }
  | { ok: true; result: DirectResult };

export const directVideo = async (input: unknown): Promise<DirectAnswer> => {
  try {
    await requireAdmin();
    const parsed = DirectInputSchema.parse(input) as Parameters<
      typeof direct
    >[0];
    // Reading a reference runs ffmpeg and yt-dlp, which only a dev machine has.
    if ((parsed.references?.length ?? 0) > 0 && !showReels) {
      return {
        error:
          "Reference videos are read with ffmpeg on a dev machine. Remove them, or plan from localhost.",
      };
    }
    return { ok: true, result: await direct(parsed) };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Invalid choices." };
    }
    return {
      error: error instanceof Error ? error.message : "The director failed.",
    };
  }
};

export type SaveAnswer = { error: string } | { ok: true; name: string };

export const saveStoryboard = async (spec: unknown): Promise<SaveAnswer> => {
  try {
    await requireAdmin();
    if (!showReels) {
      return {
        error:
          "Saving storyboards only works on a dev machine (environment=development).",
      };
    }
    const parsed = parseSpec(spec);
    const name = `${parsed.item}-${parsed.type}`;
    await writeFile(
      repoPath("reels/specs", `${name}.json`),
      `${JSON.stringify(parsed, null, 2)}\n`
    );
    return { name, ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't save." };
  }
};

export type RenderAnswer = { error: string } | { ok: true; job: RenderJob };

const SPEC_NAME = /^[a-z0-9-]+$/;

/** Saves the storyboard and starts rendering it (dev machine only). */
export const renderVideo = async (spec: unknown): Promise<RenderAnswer> => {
  try {
    await requireAdmin();
    if (!showReels) {
      return {
        error:
          "Rendering only works on a dev machine (environment=development).",
      };
    }
    if (anyRenderRunning()) {
      return { error: "A render is already running. Wait for it to finish." };
    }
    const parsed = parseSpec(spec);
    const name = `${parsed.item}-${parsed.type}`;
    await writeFile(
      repoPath("reels/specs", `${name}.json`),
      `${JSON.stringify(parsed, null, 2)}\n`
    );
    return { job: startRender(name), ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Couldn't start the render.",
    };
  }
};

export type RenderStatusAnswer =
  | { error: string }
  | { ok: true; job: RenderJob | null };

export const renderStatus = async (
  name: unknown
): Promise<RenderStatusAnswer> => {
  try {
    await requireAdmin();
    const parsed = z.string().regex(SPEC_NAME).parse(name);
    return { job: getRenderJob(parsed), ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Couldn't read the render.",
    };
  }
};

export type ClearAnswer =
  | { error: string }
  | { ok: true; folders: MediaFolderInfo[] };

export const clearMediaFolder = async (id: unknown): Promise<ClearAnswer> => {
  try {
    await requireAdmin();
    if (!showReels) {
      return {
        error:
          "Local video files only exist on a dev machine (environment=development).",
      };
    }
    const folder = z
      .enum(Object.keys(MEDIA_FOLDERS) as [MediaFolderId, ...MediaFolderId[]])
      .parse(id);
    await emptyMediaFolder(folder);
    return { folders: await readMediaFolders(), ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Couldn't delete the files.",
    };
  }
};
