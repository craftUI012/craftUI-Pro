// The membrane's physics and drawing, in plain TypeScript and WebGL2 (no
// React, no libraries).
//
// A ball of points, each held to its place on the surface by a damped
// spring (underdamped, so it overshoots and jiggles like water). The voice
// moves the surface:
//
//   listening   small ripples where your syllables land
//   thinking    an even ring leaves the top pole on a steady beat and
//               rolls down the ball, while the whole ball breathes
//   speaking    a ripple from the front on every syllable, bigger
//   playing     standing waves set up by the music
//
// Colour is thin-film interference, the way a soap bubble gets its colour:
// light reflects off both faces of the film and, per wavelength, the two
// reflections add or cancel by the film's thickness. Thickness drains
// towards the bottom (gravity) and stretches where the surface moves.
// Crests catch the light and troughs fall into shade, so ripples read on
// the face of the ball too. No glow: points are crisp discs.

export type VoiceState =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "playing";

type RGB = readonly [number, number, number];

/** The numbers that make a state's look; they ease between states. */
interface MembraneLook {
  /** Slow in-out of the whole ball (thinking). */
  breathe: number;
  /** Overall opacity of the points, 0–1. */
  bright: number;
  /** Opacity of the face towards you (the rim is 1), so ripples show. */
  face: number;
  /** How much soap-film colour shows over the ink, 0–1. */
  film: number;
  /** Height of thinking's rings, in radius units. */
  pulse: number;
  /** Height of a syllable's ripple, in radius units. */
  ripple: number;
  /** Point diameter in CSS pixels at a 360px orb. */
  size: number;
  /** Standing waves under the music, in radius units. */
  standing: number;
}

/** Each state's look. Tune here. */
export const MEMBRANE_LOOKS: Record<VoiceState, MembraneLook> = {
  idle: {
    breathe: 0,
    bright: 0.7,
    face: 0.1,
    film: 0.45,
    pulse: 0,
    ripple: 0,
    size: 1.5,
    standing: 0,
  },
  listening: {
    breathe: 0,
    bright: 0.75,
    face: 0.18,
    film: 0.5,
    pulse: 0,
    ripple: 0.05,
    size: 1.45,
    standing: 0,
  },
  playing: {
    breathe: 0,
    bright: 1,
    face: 0.2,
    film: 0.85,
    pulse: 0,
    ripple: 0.03,
    size: 1.8,
    standing: 0.07,
  },
  speaking: {
    breathe: 0,
    bright: 0.95,
    face: 0.38,
    film: 0.65,
    pulse: 0,
    ripple: 0.14,
    size: 1.7,
    standing: 0,
  },
  thinking: {
    breathe: 1,
    bright: 0.55,
    face: 0.3,
    film: 0.35,
    pulse: 0.07,
    ripple: 0,
    size: 1.3,
    standing: 0,
  },
};

/** Points per orb. */
const COUNT = 6000;
/** Radius of the ball, as a share of half the canvas. */
const RADIUS = 0.74;
/** Forward tilt, so the top reads as a lid, and turns per second. */
const VIEW = { spin: 0.025, tilt: 0.32 };
/** Look numbers ease ~95% of the way in 0.7s, no overshoot. */
const LOOK_RATE = 4.2;
/** Spring stiffness and damping: ζ ≈ 0.35, a few visible wobbles. */
const SPRING = { damping: 7, stiffness: 100 };
/** Ripple speed (radians of arc per second), wavelength, width, fade. */
const RIPPLE = { decay: 1.1, speed: 1.7, wavelength: 0.32, width: 0.3 };
/** Seconds between thinking's rings. */
const PULSE_EVERY = 1.3;
/** A syllable: the level climbs this far above its last low, this often. */
const ONSET = { gap: 0.16, rise: 0.12 };
/** Wavelengths for red, green, blue (nm) and the film's refractive index. */
const LIGHT = { blue: 450, green: 532, index: 1.33, red: 650 };
/** Floats per point record: x, y, z, r, g, b, a, size. */
const FLOATS = 8;

const approach = (from: number, to: number, rate: number, dt: number) =>
  from + (to - from) * (1 - Math.exp(-rate * dt));

/** A seeded sequence of 0–1 numbers (a sine hash: plenty for scatter). */
const seeded = (seed: number) => {
  let n = seed;
  return () => {
    n += 1;
    const x = Math.sin(n * 12.9898 + seed * 78.233) * 43_758.5453;
    return x - Math.floor(x);
  };
};

/** Mostly fine points, a few larger. */
const sizeFactor = (roll: number) => {
  if (roll < 0.86) {
    return 0.55 + roll * 0.4;
  }
  return roll < 0.97 ? 1 : 1.5;
};

/** Evenly spread unit directions (a Fibonacci sphere), lightly nudged. */
const sphereDirections = (count: number, random: () => number) => {
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

/** Rx(tilt) · Ry(spin), column-major. */
const rotation = (spin: number, tilt: number) => {
  const cy = Math.cos(spin);
  const sy = Math.sin(spin);
  const cx = Math.cos(tilt);
  const sx = Math.sin(tilt);
  return new Float32Array([
    cy,
    sx * sy,
    -cx * sy,
    0,
    cx,
    sx,
    sy,
    -sx * cy,
    cx * cy,
  ]);
};

/** The world direction facing the viewer: R⁻¹ · (0, 0, 1). */
const viewDirection = (spin: number, tilt: number): RGB => [
  -Math.sin(spin) * Math.cos(tilt),
  Math.sin(tilt),
  Math.cos(spin) * Math.cos(tilt),
];

/** A unit vector within ~45° of `toward`, at random. */
const near = (toward: RGB): RGB => {
  const x = toward[0] + (Math.random() - 0.5) * 1.2;
  const y = toward[1] + (Math.random() - 0.5) * 1.2;
  const z = toward[2] + (Math.random() - 0.5) * 1.2;
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};

/** Reflected colour of a soap film `nm` thick, kept light, 0–1. */
const filmColor = (nm: number): RGB => {
  const k = 2 * Math.PI * LIGHT.index * nm;
  const at = (lambda: number) => Math.sin(k / lambda) ** 2;
  return [
    0.55 + 0.45 * at(LIGHT.red),
    0.55 + 0.45 * at(LIGHT.green),
    0.55 + 0.45 * at(LIGHT.blue),
  ];
};

/**
 * Light film colours as they should read on this theme: as they are on
 * dark (light points), deeper on light (dark points), so they hold on
 * white.
 */
const filmOn = (ink: RGB, film: RGB, amount: number): RGB => {
  const light = 0.2126 * ink[0] + 0.7152 * ink[1] + 0.0722 * ink[2];
  const k = 0.55 + 0.45 * light;
  return [
    ink[0] + (film[0] * k - ink[0]) * amount,
    ink[1] + (film[1] * k - ink[1]) * amount,
    ink[2] + (film[2] * k - ink[2]) * amount,
  ];
};

interface Ripple {
  amp: number;
  born: number;
  origin: RGB;
}

export interface MembraneStep {
  dt: number;
  /** The theme's text colour, 0–1 per channel. */
  ink: RGB;
  /** Smoothed voice level, 0–1. */
  level: number;
  state: VoiceState;
  /** Reduced motion: hold the surface still; light and colour still ease. */
  still: boolean;
}

export interface Membrane {
  count: number;
  /** Opacity of the face towards you, for the renderer. */
  face: () => number;
  /** Rotation for the renderer (column-major 3×3). */
  rotation: () => Float32Array;
  step: (input: MembraneStep) => void;
  /** Writes every point's record (FLOATS each) into `out`. */
  write: (out: Float32Array) => void;
}

/** The membrane's points and physics, starting in `state`. */
export const createMembrane = (state: VoiceState = "idle"): Membrane => {
  const random = seeded(21);
  const dir = sphereDirections(COUNT, random);
  const size = Float32Array.from({ length: COUNT }, () => sizeFactor(random()));
  const jitter = Float32Array.from({ length: COUNT }, () => random() - 0.5);
  const h = new Float32Array(COUNT);
  const v = new Float32Array(COUNT);
  const look: MembraneLook = { ...MEMBRANE_LOOKS[state] };
  const ripples: Ripple[] = [];
  let time = 0;
  let level = 0;
  let spin = 0.4;
  let ink: RGB = [1, 1, 1];
  let pulseClock = PULSE_EVERY;
  let low = 0;
  let sinceOnset = ONSET.gap;

  /** True on each syllable or beat: a rise above the last low point. */
  const onset = (dt: number) => {
    sinceOnset += dt;
    low = Math.min(low, level);
    if (level - low > ONSET.rise && sinceOnset >= ONSET.gap) {
      sinceOnset = 0;
      low = level;
      return true;
    }
    return false;
  };

  const rippleAt = (x: number, y: number, z: number) => {
    let sum = 0;
    for (const ripple of ripples) {
      const age = time - ripple.born;
      const [ox, oy, oz] = ripple.origin;
      const cos = x * ox + y * oy + z * oz;
      const arc = Math.acos(Math.min(Math.max(cos, -1), 1));
      const lag = arc - age * RIPPLE.speed;
      sum +=
        ripple.amp *
        Math.exp(-((lag / RIPPLE.width) ** 2)) *
        Math.cos((lag / RIPPLE.wavelength) * Math.PI) *
        Math.exp(-age * RIPPLE.decay);
    }
    return sum;
  };

  /** Where the surface wants to be: breathing + standing waves + ripples. */
  const restAt = (x: number, y: number, z: number) => {
    const breath =
      look.breathe *
      (0.022 * Math.sin(time * 1.8) +
        0.014 * (1.5 * y * y - 0.5) * Math.sin(time * 1.3));
    const standing =
      look.standing *
      level *
      ((x ** 4 + y ** 4 + z ** 4 - 0.6) * 2.5 * Math.sin(time * 7) +
        x * y * z * 4 * Math.cos(time * 4.4));
    return breath + standing + rippleAt(x, y, z);
  };

  const spawn = (dt: number) => {
    if (onset(dt) && look.ripple > 0.005) {
      ripples.push({
        amp: look.ripple * (0.6 + level * 0.6),
        born: time,
        origin: near(viewDirection(spin, VIEW.tilt)),
      });
    }
    pulseClock += dt;
    if (look.pulse > 0.01 && pulseClock >= PULSE_EVERY) {
      pulseClock = 0;
      ripples.push({ amp: look.pulse, born: time, origin: [0, 1, 0] });
    }
    while (ripples.length > 0 && time - ripples[0].born > 3) {
      ripples.shift();
    }
  };

  return {
    count: COUNT,
    face: () => look.face,
    rotation: () => rotation(spin, VIEW.tilt),
    step: (input) => {
      const { dt, still } = input;
      ({ ink, level } = input);
      const target = MEMBRANE_LOOKS[input.state];
      for (const key of Object.keys(target) as (keyof MembraneLook)[]) {
        look[key] = still
          ? target[key]
          : approach(look[key], target[key], LOOK_RATE, dt);
      }
      if (still) {
        ripples.length = 0;
        h.fill(0);
        v.fill(0);
        return;
      }
      time += dt;
      spawn(dt);
      for (let i = 0; i < COUNT; i += 1) {
        const o = i * 3;
        const rest = restAt(dir[o], dir[o + 1], dir[o + 2]);
        const a = SPRING.stiffness * (rest - h[i]) - SPRING.damping * v[i];
        v[i] += a * dt;
        h[i] += v[i] * dt;
      }
      spin += dt * VIEW.spin * Math.PI * 2;
    },
    write: (out) => {
      for (let i = 0; i < COUNT; i += 1) {
        const o = i * 3;
        const [x, y, z] = [dir[o], dir[o + 1], dir[o + 2]];
        const r = RADIUS * (1 + h[i] + jitter[i] * 0.03);
        // Thin at the top where the film drains, thick at the bottom,
        // swirling slowly; a moving surface stretches it thinner.
        const nm =
          260 +
          180 * (0.5 - 0.5 * y) +
          60 * Math.sin(1.6 * x + 1.1 * z + time * 0.3) -
          700 * h[i];
        const [cr, cg, cb] = filmOn(ink, filmColor(nm), look.film);
        // Crests catch the light, troughs fall into shade.
        const crest = Math.min(Math.max(h[i] * 14, -0.6), 1);
        const p = i * FLOATS;
        out[p] = x * r;
        out[p + 1] = y * r;
        out[p + 2] = z * r;
        out[p + 3] = cr;
        out[p + 4] = cg;
        out[p + 5] = cb;
        out[p + 6] = look.bright * (1 + crest * 0.9);
        out[p + 7] = look.size * size[i] * (1 + Math.max(0, crest) * 0.4);
      }
    },
  };
};

// ── Drawing ──────────────────────────────────────────────────────────────

const VERTEX = `#version 300 es
precision highp float;
in vec3 aPos;
in vec4 aColor;
in float aSize;
uniform mat3 uRot;
uniform vec2 uFit;
uniform float uPx;
uniform float uFront;
out vec4 vColor;
void main() {
  vec3 p = uRot * aPos;
  vec3 n = normalize(p + vec3(1e-5));
  float rim = pow(1.0 - abs(n.z), 1.4);
  float back = mix(0.3, 1.0, smoothstep(-0.25, 0.25, n.z));
  float a = aColor.a * mix(uFront, 1.0, rim) * back;
  float persp = 1.0 / (1.0 - p.z * 0.28);
  gl_Position = vec4(p.xy * persp * uFit, 0.0, 1.0);
  gl_PointSize = max(1.0, aSize * persp * uPx);
  vColor = vec4(aColor.rgb, clamp(a, 0.0, 1.0));
}
`;

const FRAGMENT = `#version 300 es
precision mediump float;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0 || vColor.a < 0.004) discard;
  float a = vColor.a * (1.0 - smoothstep(0.5, 1.0, d));
  outColor = vec4(vColor.rgb * a, a);
}
`;

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const link = (gl: WebGL2RenderingContext) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = gl.createProgram();
  if (!(vertex && fragment && program)) {
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  return program;
};

export interface MembraneRenderer {
  dispose: () => void;
  draw: (membrane: Membrane, data: Float32Array) => void;
  /** Canvas size in device pixels, and the orb's CSS size. */
  resize: (width: number, height: number, cssSize: number) => void;
}

/** A renderer on `canvas`, or null when the browser has no WebGL2. */
export const createMembraneRenderer = (
  canvas: HTMLCanvasElement,
  count: number
): MembraneRenderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    stencil: false,
  });
  const program = gl ? link(gl) : null;
  if (!(gl && program)) {
    return null;
  }
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, count * FLOATS * 4, gl.DYNAMIC_DRAW);
  const attribute = (name: string, size: number, offset: number) => {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, FLOATS * 4, offset);
  };
  attribute("aPos", 3, 0);
  attribute("aColor", 4, 12);
  attribute("aSize", 1, 28);
  gl.bindVertexArray(null);

  const at = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = {
    fit: at("uFit"),
    front: at("uFront"),
    px: at("uPx"),
    rot: at("uRot"),
  };
  let fit: [number, number] = [1, 1];
  let px = 1;

  return {
    dispose: () => {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
    draw: (membrane, data) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniformMatrix3fv(uniforms.rot, false, membrane.rotation());
      gl.uniform2f(uniforms.fit, fit[0], fit[1]);
      gl.uniform1f(uniforms.px, px);
      gl.uniform1f(uniforms.front, membrane.face());
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.POINTS, 0, membrane.count);
      gl.bindVertexArray(null);
    },
    resize: (width, height, cssSize) => {
      canvas.width = width;
      canvas.height = height;
      const side = Math.min(width, height);
      fit = [side / width, side / height];
      px = (width / Math.max(canvas.clientWidth, 1)) * (cssSize / 360);
    },
  };
};

/**
 * A still membrane on a 2D canvas, for browsers without WebGL2: the same
 * points, rim light and film colour, no motion.
 */
export const drawMembraneStill = (
  canvas: HTMLCanvasElement,
  membrane: Membrane,
  data: Float32Array
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const { height, width } = canvas;
  const half = Math.min(width, height) / 2;
  const px =
    ((width / Math.max(canvas.clientWidth, 1)) *
      Math.min(canvas.clientWidth, canvas.clientHeight)) /
    360;
  const m = membrane.rotation();
  const front = membrane.face();
  ctx.clearRect(0, 0, width, height);
  for (let i = 0; i < membrane.count; i += 1) {
    const o = i * FLOATS;
    const [x, y, z] = [data[o], data[o + 1], data[o + 2]];
    const rx = m[0] * x + m[3] * y + m[6] * z;
    const ry = m[1] * x + m[4] * y + m[7] * z;
    const rz = m[2] * x + m[5] * y + m[8] * z;
    const nz = rz / (Math.hypot(rx, ry, rz) || 1);
    const rim = (1 - Math.abs(nz)) ** 1.4;
    const alpha =
      data[o + 6] * (front + (1 - front) * rim) * (nz < 0 ? 0.3 : 1);
    const [r, g, b] = [data[o + 3], data[o + 4], data[o + 5]].map((c) =>
      Math.round(c * 255)
    );
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${Math.min(alpha, 1)})`;
    ctx.beginPath();
    ctx.arc(
      width / 2 + rx * half,
      height / 2 - ry * half,
      Math.max(0.5, (data[o + 7] * px) / 2),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
};
