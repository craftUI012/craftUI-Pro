/* ─────────────────────────────────────────────────────────────────────────
 * The image sphere's renderer: plain WebGL2, no library.
 *
 * Every card is one instance of a single quad, so the whole sphere is one
 * draw call. The images share one texture, an atlas: each image gets a
 * square cell, drawn into it at its own aspect ratio ("contain"), with a
 * transparent gutter so mipmaps don't bleed between neighbours. Images
 * arrive one by one and are copied into their cell as they load; the atlas
 * is never rebuilt.
 *
 * Per card, from the scene (image-sphere-scene.ts), in CSS pixels:
 *
 *   transform   a 2×2 matrix: foreshortening, stretch, squash, rotation
 *   light       shade from the light, a rim highlight, paleness toward
 *               the page colour (cards stay opaque: depth by occlusion)
 *   back        far-side cards show their blank paper back
 *   blur        a mipmap bias: out of focus without a blur pass, and the
 *               way a loading image comes into focus
 *   shadow      a soft contact shadow, drawn as its own instance just
 *               before the card, offset and softened by its height
 *   edge        what lifts a card off the page: a hairline ring where it
 *               meets the background, a one-pixel highlight along its top
 *               edge (light from above catching its thickness), and a
 *               slight shade inside its bottom edge. Set for light and dark
 *               pages; faded out on tiny, far or out-of-focus cards
 * ───────────────────────────────────────────────────────────────────────── */

/** Largest atlas cell, in texels: sharp enough for the cluster's big cards. */
const CELL_MAX = 256;
/** Transparent border inside each cell, wide enough for blurred mip levels. */
const GUTTER = 12;
/** Widest and tallest aspect a card keeps; past these the image is cropped. */
export const ASPECT_MIN = 0.62;
export const ASPECT_MAX = 1.78;
/** Mip levels of blur a loading image starts at. */
const LOAD_BLUR = 3.5;

/**
 * The card edge, per page tone. ring: hairline colour and strength; lip:
 * top highlight strength; shade: bottom inner shade strength and how far
 * up the card it reaches (share of its height).
 */
const EDGE = {
  dark: { lip: 0.16, ring: [1, 1, 1, 0.1], shade: 0.2 },
  light: { lip: 0.3, ring: [0, 0, 0, 0.09], shade: 0.12 },
  /** Shade reach, as a share of the card's height. */
  shadeReach: 0.18,
  /** Cards smaller than this (px, shorter side) get no edge… */
  sizeFrom: 14,
  /** …and the full edge from this size up. */
  sizeTo: 48,
} as const;

/** Floats per instance: box (4), matrix (4), uv (4), look (4), light (4). */
const STRIDE = 20;

const VERTEX = `#version 300 es
layout(location = 0) in vec2 a_corner;
layout(location = 1) in vec4 a_box;
layout(location = 2) in vec4 a_mat;
layout(location = 3) in vec4 a_uv;
layout(location = 4) in vec4 a_look;
layout(location = 5) in vec4 a_light;
uniform vec2 u_view;
out vec2 v_local;
out vec2 v_half;
out vec2 v_uv;
out vec4 v_look;
out vec4 v_light;
out float v_soft;
void main() {
  // a_light.w: -1 for a card, its height (0+) for its shadow.
  float elev = a_light.w;
  bool shadow = elev >= 0.0;
  float soft = shadow ? 2.0 + 16.0 * elev : 0.0;
  vec2 local = a_corner * (a_box.zw + soft * 2.0);
  // Light falls from above, so the shadow drops straight down.
  vec2 drop = shadow ? vec2(0.0, 1.5 + 12.0 * elev) : vec2(0.0);
  vec2 p = a_box.xy + mat2(a_mat.xy, a_mat.zw) * local + drop;
  v_local = local;
  v_half = a_box.zw * 0.5;
  v_uv = mix(a_uv.xy, a_uv.zw, a_corner + 0.5);
  v_look = a_look;
  v_light = a_light;
  v_soft = soft;
  vec2 clip = p / u_view * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision mediump float;
uniform sampler2D u_atlas;
uniform vec3 u_paper;
uniform vec3 u_page;
uniform vec4 u_ring;
uniform float u_lip;
uniform float u_shade;
in vec2 v_local;
in vec2 v_half;
in vec2 v_uv;
in vec4 v_look;
in vec4 v_light;
in float v_soft;
out vec4 o_color;
float roundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  float r = min(v_half.x, v_half.y) * 0.12;
  float d = roundBox(v_local, v_half, r);
  float alpha = v_look.x;
  if (v_light.w >= 0.0) {
    float strength = (0.08 + 0.16 * min(v_light.w, 1.0)) * alpha;
    o_color = vec4(0.0, 0.0, 0.0, 1.0) * (1.0 - smoothstep(-v_soft, v_soft, d)) * strength;
    return;
  }
  // Antialiased in screen pixels, whatever the transform did to the card.
  float cover = clamp(0.5 - d / max(fwidth(d), 1e-4), 0.0, 1.0);
  vec4 tex = texture(u_atlas, v_uv, v_look.z);
  // The image is printed on paper: where it's transparent, paper shows.
  vec3 front = tex.rgb + u_paper * (1.0 - tex.a);
  vec3 color = mix(u_paper, front, v_look.y);
  color = mix(color, u_paper, v_look.w);
  color = color * v_light.x + v_light.y;

  // The edge, in screen pixels: a hairline ring, a highlight along the
  // top edge, a shade inside the bottom one. Only on a card's face, and
  // fading on small, pale or blurred cards.
  float pixel = max(fwidth(d), 1e-4);
  float inside = clamp(-d / pixel, 0.0, 1.0);
  float size = min(v_half.x, v_half.y) * 2.0;
  float show = smoothstep(${EDGE.sizeFrom.toFixed(1)}, ${EDGE.sizeTo.toFixed(1)}, size)
    * (1.0 - v_look.w) * (1.0 - v_light.z) * (1.0 - min(v_look.z / 3.0, 0.7));
  float fromTop = (v_local.y + v_half.y) / pixel;
  float fromBottom = v_half.y - v_local.y;
  float lip = (1.0 - smoothstep(0.0, 2.0, fromTop)) * inside;
  float shade = 1.0 - smoothstep(0.0, v_half.y * ${(EDGE.shadeReach * 2).toFixed(2)}, fromBottom);
  color *= 1.0 - shade * u_shade * show;
  color += lip * u_lip * show;
  color = mix(color, u_ring.rgb, (1.0 - inside) * u_ring.a * show);

  color = mix(color, u_page, v_light.z);
  o_color = vec4(color, 1.0) * cover * alpha;
}`;

/** What the renderer draws: the scene's arrays, read in `order`. */
export interface SpriteList {
  count: number;
  order: Uint16Array;
  item: Uint16Array;
  x: Float32Array;
  y: Float32Array;
  w: Float32Array;
  h: Float32Array;
  mat: Float32Array;
  alpha: Float32Array;
  shade: Float32Array;
  rim: Float32Array;
  fog: Float32Array;
  back: Float32Array;
  blur: Float32Array;
  elev: Float32Array;
  /** Per item, not per card: how far its image has loaded in. */
  fade: Float32Array;
}

type Rgb = [number, number, number];

export interface SphereRenderer {
  /** Copies a loaded image into its cell. Returns the aspect it was drawn at. */
  setImage: (item: number, image: HTMLImageElement) => number;
  /** The cards' paper and the page behind them, as 0–1 RGB. */
  setColors: (paper: Rgb, page: Rgb) => void;
  draw: (sprites: SpriteList, width: number, height: number) => void;
  dispose: () => void;
}

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

/** Writes card i's instance at offset o; `elev` -1 for the card itself. */
const writeInstance = (
  data: Float32Array,
  o: number,
  s: SpriteList,
  i: number,
  uvs: Float32Array,
  elev: number
) => {
  const item = s.item[i];
  const fade = s.fade[item];
  data[o] = s.x[i];
  data[o + 1] = s.y[i];
  data[o + 2] = s.w[i];
  data[o + 3] = s.h[i];
  data[o + 4] = s.mat[i * 4];
  data[o + 5] = s.mat[i * 4 + 1];
  data[o + 6] = s.mat[i * 4 + 2];
  data[o + 7] = s.mat[i * 4 + 3];
  data[o + 8] = uvs[item * 4];
  data[o + 9] = uvs[item * 4 + 1];
  data[o + 10] = uvs[item * 4 + 2];
  data[o + 11] = uvs[item * 4 + 3];
  data[o + 12] = s.alpha[i];
  // Colour arrives fast; sharpness follows, like a lens finding focus.
  data[o + 13] = Math.min(fade * 2.5, 1);
  data[o + 14] = s.blur[i] + (1 - fade) * LOAD_BLUR;
  data[o + 15] = s.back[i];
  data[o + 16] = s.shade[i];
  data[o + 17] = s.rim[i];
  data[o + 18] = s.fog[i];
  data[o + 19] = elev;
};

/**
 * A renderer for `itemCount` distinct images, or null when the browser has
 * no WebGL2 (the block then shows its plain grid instead).
 */
export const createSphereRenderer = (
  canvas: HTMLCanvasElement,
  itemCount: number
): SphereRenderer | null => {
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    stencil: false,
  });
  if (!gl) {
    return null;
  }
  const program = link(gl);
  if (!program) {
    return null;
  }

  // ── Atlas ──────────────────────────────────────────────────────────────
  // A grid of square cells, as near square overall as the count allows,
  // shrunk only if it wouldn't fit the GPU's largest texture.
  const items = Math.max(itemCount, 1);
  const cols = Math.ceil(Math.sqrt(items));
  const rows = Math.ceil(items / cols);
  const maxSize = Math.min(
    gl.getParameter(gl.MAX_TEXTURE_SIZE) as number,
    4096
  );
  const cell = Math.min(CELL_MAX, Math.floor(maxSize / Math.max(cols, rows)));
  const atlasW = cols * cell;
  const atlasH = rows * cell;
  const levels = Math.floor(Math.log2(Math.max(atlasW, atlasH))) + 1;

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // Starts fully transparent (WebGL zero-fills new textures).
  gl.texStorage2D(gl.TEXTURE_2D, levels, gl.RGBA8, atlasW, atlasH);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Cards turned side-on are squeezed one way only; anisotropic filtering
  // keeps them sharp along the other, where plain mipmaps would blur them.
  const anisotropic = gl.getExtension("EXT_texture_filter_anisotropic");
  if (anisotropic) {
    const most = gl.getParameter(
      anisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT
    ) as number;
    gl.texParameterf(
      gl.TEXTURE_2D,
      anisotropic.TEXTURE_MAX_ANISOTROPY_EXT,
      Math.min(8, most)
    );
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  // Each item's rectangle in the atlas, filled in as its image lands.
  const uvs = new Float32Array(items * 4);
  let mipsDirty = false;

  // Scratch canvas the images are scaled into before upload.
  const scratch = document.createElement("canvas");
  const scratchCtx = scratch.getContext("2d");

  const setImage = (item: number, image: HTMLImageElement) => {
    const natural = image.naturalWidth / Math.max(image.naturalHeight, 1);
    const aspect = Math.min(Math.max(natural, ASPECT_MIN), ASPECT_MAX);
    if (!scratchCtx || item >= items) {
      return aspect;
    }
    // Crop the source to the clamped aspect, centred.
    let sw = image.naturalWidth;
    let sh = image.naturalHeight;
    if (natural > aspect) {
      sw = sh * aspect;
    } else if (natural < aspect) {
      sh = sw / aspect;
    }
    const sx = (image.naturalWidth - sw) / 2;
    const sy = (image.naturalHeight - sh) / 2;

    const inner = cell - GUTTER * 2;
    const w = aspect >= 1 ? inner : Math.round(inner * aspect);
    const h = aspect >= 1 ? Math.round(inner / aspect) : inner;
    scratch.width = w;
    scratch.height = h;
    scratchCtx.imageSmoothingQuality = "high";
    scratchCtx.drawImage(image, sx, sy, sw, sh, 0, 0, w, h);

    const x = (item % cols) * cell + GUTTER;
    const y = Math.floor(item / cols) * cell + GUTTER;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texSubImage2D(
      gl.TEXTURE_2D,
      0,
      x,
      y,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      scratch
    );
    mipsDirty = true;

    // Half a texel in from the edge, so filtering never reaches the gutter.
    uvs[item * 4] = (x + 0.5) / atlasW;
    uvs[item * 4 + 1] = (y + 0.5) / atlasH;
    uvs[item * 4 + 2] = (x + w - 0.5) / atlasW;
    uvs[item * 4 + 3] = (y + h - 0.5) / atlasH;
    return aspect;
  };

  // ── Geometry ───────────────────────────────────────────────────────────
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]),
    gl.STATIC_DRAW
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const instances = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  const bytes = STRIDE * 4;
  for (let location = 1; location <= 5; location += 1) {
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(
      location,
      4,
      gl.FLOAT,
      false,
      bytes,
      (location - 1) * 16
    );
    gl.vertexAttribDivisor(location, 1);
  }
  gl.bindVertexArray(null);

  let data = new Float32Array(0);

  const uView = gl.getUniformLocation(program, "u_view");
  const uAtlas = gl.getUniformLocation(program, "u_atlas");
  const uPaper = gl.getUniformLocation(program, "u_paper");
  const uPage = gl.getUniformLocation(program, "u_page");
  const uRing = gl.getUniformLocation(program, "u_ring");
  const uLip = gl.getUniformLocation(program, "u_lip");
  const uShade = gl.getUniformLocation(program, "u_shade");

  let paper: Rgb = [0.9, 0.9, 0.9];
  let page: Rgb = [1, 1, 1];

  const draw = (sprites: SpriteList, width: number, height: number) => {
    const { count, order } = sprites;
    // Up to two instances per card: its shadow, then itself.
    if (data.length < count * 2 * STRIDE) {
      data = new Float32Array(count * 2 * STRIDE);
    }
    // Written back to front, so blending needs no depth buffer.
    let n = 0;
    for (let k = 0; k < count; k += 1) {
      const i = order[k];
      if (sprites.alpha[i] > 0.002) {
        if (sprites.elev[i] > 0.002) {
          writeInstance(data, n * STRIDE, sprites, i, uvs, sprites.elev[i]);
          n += 1;
        }
        writeInstance(data, n * STRIDE, sprites, i, uvs, -1);
        n += 1;
      }
    }

    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (n === 0) {
      return;
    }

    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (mipsDirty) {
      gl.generateMipmap(gl.TEXTURE_2D);
      mipsDirty = false;
    }
    gl.uniform1i(uAtlas, 0);
    gl.uniform2f(uView, width, height);
    gl.uniform3f(uPaper, paper[0], paper[1], paper[2]);
    gl.uniform3f(uPage, page[0], page[1], page[2]);
    // The edge follows the page: light on dark pages, dark on light ones.
    const luminance = 0.2126 * page[0] + 0.7152 * page[1] + 0.0722 * page[2];
    const edge = luminance < 0.5 ? EDGE.dark : EDGE.light;
    gl.uniform4f(uRing, edge.ring[0], edge.ring[1], edge.ring[2], edge.ring[3]);
    gl.uniform1f(uLip, edge.lip);
    gl.uniform1f(uShade, edge.shade);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, instances);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      data.subarray(0, n * STRIDE),
      gl.DYNAMIC_DRAW
    );
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
    gl.bindVertexArray(null);
  };

  const dispose = () => {
    gl.deleteBuffer(corners);
    gl.deleteBuffer(instances);
    gl.deleteVertexArray(vao);
    gl.deleteTexture(texture);
    gl.deleteProgram(program);
  };

  return {
    dispose,
    draw,
    setColors: (nextPaper, nextPage) => {
      paper = nextPaper;
      page = nextPage;
    },
    setImage,
  };
};
