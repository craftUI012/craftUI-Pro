// 5 · Orbitals. The hydrogen atom: each state is a real electron orbital.
//
//   idle 1s · listening 2s · thinking 2p · speaking 3d · playing 4f
//
// The points are where you'd find the electron: placed by |ψ|², then kept
// moving by a Metropolis random walk on |ψ|², which leaves the cloud's
// shape exactly right while every point wanders (a living cloud). A state
// change is a quantum jump: every point travels to a place in the new
// orbital, staggered, and flashes as it lands, like the photon an atom
// gives off. Colour is the wavefunction's sign, the two-colour convention
// of every chemistry textbook: warm lobes +, cool lobes −.

import { adapt, easeLook, mixRgb, put, seeded, sizeFactor } from "./shared";
import type { RGB, Sim, VoiceState } from "./shared";

type Psi = (x: number, y: number, z: number) => number;

/** Orbitals in Bohr radii; `extent` holds ~95% of the cloud. */
const ORBITALS: Record<VoiceState, { extent: number; psi: Psi }> = {
  idle: { extent: 3.6, psi: (x, y, z) => Math.exp(-Math.hypot(x, y, z)) },
  listening: {
    extent: 10,
    psi: (x, y, z) => {
      const r = Math.hypot(x, y, z);
      return (2 - r) * Math.exp(-r / 2);
    },
  },
  playing: {
    extent: 22,
    psi: (x, y, z) => x * y * z * Math.exp(-Math.hypot(x, y, z) / 4),
  },
  speaking: {
    extent: 15,
    // 3d z²: a dumbbell through a ring, the same from every side.
    psi: (x, y, z) =>
      (3 * y * y - (x * x + y * y + z * z)) *
      Math.exp(-Math.hypot(x, y, z) / 3),
  },
  thinking: {
    extent: 10,
    psi: (x, y, z) => y * Math.exp(-Math.hypot(x, y, z) / 2),
  },
};

const STATES: ReadonlySet<VoiceState> = new Set<VoiceState>([
  "idle",
  "listening",
  "thinking",
  "speaking",
  "playing",
]);

interface Look {
  bright: number;
  phase: number;
  size: number;
  spin: number;
  wander: number;
}

const LOOKS: Record<VoiceState, Look> = {
  idle: { bright: 0.75, phase: 0.4, size: 1.3, spin: 0.03, wander: 0.5 },
  listening: { bright: 0.8, phase: 0.8, size: 1.3, spin: 0.03, wander: 1 },
  playing: { bright: 0.95, phase: 0.9, size: 1.4, spin: 0.05, wander: 1.4 },
  speaking: { bright: 0.9, phase: 0.85, size: 1.4, spin: 0.035, wander: 1.6 },
  thinking: { bright: 0.7, phase: 0.75, size: 1.2, spin: 0.14, wander: 0.6 },
};

const COUNT = 7000;
/** Orb units the 95% extent maps to. */
const FIT = 0.74;
const JUMP = { flash: 0.45, stagger: 0.35, travel: 0.7 };
const WARM: RGB = [1, 0.6, 0.5];
const COOL: RGB = [0.5, 0.72, 1];

/** |ψ|² at a point in orb units, for an orbital. */
const density = (state: VoiceState, x: number, y: number, z: number) => {
  const { extent, psi } = ORBITALS[state];
  const k = extent / FIT;
  const value = psi(x * k, y * k, z * k);
  return value * value;
};

/** COUNT points drawn from an orbital's |ψ|², by rejection. */
const sample = (state: VoiceState, random: () => number) => {
  const out = new Float32Array(COUNT * 3);
  const box = FIT * 1.15;
  let most = 0;
  for (let i = 0; i < 30_000; i += 1) {
    const d = density(
      state,
      (random() * 2 - 1) * box,
      (random() * 2 - 1) * box,
      (random() * 2 - 1) * box
    );
    most = Math.max(most, d);
  }
  let n = 0;
  while (n < COUNT) {
    const x = (random() * 2 - 1) * box;
    const y = (random() * 2 - 1) * box;
    const z = (random() * 2 - 1) * box;
    if (random() * most * 1.05 < density(state, x, y, z)) {
      out[n * 3] = x;
      out[n * 3 + 1] = y;
      out[n * 3 + 2] = z;
      n += 1;
    }
  }
  return out;
};

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

export const createOrbitals = (): Sim => {
  const random = seeded(51);
  const samples = new Map<VoiceState, Float32Array>();
  const samplesOf = (state: VoiceState) => {
    let set = samples.get(state);
    if (!set) {
      set = sample(state, random);
      samples.set(state, set);
    }
    return set;
  };
  const pos = Float32Array.from(samplesOf("idle"));
  const from = new Float32Array(COUNT * 3);
  const to = new Float32Array(COUNT * 3);
  const delay = Float32Array.from(
    { length: COUNT },
    () => random() * JUMP.stagger
  );
  const size = Float32Array.from({ length: COUNT }, () => sizeFactor(random()));
  const rho = new Float32Array(COUNT);
  const sign = new Float32Array(COUNT);
  const look: Look = { ...LOOKS.idle };
  let state: VoiceState = "idle";
  let jumpAge = 9;
  let level = 0;
  let ink: RGB = [1, 1, 1];

  const measure = (i: number) => {
    const o = i * 3;
    const { extent, psi } = ORBITALS[state];
    const k = extent / FIT;
    const value = psi(pos[o] * k, pos[o + 1] * k, pos[o + 2] * k);
    rho[i] = value * value;
    sign[i] = Math.sign(value);
  };

  const jump = (next: VoiceState) => {
    state = next;
    jumpAge = 0;
    from.set(pos);
    // A fresh draw each time, offset so it never repeats exactly.
    const set = samplesOf(next);
    const shift = Math.floor(random() * COUNT);
    for (let i = 0; i < COUNT; i += 1) {
      const j = ((i + shift) % COUNT) * 3;
      to[i * 3] = set[j];
      to[i * 3 + 1] = set[j + 1];
      to[i * 3 + 2] = set[j + 2];
    }
  };

  /** One Metropolis step: propose a nearby point, keep it by |ψ|² ratio. */
  const wander = (i: number, step: number) => {
    const o = i * 3;
    const x = pos[o] + (Math.random() - 0.5) * step;
    const y = pos[o + 1] + (Math.random() - 0.5) * step;
    const z = pos[o + 2] + (Math.random() - 0.5) * step;
    const next = density(state, x, y, z);
    if (next >= rho[i] || Math.random() * rho[i] < next) {
      pos[o] = x;
      pos[o + 1] = y;
      pos[o + 2] = z;
      measure(i);
    }
  };

  for (let i = 0; i < COUNT; i += 1) {
    measure(i);
  }

  const sim: Sim = {
    count: COUNT,
    depth: 0.5,
    front: 1,
    rim: 0,
    spin: 0.5,
    step: (input) => {
      const { dt } = input;
      ({ ink, level } = input);
      easeLook(look, LOOKS[input.state], dt);
      if (input.state !== state && STATES.has(input.state)) {
        jump(input.state);
      }
      jumpAge += dt;
      const jumping = jumpAge < JUMP.travel + JUMP.stagger;
      for (let i = 0; i < COUNT; i += 1) {
        const t = Math.min(1, Math.max(0, (jumpAge - delay[i]) / JUMP.travel));
        if (jumping) {
          const e = easeInOut(t);
          const o = i * 3;
          pos[o] = from[o] + (to[o] - from[o]) * e;
          pos[o + 1] = from[o + 1] + (to[o + 1] - from[o + 1]) * e;
          pos[o + 2] = from[o + 2] + (to[o + 2] - from[o + 2]) * e;
          measure(i);
        } else {
          wander(i, 0.035 * look.wander * (1 + level * 1.5));
        }
      }
      sim.spin += dt * look.spin * Math.PI * 2;
    },
    tilt: 0.35,
    write: (out) => {
      const warm = adapt(WARM, ink);
      const cool = adapt(COOL, ink);
      const swell = 1 + level * 0.07;
      for (let i = 0; i < COUNT; i += 1) {
        const o = i * 3;
        const landed = jumpAge - delay[i] - JUMP.travel;
        const flash =
          landed > 0 && landed < JUMP.flash ? 1 - landed / JUMP.flash : 0;
        const tint = sign[i] < 0 ? cool : warm;
        const color = mixRgb(ink, tint, look.phase);
        put(
          out,
          i,
          pos[o] * swell,
          pos[o + 1] * swell,
          pos[o + 2] * swell,
          color,
          Math.min(1, look.bright + flash * 0.6),
          look.size * size[i] * (1 + flash * 0.6)
        );
      }
    },
  };
  return sim;
};
