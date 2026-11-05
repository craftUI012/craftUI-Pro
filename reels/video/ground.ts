import type { CSSProperties } from "react";

import type { Ground, Look } from "@/reels/spec";
import { PAGE } from "@/reels/spec";

// The ground behind the component (video-director: references/look.md).
// Auto builds it from the component's own palette, sampled by the probe:
// a light component gets a soft aurora of its hues (or a warm paper when
// it has none), a dark one a deep ink of its hue with one light behind
// the product (a glow) when it has an accent. The caption's ink follows
// the ground's tone.

type Resolved = Exclude<Ground, "auto">;

export interface GroundLayer {
  key: string;
  className: string;
  style?: CSSProperties;
}

export interface GroundView {
  kind: Resolved;
  /** Whether text on this ground is dark (light ground) or light. */
  tone: "light" | "dark";
  style: CSSProperties;
  layers: GroundLayer[];
}

const hueOf = (hex: string) => {
  const channel = (at: number) =>
    Number.parseInt(hex.slice(at, at + 2), 16) / 255;
  const [r, g, b] = [channel(1), channel(3), channel(5)];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) {
    return 0;
  }
  let h = 0;
  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return Math.round((h * 60 + 360) % 360);
};

/** Warm paper for light, a blue-violet ink for dark: the neutral defaults. */
const DEFAULT_HUE = { dark: 232, light: 38 };

const GRAIN: GroundLayer = { className: "rl-grain", key: "grain" };

export const groundFor = (look: Look, theme: "light" | "dark"): GroundView => {
  const hues = look.palette.map(hueOf);
  const dark = theme === "dark";
  const AUTO: Record<"dark" | "light", [Resolved, Resolved]> = {
    // [with the component's own hues, without]
    dark: ["glow", "ink"],
    light: ["aurora", "paper"],
  };
  const kind: Resolved =
    look.ground === "auto"
      ? AUTO[dark ? "dark" : "light"][hues.length > 0 ? 0 : 1]
      : look.ground;
  const [h1 = DEFAULT_HUE[dark ? "dark" : "light"]] = hues;
  const h2 = hues[1] ?? (h1 + 40) % 360;
  const h3 = hues[2] ?? (h1 + 320) % 360;
  const mediaCentre = PAGE.media.top + PAGE.media.height / 2;

  switch (kind) {
    case "paper": {
      return {
        kind,
        layers: [GRAIN],
        style: { background: `hsl(${h1} 24% 95%)` },
        tone: "light",
      };
    }
    case "aurora": {
      return {
        kind,
        layers: [
          {
            className: "rl-blob rl-blob--1",
            key: "b1",
            style: { "--c": `hsl(${h1} 70% 80%)` } as CSSProperties,
          },
          {
            className: "rl-blob rl-blob--2",
            key: "b2",
            style: { "--c": `hsl(${h2} 70% 82%)` } as CSSProperties,
          },
          {
            className: "rl-blob rl-blob--3",
            key: "b3",
            style: { "--c": `hsl(${h3} 60% 86%)` } as CSSProperties,
          },
          GRAIN,
        ],
        style: { background: `hsl(${h1} 35% 96%)` },
        tone: "light",
      };
    }
    case "ink": {
      return {
        kind,
        layers: [GRAIN],
        style: {
          background: `linear-gradient(180deg, hsl(${h1} 42% 14%), hsl(${h1} 48% 7%))`,
        },
        tone: "dark",
      };
    }
    case "glow": {
      return {
        kind,
        layers: [
          {
            className: "rl-glow",
            key: "glow",
            style: {
              background: `radial-gradient(closest-side, hsl(${h1} 75% 55% / 0.42), transparent)`,
              top: mediaCentre - 260,
            },
          },
          GRAIN,
        ],
        style: { background: `hsl(${h1} 30% 6%)` },
        tone: "dark",
      };
    }
    default: {
      return {
        kind: "flat",
        layers: [],
        style: { background: dark ? "#0a0a0a" : "#ffffff" },
        tone: dark ? "dark" : "light",
      };
    }
  }
};
