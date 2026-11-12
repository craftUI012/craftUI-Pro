// The frames the Studio makes. Positions and sizes are stored in the
// chosen frame's pixels.
export type ReelFormat = "9:16" | "16:9";

export const FORMATS: Record<
  ReelFormat,
  { height: number; use: string; width: number }
> = {
  "16:9": { height: 1080, use: "YouTube, X, LinkedIn", width: 1920 },
  "9:16": { height: 1920, use: "Reels, TikTok, Shorts", width: 1080 },
};

export const isReelFormat = (value: unknown): value is ReelFormat =>
  value === "9:16" || value === "16:9";

// A box in frame pixels: the clip, or a device's body.
export interface ReelBox {
  h: number;
  w: number;
  x: number;
  y: number;
}
