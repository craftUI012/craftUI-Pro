/* oxlint-disable no-magic-numbers */

import { z } from "zod";

// The storyboard: one JSON document describes a whole video. The director
// (Claude + per-type rules) writes it, the admin dashboard edits it, the
// clip shooter films its live shots and Remotion composes everything.
// Nothing here is component-specific code: a new component needs a new
// spec, never a new scene file.

/** Where a beat acts inside the live component's preview page.
 *  `aria:Next testimonial` → [aria-label="Next testimonial"]
 *  `text:Get started`      → the first button or link with that text
 *  `css:.pricing button`   → any CSS selector */
export const TargetSchema = z
  .string()
  .regex(/^(aria|text|css):.+/, "target must start with aria:, text: or css:");

export const CaptionSchema = z.object({
  eyebrow: z.string().max(40).optional(),
  /** 1 to 3 short lines, set by hand so they break where the copy means. */
  lines: z.array(z.string().min(1).max(28)).min(1).max(3),
});

/** Any beat can change the caption as it starts (the composer switches it
 *  on the exact frame the shooter logged for that beat). */
const beat = { caption: CaptionSchema.optional() };

export const BeatSchema = z.discriminatedUnion("do", [
  z.object({
    ...beat,
    do: z.literal("wait"),
    ms: z.number().int().min(0).max(10_000),
  }),
  /** Cursor travels to the target, hovers, presses and clicks it for real. */
  z.object({
    ...beat,
    do: z.literal("click"),
    hold: z.number().int().min(0).max(10_000).default(1800),
    target: TargetSchema,
  }),
  z.object({
    ...beat,
    do: z.literal("hover"),
    ms: z.number().int().min(0).max(10_000).default(900),
    target: TargetSchema,
  }),
  /** Browser frame only: drag the window's edge to a viewport width; the
   *  window then centers and zooms in so the new layout reads larger. */
  z.object({
    ...beat,
    do: z.literal("resize"),
    ms: z.number().int().min(300).max(5000).default(1500),
    to: z.number().int().min(320).max(1600),
  }),
  /** Scroll the preview page to a pixel offset or to a target. */
  z.object({
    ...beat,
    do: z.literal("scroll"),
    ms: z.number().int().min(200).max(5000).default(1000),
    to: z.union([z.number().int().min(0), TargetSchema]),
  }),
  /** Type into a field the cursor clicks first. */
  z.object({
    ...beat,
    do: z.literal("type"),
    target: TargetSchema,
    text: z.string().min(1).max(200),
  }),
  /** A key press inside the preview (ArrowRight, Escape, Enter...). */
  z.object({
    ...beat,
    do: z.literal("key"),
    hold: z.number().int().min(0).max(10_000).default(1200),
    key: z.string().min(1).max(30),
  }),
]);

export const ThemeSchema = z.enum(["light", "dark"]);

const base = {
  caption: CaptionSchema.optional(),
};

export const LiveShotSchema = z.object({
  ...base,
  beats: z.array(BeatSchema).min(1).max(30),
  /** The device the component is shown in. */
  frame: z.enum(["browser", "phone"]),
  kind: z.literal("live"),
  /** Theme of the component (and of the frame). Defaults to the spec's. */
  theme: ThemeSchema.optional(),
  /** Address shown in the browser bar. */
  url: z.string().max(40).default("yourstartup.com"),
  /** Starting viewport width in CSS px (browser frame; phones are 402). */
  viewport: z.number().int().min(320).max(1600).default(768),
});

export const TerminalShotSchema = z.object({
  ...base,
  command: z.string().min(1).max(160),
  kind: z.literal("terminal"),
  output: z.array(z.string().max(80)).max(8).default([]),
  /** Folder shown in the prompt. */
  path: z.string().max(30).default("~/yourstartup"),
});

export const CodeShotSchema = z.object({
  ...base,
  /** Code shown, already trimmed to what the viewer needs (6 to 16 lines). */
  code: z.string().min(1).max(1200),
  file: z.string().max(60),
  /** 1-based line numbers to light up, one group after another. */
  highlight: z
    .array(z.array(z.number().int().min(1)).min(1))
    .max(4)
    .default([]),
  kind: z.literal("code"),
  lang: z.enum(["tsx", "ts", "bash", "json", "css"]).default("tsx"),
  ms: z.number().int().min(1500).max(12_000).default(4500),
});

export const EndShotSchema = z.object({
  cta: z.string().max(40),
  headline: z.string().max(24).default("craftUI"),
  kind: z.literal("end"),
  ms: z.number().int().min(1500).max(8000).default(3600),
  note: z.string().max(40).optional(),
  tagline: z.string().max(90),
});

export const ShotSchema = z.discriminatedUnion("kind", [
  LiveShotSchema,
  TerminalShotSchema,
  CodeShotSchema,
  EndShotSchema,
]);

export const VideoTypeSchema = z.enum(["tutorial", "ugc", "showcase"]);

export const VideoSpecSchema = z.object({
  /** Who it's for; the director writes the copy for them. */
  aspect: z.enum(["9:16"]).default("9:16"),
  audience: z.enum(["developers", "founders", "both"]).default("both"),
  fps: z.union([z.literal(30), z.literal(60)]).default(60),
  /** The registry item (registry.json `name`) the video is about. */
  item: z.string().min(1),
  shots: z.array(ShotSchema).min(1).max(12),
  theme: ThemeSchema.default("dark"),
  title: z.string().max(80),
  type: VideoTypeSchema,
  version: z.literal(1),
});

export type Target = z.infer<typeof TargetSchema>;
export type Beat = z.infer<typeof BeatSchema>;
export type Caption = z.infer<typeof CaptionSchema>;
export type LiveShot = z.infer<typeof LiveShotSchema>;
export type TerminalShot = z.infer<typeof TerminalShotSchema>;
export type CodeShot = z.infer<typeof CodeShotSchema>;
export type EndShot = z.infer<typeof EndShotSchema>;
export type Shot = z.infer<typeof ShotSchema>;
export type VideoSpec = z.infer<typeof VideoSpecSchema>;
export type VideoSpecInput = z.input<typeof VideoSpecSchema>;

/** Parses and fills defaults; throws a readable error for a bad storyboard. */
export const parseSpec = (input: unknown): VideoSpec => {
  const result = VideoSpecSchema.safeParse(input);
  if (!result.success) {
    throw new Error(`Invalid video spec:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
};

/** The video canvas, in output pixels. */
export const CANVAS = { height: 1920, width: 1080 } as const;

/** Where captions and media sit on the 9:16 canvas. Instagram, TikTok and
 *  Shorts draw their own UI over the top ~11% and the bottom ~17%. */
export const LAYOUT = {
  captionTop: 240,
  mediaTop: 600,
  safeBottom: 1600,
} as const;

/** Live clips are filmed at half size and 2x, so 540 CSS px = 1080 output px. */
export const CLIP = {
  browser: { height: 540, width: 540 },
  phone: { height: 660, width: 540 },
} as const;
