// Shared pieces for the voice orb concept board (preview only, not shipped).
//
// Each concept is a Sim: it owns its points, steps its own physics on the
// CPU every frame and writes one record per point for point-gl.ts to draw:
//
//   x, y, z     position, in orb units (1 = half the canvas)
//   r, g, b, a  colour and opacity
//   size        diameter in CSS px at a 360px orb

import type { VoiceState } from "@/registry/blocks/voice-orb/voice-orb";

export type { VoiceState };

export type RGB = readonly [number, number, number];

/** Floats per point record. */
export const FLOATS = 8;

export interface SimInput {
  dt: number;
  /** The theme's text colour; ink for monochrome points. */
  ink: RGB;
  /** Smoothed voice level, 0–1. */
  level: number;
  state: VoiceState;
  time: number;
}

export interface Sim {
  count: number;
  /** How much points behind the centre fade, 0–1 (volumes). */
  depth: number;
  /** Opacity of points facing you, on a shell (with `rim`). */
  front: number;
  /** How much a shell's rim light applies, 0–1. */
  rim: number;
  /** Rotation around the vertical axis, radians (the sim advances it). */
  spin: number;
  step: (input: SimInput) => void;
  /** Forward tilt, radians. */
  tilt: number;
  write: (out: Float32Array) => void;
}

export const approach = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-rate * dt));

/** Eases every number in `current` towards `target` (~0.7s to settle). */
export const easeLook = <T extends { [K in keyof T]: number }>(
  current: T,
  target: T,
  dt: number,
  rate = 4.2
) => {
  for (const key of Object.keys(target) as (keyof T)[]) {
    current[key] = approach(current[key], target[key], rate, dt) as T[keyof T];
  }
};

export const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);

export const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const luminance = ([r, g, b]: RGB) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * A light tint as it should read on this theme: as is on dark (light
 * points), deeper on light (dark points), so it holds on white.
 */
export const adapt = (tint: RGB, ink: RGB): [number, number, number] => {
  const k = 0.55 + 0.45 * luminance(ink);
  return [tint[0] * k, tint[1] * k, tint[2] * k];
};

export const mixRgb = (a: RGB, b: RGB, t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** A seeded sequence of 0–1 numbers. */
export const seeded = (seed: number) => {
  let n = seed;
  return () => {
    n += 1;
    const x = Math.sin(n * 12.9898 + seed * 78.233) * 43_758.5453;
    return x - Math.floor(x);
  };
};

/** Mostly fine points, a few larger. */
export const sizeFactor = (roll: number) => {
  if (roll < 0.86) {
    return 0.55 + roll * 0.4;
  }
  return roll < 0.97 ? 1 : 1.5;
};

/** Evenly spread unit directions (Fibonacci sphere), lightly nudged. */
export const sphereDirections = (count: number, random: () => number) => {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const x = Math.cos(i * golden) * ring + (random() - 0.5) * 0.05;
    const z = Math.sin(i * golden) * ring + (random() - 0.5) * 0.05;
    const yy = y + (random() - 0.5) * 0.05;
    const length = Math.hypot(x, yy, z) || 1;
    out[i * 3] = x / length;
    out[i * 3 + 1] = yy / length;
    out[i * 3 + 2] = z / length;
  }
  return out;
};

/** A random unit vector, from a normal-ish draw. */
export const randomUnit = (): [number, number, number] => {
  const u = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return [s * Math.cos(a), u, s * Math.sin(a)];
};

/** The world direction that faces the viewer, for a spin and tilt. */
export const viewDirection = (spin: number, tilt: number): RGB => {
  // Inverse of Rx(tilt)·Ry(spin) applied to (0, 0, 1).
  const cx = Math.cos(tilt);
  const sx = Math.sin(tilt);
  return [-Math.sin(spin) * cx, sx, Math.cos(spin) * cx];
};

/**
 * Fires on each syllable or beat: whenever the level climbs `rise` above
 * its last low point, at most once per `gap` seconds. Relative, so it
 * still catches syllables when the smoothed level never falls far between
 * them.
 */
export const onsetDetector = (rise = 0.12, gap = 0.16) => {
  let low = 0;
  let since = gap;
  return (level: number, dt: number) => {
    since += dt;
    low = Math.min(low, level);
    if (level - low > rise && since >= gap) {
      since = 0;
      low = level;
      return true;
    }
    return false;
  };
};

/** Writes one point record. */
export const put = (
  out: Float32Array,
  i: number,
  x: number,
  y: number,
  z: number,
  color: RGB,
  alpha: number,
  size: number
) => {
  const o = i * FLOATS;
  out[o] = x;
  out[o + 1] = y;
  out[o + 2] = z;
  const [r, g, b] = color;
  out[o + 3] = r;
  out[o + 4] = g;
  out[o + 5] = b;
  out[o + 6] = alpha;
  out[o + 7] = size;
};
