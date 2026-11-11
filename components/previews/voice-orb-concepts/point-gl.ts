// Draws a Sim's point records (shared.ts) with WebGL2: rotation, a little
// perspective, an optional shell rim light and depth fade, crisp discs.

import { FLOATS } from "./shared";
import type { Sim } from "./shared";

const VERTEX = `#version 300 es
precision highp float;
in vec3 aPos;
in vec4 aColor;
in float aSize;
uniform mat3 uRot;
uniform vec2 uFit;
uniform float uPx;
uniform float uRim;
uniform float uFront;
uniform float uDepth;
out vec4 vColor;
void main() {
  vec3 p = uRot * aPos;
  float a = aColor.a;
  vec3 n = normalize(p + vec3(1e-5));
  float rim = pow(1.0 - abs(n.z), 1.4);
  a *= mix(1.0, mix(uFront, 1.0, rim), uRim);
  a *= mix(1.0, mix(0.3, 1.0, smoothstep(-0.3, 0.3, p.z)), uDepth);
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
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
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
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
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

export const createPointRenderer = (
  canvas: HTMLCanvasElement,
  count: number
) => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
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
  const stride = FLOATS * 4;
  const attribute = (name: string, size: number, offset: number) => {
    const location = gl.getAttribLocation(program, name);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
  };
  attribute("aPos", 3, 0);
  attribute("aColor", 4, 12);
  attribute("aSize", 1, 28);
  gl.bindVertexArray(null);

  const at = (name: string) => gl.getUniformLocation(program, name);
  const u = {
    depth: at("uDepth"),
    fit: at("uFit"),
    front: at("uFront"),
    px: at("uPx"),
    rim: at("uRim"),
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
    draw: (sim: Sim, data: Float32Array) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(program);
      gl.uniformMatrix3fv(u.rot, false, rotation(sim.spin, sim.tilt));
      gl.uniform2f(u.fit, fit[0], fit[1]);
      gl.uniform1f(u.px, px);
      gl.uniform1f(u.rim, sim.rim);
      gl.uniform1f(u.front, sim.front);
      gl.uniform1f(u.depth, sim.depth);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.POINTS, 0, sim.count);
      gl.bindVertexArray(null);
    },
    resize: (width: number, height: number, cssSize: number) => {
      canvas.width = width;
      canvas.height = height;
      const side = Math.min(width, height);
      fit = [side / width, side / height];
      px = (width / Math.max(canvas.clientWidth, 1)) * (cssSize / 360);
    },
  };
};
