// The orb's drawing, in plain WebGL2 (no React, no libraries).
//
// One ball of points: each point is a direction on the unit sphere plus a
// few random numbers. Everything that moves is worked out per frame on the
// GPU from a handful of numbers (OrbLook), so a state change in the block is
// only those numbers easing to new values; nothing is rebuilt.
//
//   shell       points sit at radius × (1 + jitter × thickness)
//   rim light   points seen edge-on are bright, points facing you faint,
//               which is what makes a ball of dots read as a ring
//   wobble      slow 3D noise bends the whole ball (music)
//   ripple      faster noise, scaled by the voice level (speech)
//   twinkle     each point's brightness breathes on its own phase
//   iris        a pastel hue around the rim (music)
//
// Points are crisp discs with a 1px soft edge. There is no glow or bloom:
// the brightness comes from how many points overlap.

/** The numbers that make a state's look; the block eases between them. */
export interface OrbLook {
  /** Slow in-out of the radius, 0–1 (thinking). */
  breath: number;
  /** Overall opacity of the points, 0–1. */
  bright: number;
  /** How far each point wanders from its place, in radius units. */
  drift: number;
  /** Opacity of the points facing you, relative to the rim, 0–1. */
  front: number;
  /** Pastel hue around the rim, 0–1. */
  iris: number;
  /** How much the voice level moves the ball, 0–1. */
  levelGain: number;
  /** Radius of the ball, as a share of half the canvas. */
  radius: number;
  /** How quickly brightness falls from the rim to the middle. */
  rimPower: number;
  /** Speech ripple on the surface, scaled by the level, 0–1. */
  ripple: number;
  /** Point diameter in CSS pixels at a 360px orb. */
  size: number;
  /** Turns per second around the vertical axis. */
  spin: number;
  /** Depth of the shell, in radius units. */
  thickness: number;
  /** How much each point's brightness breathes, 0–1. */
  twinkle: number;
  /** Low, slow bend of the whole ball, in radius units. */
  wobble: number;
}

export interface OrbFrame {
  /** Point colour, 0–1 per channel. */
  color: readonly [number, number, number];
  /** Smoothed voice level, 0–1. */
  level: number;
  look: OrbLook;
  /** Rotation around the vertical axis, in radians. */
  spin: number;
  /** Seconds since start; held still under reduced motion. */
  time: number;
}

export interface OrbRenderer {
  dispose: () => void;
  draw: (frame: OrbFrame) => void;
  /** Canvas size in device pixels, and the orb's CSS size. */
  resize: (width: number, height: number, cssSize: number) => void;
}

/** The ball's forward tilt, so the top reads as a lid, in radians. */
const TILT = 0.32;

/** Points per orb. */
export const ORB_POINTS = 9000;

// ── Point cloud ──────────────────────────────────────────────────────────
// Deterministic, so the same orb draws the same every load.
/** A seeded sequence of 0–1 numbers (a sine hash: plenty for scatter). */
const seeded = (seed: number) => {
  let n = seed;
  return () => {
    n += 1;
    const x = Math.sin(n * 12.9898 + seed * 78.233) * 43_758.5453;
    return x - Math.floor(x);
  };
};

/** Mostly fine points, some larger ones and a few flakes that sparkle. */
const sizeFactor = (roll: number, spread: number) => {
  if (roll < 0.86) {
    return 0.5 + spread * 0.4;
  }
  if (roll < 0.97) {
    return 0.9 + spread * 0.4;
  }
  return 1.4 + spread * 0.5;
};

/**
 * Per point: direction (xyz) then jitter, size, phase, rate (4 numbers).
 * Directions follow a Fibonacci sphere, nudged so no lattice shows.
 */
export const orbPoints = (count = ORB_POINTS) => {
  const random = seeded(7);
  const data = new Float32Array(count * 7);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const ring = Math.sqrt(1 - y * y);
    const angle = i * golden;
    let x = Math.cos(angle) * ring + (random() - 0.5) * 0.06;
    let z = Math.sin(angle) * ring + (random() - 0.5) * 0.06;
    let yy = y + (random() - 0.5) * 0.06;
    const length = Math.hypot(x, yy, z) || 1;
    x /= length;
    yy /= length;
    z /= length;
    // Three rolls summed: most points near the middle of the shell.
    const jitter = (random() + random() + random() - 1.5) / 1.5;
    const o = i * 7;
    data[o] = x;
    data[o + 1] = yy;
    data[o + 2] = z;
    data[o + 3] = jitter;
    data[o + 4] = sizeFactor(random(), random());
    data[o + 5] = random();
    data[o + 6] = random();
  }
  return data;
};

/** The 3×3 rotation (column-major) for a spin, then the fixed tilt. */
export const orbRotation = (spin: number) => {
  const cy = Math.cos(spin);
  const sy = Math.sin(spin);
  const cx = Math.cos(TILT);
  const sx = Math.sin(TILT);
  // Rx(TILT) · Ry(spin)
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

/**
 * A still orb on a 2D canvas, for browsers without WebGL2: the same points
 * and rim light, no motion. `width`/`height` are device pixels.
 */
export const drawOrbStill = (
  canvas: HTMLCanvasElement,
  color: readonly [number, number, number],
  look: OrbLook
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  const { height, width } = canvas;
  const half = Math.min(width, height) / 2;
  // Device pixels per CSS pixel at a 360px orb, as in the shader.
  const px =
    ((width / Math.max(canvas.clientWidth, 1)) *
      Math.min(canvas.clientWidth, canvas.clientHeight)) /
    360;
  const points = orbPoints(2600);
  const m = orbRotation(0.6);
  const [r, g, b] = color.map((c) => Math.round(c * 255));
  ctx.clearRect(0, 0, width, height);
  for (let o = 0; o < points.length; o += 7) {
    const [x, y, z] = [points[o], points[o + 1], points[o + 2]];
    const nx = m[0] * x + m[3] * y + m[6] * z;
    const ny = m[1] * x + m[4] * y + m[7] * z;
    const nz = m[2] * x + m[5] * y + m[8] * z;
    const radius = look.radius * (1 + points[o + 3] * look.thickness);
    const rim = (1 - Math.abs(nz)) ** look.rimPower;
    const alpha = look.bright * (look.front + (1 - look.front) * rim);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * (nz < 0 ? 0.3 : 1)})`;
    ctx.beginPath();
    ctx.arc(
      width / 2 + nx * radius * half,
      height / 2 - ny * radius * half,
      Math.max(0.5, (look.size * points[o + 4] * px) / 2),
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
};

// ── Shaders ──────────────────────────────────────────────────────────────
// Simplex noise: Ashima Arts / Stefan Gustavson (MIT).
const NOISE = `
vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + 2.0 * C.xxx;
  vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0 / 7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

const VERTEX = `#version 300 es
precision highp float;
in vec3 aDir;
in vec4 aSeed; // jitter, size, phase, rate
uniform mat3 uRot;
uniform vec2 uFit;      // clip units per radius unit, x and y
uniform float uPx;      // device pixels per CSS pixel at a 360px orb
uniform float uTime;
uniform float uLevel;
uniform vec3 uColor;
// look
uniform float uBreath, uBright, uDrift, uFront, uIris, uRadius, uRimPower;
uniform float uRipple, uSize, uThickness, uTwinkle, uWobble;
out float vAlpha;
out vec3 vColor;
${NOISE}
void main() {
  vec3 d = aDir;
  float t = uTime;
  float bend = snoise(d * 1.35 + vec3(0.0, t * 0.32, t * 0.21));
  float ripple = snoise(d * 2.8 + vec3(t * 0.9, -t * 0.7, t * 0.5));
  float r = uRadius * (
    1.0
    + uLevel * 0.05
    + sin(t * 1.9) * 0.018 * uBreath
    + bend * uWobble
    + ripple * uRipple * uLevel * 0.07
    + aSeed.x * (uThickness + uLevel * 0.035)
  );
  vec3 p = d * r;
  float ph = aSeed.z * 6.2831;
  p += uDrift * vec3(sin(t * 0.7 + ph), cos(t * 0.61 + ph * 1.3), sin(t * 0.53 + ph * 0.7));
  p = uRot * p;
  vec3 n = uRot * d;

  float rim = pow(1.0 - abs(n.z), uRimPower);
  float back = mix(0.3, 1.0, smoothstep(-0.25, 0.25, n.z));
  float twinkle = 1.0 - uTwinkle * 0.5 * (1.0 + sin(t * (1.2 + aSeed.w * 2.4) + ph));
  vAlpha = clamp((uBright + uLevel * 0.22) * mix(uFront, 1.0, rim) * back * twinkle, 0.0, 1.0);

  // Iris: cyan → lilac → pink around the rim, turning slowly. On light
  // themes (dark points) the same hues, deeper, so they hold on white.
  float hue = fract(atan(n.y, n.x) / 6.2831 + t * 0.04) * 3.0;
  vec3 cyan = vec3(0.56, 0.86, 1.0);
  vec3 lilac = vec3(0.78, 0.68, 1.0);
  vec3 pink = vec3(1.0, 0.72, 0.88);
  vec3 tint = hue < 1.0 ? mix(cyan, lilac, hue)
    : hue < 2.0 ? mix(lilac, pink, hue - 1.0)
    : mix(pink, cyan, hue - 2.0);
  float light = dot(uColor, vec3(0.2126, 0.7152, 0.0722));
  tint *= mix(0.58, 1.0, light);
  vColor = mix(uColor, tint, clamp(uIris * (0.35 + 0.65 * rim), 0.0, 1.0));

  float persp = 1.0 / (1.0 - p.z * 0.28);
  gl_Position = vec4(p.xy * persp * uFit, 0.0, 1.0);
  gl_PointSize = max(1.0, uSize * aSeed.y * persp * uPx * (1.0 + uLevel * 0.3));
}
`;

const FRAGMENT = `#version 300 es
precision mediump float;
in float vAlpha;
in vec3 vColor;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float d = dot(c, c);
  if (d > 1.0 || vAlpha < 0.004) discard;
  float a = vAlpha * (1.0 - smoothstep(0.5, 1.0, d));
  outColor = vec4(vColor * a, a);
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
  if (!vertex || !fragment || !program) {
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

const LOOK_UNIFORMS = {
  breath: "uBreath",
  bright: "uBright",
  drift: "uDrift",
  front: "uFront",
  iris: "uIris",
  radius: "uRadius",
  rimPower: "uRimPower",
  ripple: "uRipple",
  size: "uSize",
  thickness: "uThickness",
  twinkle: "uTwinkle",
  wobble: "uWobble",
} as const satisfies Partial<Record<keyof OrbLook, string>>;

/** A renderer on `canvas`, or null when the browser has no WebGL2. */
export const createOrbRenderer = (
  canvas: HTMLCanvasElement
): OrbRenderer | null => {
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

  const points = orbPoints();
  const vao = gl.createVertexArray();
  const buffer = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
  const stride = 7 * 4;
  const dir = gl.getAttribLocation(program, "aDir");
  const seed = gl.getAttribLocation(program, "aSeed");
  gl.enableVertexAttribArray(dir);
  gl.vertexAttribPointer(dir, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(seed);
  gl.vertexAttribPointer(seed, 4, gl.FLOAT, false, stride, 3 * 4);
  gl.bindVertexArray(null);

  const at = (name: string) => gl.getUniformLocation(program, name);
  const uniforms = {
    color: at("uColor"),
    fit: at("uFit"),
    level: at("uLevel"),
    px: at("uPx"),
    rot: at("uRot"),
    time: at("uTime"),
  };
  const look = Object.fromEntries(
    Object.entries(LOOK_UNIFORMS).map(([key, name]) => [key, at(name)])
  ) as Record<keyof typeof LOOK_UNIFORMS, WebGLUniformLocation | null>;

  let fit: [number, number] = [1, 1];
  let px = 1;

  return {
    dispose: () => {
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
    },
    draw: (frame) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniformMatrix3fv(uniforms.rot, false, orbRotation(frame.spin));
      gl.uniform2f(uniforms.fit, fit[0], fit[1]);
      gl.uniform1f(uniforms.px, px);
      gl.uniform1f(uniforms.time, frame.time);
      gl.uniform1f(uniforms.level, frame.level * frame.look.levelGain);
      gl.uniform3f(uniforms.color, ...frame.color);
      for (const key of Object.keys(LOOK_UNIFORMS) as (keyof typeof look)[]) {
        gl.uniform1f(look[key], frame.look[key]);
      }
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.POINTS, 0, points.length / 7);
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
