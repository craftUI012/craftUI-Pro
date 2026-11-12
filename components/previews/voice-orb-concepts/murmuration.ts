// 4 · Murmuration. A flock of starlings holding the shape of a ball.
//
// Each bird follows three local rules (Reynolds' boids): don't crowd your
// nearest neighbours, match their heading, keep near them. A soft pull
// keeps the flock on a shell. Real murmurations ripple when a falcon dives:
// here every syllable sends a falcon across the front, and the turn
// spreads through the flock as a wave. Thinking turns the flock in one
// direction like a bait ball; music breaks it on the beat and it re-forms.
// Birds in dense parts of the flock read darker, as against a dusk sky.

import {
  easeLook,
  onsetDetector,
  put,
  randomUnit,
  seeded,
  sphereDirections,
  viewDirection,
} from "./shared";
import type { RGB, Sim, VoiceState } from "./shared";

interface Look {
  align: number;
  bright: number;
  cohere: number;
  radius: number;
  speed: number;
  swirl: number;
}

const LOOKS: Record<VoiceState, Look> = {
  idle: {
    align: 0.5,
    bright: 0.65,
    cohere: 0.25,
    radius: 0.72,
    speed: 0.16,
    swirl: 0,
  },
  listening: {
    align: 0.6,
    bright: 0.72,
    cohere: 0.35,
    radius: 0.7,
    speed: 0.22,
    swirl: 0,
  },
  playing: {
    align: 0.5,
    bright: 0.95,
    cohere: 0.2,
    radius: 0.76,
    speed: 0.36,
    swirl: 0.3,
  },
  speaking: {
    align: 0.7,
    bright: 0.9,
    cohere: 0.3,
    radius: 0.74,
    speed: 0.3,
    swirl: 0,
  },
  thinking: {
    align: 1.2,
    bright: 0.55,
    cohere: 0.3,
    radius: 0.66,
    speed: 0.28,
    swirl: 1,
  },
};

const COUNT = 3200;
/** Neighbour radius (also the grid cell) and crowding radius. */
const SEE = 0.09;
const CROWD = 0.04;
/** Strength of the shifting wind. */
const WIND = 0.9;
/** Grid spans −GRID_HALF…GRID_HALF on each axis. */
const GRID_HALF = 1.2;
const CELLS = Math.ceil((GRID_HALF * 2) / SEE);

interface Falcon {
  age: number;
  from: RGB;
  to: RGB;
}

const cellOf = (value: number) =>
  Math.min(CELLS - 1, Math.max(0, Math.floor((value + GRID_HALF) / SEE)));

export const createMurmuration = (): Sim => {
  const random = seeded(41);
  const p = sphereDirections(COUNT, random);
  for (let i = 0; i < p.length; i += 1) {
    p[i] *= 0.72;
  }
  const v = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i += 1) {
    const [x, y, z] = randomUnit();
    v[i * 3] = x * 0.15;
    v[i * 3 + 1] = y * 0.15;
    v[i * 3 + 2] = z * 0.15;
  }
  const crowd = new Float32Array(COUNT);
  const size = Float32Array.from({ length: COUNT }, () => 0.9 + random() * 0.5);
  // Counting-sort grid: birds ordered by cell, with each cell's start.
  const cellStart = new Int32Array(CELLS * CELLS * CELLS + 1);
  const order = new Int32Array(COUNT);
  const birdCell = new Int32Array(COUNT);
  const look: Look = { ...LOOKS.idle };
  const onset = onsetDetector(0.15, 0.35);
  let falcon: Falcon | null = null;
  let level = 0;
  let pulse = 0;
  let time = 0;
  let ink: RGB = [1, 1, 1];

  const bin = () => {
    cellStart.fill(0);
    for (let i = 0; i < COUNT; i += 1) {
      const o = i * 3;
      const c =
        (cellOf(p[o]) * CELLS + cellOf(p[o + 1])) * CELLS + cellOf(p[o + 2]);
      birdCell[i] = c;
      cellStart[c + 1] += 1;
    }
    for (let c = 0; c < CELLS * CELLS * CELLS; c += 1) {
      cellStart[c + 1] += cellStart[c];
    }
    const fill = [...cellStart];
    for (let i = 0; i < COUNT; i += 1) {
      order[fill[birdCell[i]]] = i;
      fill[birdCell[i]] += 1;
    }
  };

  /** Sums the three rules over birds in the 27 cells around bird i. */
  const flock = (i: number, force: Float32Array) => {
    const o = i * 3;
    const [cx, cy, cz] = [cellOf(p[o]), cellOf(p[o + 1]), cellOf(p[o + 2])];
    let n = 0;
    force.fill(0);
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dz = -1; dz <= 1; dz += 1) {
          const gx = cx + dx;
          const gy = cy + dy;
          const gz = cz + dz;
          if (
            gx < 0 ||
            gy < 0 ||
            gz < 0 ||
            gx >= CELLS ||
            gy >= CELLS ||
            gz >= CELLS
          ) {
            continue;
          }
          const c = (gx * CELLS + gy) * CELLS + gz;
          for (let k = cellStart[c]; k < cellStart[c + 1]; k += 1) {
            const j = order[k];
            if (j === i) {
              continue;
            }
            const q = j * 3;
            const ox = p[q] - p[o];
            const oy = p[q + 1] - p[o + 1];
            const oz = p[q + 2] - p[o + 2];
            const d = Math.hypot(ox, oy, oz);
            if (d > SEE) {
              continue;
            }
            n += 1;
            // cohere (towards), align (velocity), separate (away, close).
            force[0] += ox;
            force[1] += oy;
            force[2] += oz;
            force[3] += v[q];
            force[4] += v[q + 1];
            force[5] += v[q + 2];
            if (d < CROWD && d > 1e-5) {
              const push = (CROWD - d) / d;
              force[6] -= ox * push;
              force[7] -= oy * push;
              force[8] -= oz * push;
            }
          }
        }
      }
    }
    return n;
  };

  const sums = new Float32Array(9);

  const steer = (i: number, dt: number) => {
    const o = i * 3;
    const n = flock(i, sums);
    crowd[i] += (n - crowd[i]) * Math.min(1, dt * 6);
    let ax = 0;
    let ay = 0;
    let az = 0;
    if (n > 0) {
      ax +=
        (sums[0] / n) * look.cohere * 4 + (sums[3] / n - v[o]) * look.align * 2;
      ay +=
        (sums[1] / n) * look.cohere * 4 +
        (sums[4] / n - v[o + 1]) * look.align * 2;
      az +=
        (sums[2] / n) * look.cohere * 4 +
        (sums[5] / n - v[o + 2]) * look.align * 2;
    }
    ax += sums[6] * 90;
    ay += sums[7] * 90;
    az += sums[8] * 90;
    // A soft ball: free inside, turned back past the edge, and kept off
    // the very middle so the flock sweeps round rather than balling up.
    // Thinking circles round the vertical axis.
    const r = Math.hypot(p[o], p[o + 1], p[o + 2]) || 1;
    const edge = look.radius * (1 + pulse * 0.18 + level * 0.04);
    const pull = Math.min(0, edge - r) * 14 + Math.max(0, edge * 0.3 - r) * 6;
    // A slow, shifting wind the flock steers through, so it keeps changing
    // shape (sweeps and folds) instead of settling into one orbit.
    const w = time * 0.35;
    ax += Math.sin(p[o + 1] * 3.1 + w) * WIND;
    ay += Math.sin(p[o + 2] * 2.7 + w * 1.3) * WIND;
    az += Math.sin(p[o] * 2.9 + w * 0.8) * WIND;
    ax += (p[o] / r) * pull - p[o + 2] * look.swirl * 0.9;
    ay += (p[o + 1] / r) * pull;
    az += (p[o + 2] / r) * pull + p[o] * look.swirl * 0.9;
    if (falcon) {
      const t = Math.min(1, falcon.age / 1.1);
      const hx = falcon.from[0] + (falcon.to[0] - falcon.from[0]) * t;
      const hy = falcon.from[1] + (falcon.to[1] - falcon.from[1]) * t;
      const hz = falcon.from[2] + (falcon.to[2] - falcon.from[2]) * t;
      const fx = p[o] - hx * look.radius;
      const fy = p[o + 1] - hy * look.radius;
      const fz = p[o + 2] - hz * look.radius;
      const d = Math.hypot(fx, fy, fz);
      if (d < 0.28 && d > 1e-4) {
        const flee = ((0.28 - d) / d) * 9;
        ax += fx * flee;
        ay += fy * flee;
        az += fz * flee;
      }
    }
    v[o] += ax * dt;
    v[o + 1] += ay * dt;
    v[o + 2] += az * dt;
  };

  const fly = (i: number, dt: number) => {
    const o = i * 3;
    const speed = Math.hypot(v[o], v[o + 1], v[o + 2]) || 1;
    const top = look.speed * (1.5 + level);
    const low = look.speed * 0.6;
    const clamped = Math.min(Math.max(speed, low), top);
    v[o] *= clamped / speed;
    v[o + 1] *= clamped / speed;
    v[o + 2] *= clamped / speed;
    p[o] += v[o] * dt;
    p[o + 1] += v[o + 1] * dt;
    p[o + 2] += v[o + 2] * dt;
  };

  const sim: Sim = {
    count: COUNT,
    depth: 0,
    front: 0.25,
    rim: 0.6,
    spin: 0,
    step: (input) => {
      const dt = Math.min(input.dt, 1 / 30);
      ({ time } = input);
      ({ level } = input);
      ({ ink } = input);
      easeLook(look, LOOKS[input.state], dt);
      const beat = onset(level, dt);
      if (beat && input.state === "speaking") {
        const front = viewDirection(sim.spin, sim.tilt);
        const side = randomUnit();
        falcon = {
          age: 0,
          from: [
            front[0] + side[0] * 0.8,
            front[1] + side[1] * 0.8,
            front[2] + side[2] * 0.8,
          ],
          to: [
            front[0] - side[0] * 0.8,
            front[1] - side[1] * 0.8,
            front[2] - side[2] * 0.8,
          ],
        };
      }
      if (beat && input.state === "playing") {
        pulse = 1;
      }
      pulse *= Math.exp(-dt * 3);
      if (falcon) {
        falcon.age += dt;
        if (falcon.age > 1.4) {
          falcon = null;
        }
      }
      bin();
      for (let i = 0; i < COUNT; i += 1) {
        steer(i, dt);
      }
      for (let i = 0; i < COUNT; i += 1) {
        fly(i, dt);
      }
    },
    tilt: 0.25,
    write: (out) => {
      for (let i = 0; i < COUNT; i += 1) {
        const o = i * 3;
        const dense = Math.min(1, crowd[i] / 12);
        put(
          out,
          i,
          p[o],
          p[o + 1],
          p[o + 2],
          ink,
          look.bright * (0.3 + 0.7 * dense),
          1.6 * size[i]
        );
      }
    },
  };
  return sim;
};
