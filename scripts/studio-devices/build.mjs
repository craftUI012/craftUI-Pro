// Renders the Studio's device mockups with Blender and packs them for the
// app: `pnpm studio:devices` (Blender must be installed; on a Mac,
// `brew install --cask blender`).
//
// 1. Blender runs phone.py headless, which writes a transparent PNG per view
//    plus the screen's four corners in image pixels.
// 2. sharp trims the empty margin, adds the shadow (below), saves WebP with
//    alpha to public/studio/devices/, and shifts the corners to match.
// 3. The corners and sizes go to components/admin-panel/studio/devices.json,
//    which the Studio reads.
//
// Options: --samples 512 --height 2600 --finish titanium --views front,three-quarter

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT_DIR = path.join(ROOT, "public/studio/devices");
const MANIFEST = path.join(ROOT, "components/admin-panel/studio/devices.json");
const BLENDER_PATHS = [
  process.env.BLENDER,
  "/Applications/Blender.app/Contents/MacOS/Blender",
  "blender",
].filter(Boolean);

const { values } = parseArgs({
  options: {
    finish: { default: "titanium", type: "string" },
    height: { default: "2600", type: "string" },
    samples: { default: "512", type: "string" },
    views: { default: "front,three-quarter", type: "string" },
  },
});

// The shadow, built from the phone's own silhouette as if lit from the top
// left: a tight contact shadow and a soft, wide one under it. Sizes are
// shares of the phone's height. PAD leaves room for the soft one to fade
// out completely, so no edge of the image ever shows on a background.
const SHADOWS = [
  { blur: 0.005, dx: 0.002, dy: 0.005, opacity: 0.32 },
  { blur: 0.025, dx: 0.01, dy: 0.025, opacity: 0.34 },
  { blur: 0.06, dx: 0.02, dy: 0.06, opacity: 0.26 },
];
const PAD = 0.2;

/** An SVG polygon over the screen's corners, for masks. */
const screenSvg = (width, height, corners, color) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><polygon points="${corners
      .map(([x, y]) => `${x},${y}`)
      .join(" ")}" fill="${color}"/></svg>`
  );

/**
 * The phone with its screen hole filled, following the body's own rounded
 * outline: each row is made opaque between its first and last opaque
 * pixel (a phone is convex across every row).
 */
const fillHole = async (phone) => {
  const { data, info } = await sharp(phone)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { height, width } = info;
  for (let y = 0; y < height; y += 1) {
    const row = y * width * 4;
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x += 1) {
      if (data[row + x * 4 + 3] > 127) {
        if (first < 0) {
          first = x;
        }
        last = x;
      }
    }
    for (let x = first + 1; x < last; x += 1) {
      data[row + x * 4 + 3] = 255;
    }
  }
  return sharp(data, { raw: info }).png().toBuffer();
};

/**
 * The phone (trimmed RGBA) over its shadows, on a padded canvas. `screen`
 * is the screen's corners in the trimmed image. The screen is a hole in
 * the phone, so it's filled before the shadow is cast (a solid phone casts
 * a solid shadow) and cut out of the shadow afterwards (the video goes
 * there, and nothing should darken it).
 */
const withShadow = async (phone, width, height, screen) => {
  const pad = Math.round(height * PAD);
  const canvas = { height: height + pad * 2, width: width + pad * 2 };
  const solid = await fillHole(phone);
  const silhouette = await sharp(solid).extractChannel(3).toBuffer();
  const layers = await Promise.all(
    SHADOWS.map(async (shadow) => {
      const sigma = Math.max(0.5, shadow.blur * height);
      // Black with the silhouette as alpha, scaled by the opacity.
      const alpha = await sharp(silhouette)
        .linear(shadow.opacity, 0)
        .extend({
          background: "#000000",
          bottom: pad,
          left: pad,
          right: pad,
          top: pad,
        })
        .blur(sigma)
        .toBuffer();
      const input = await sharp({
        create: { ...canvas, background: { b: 0, g: 0, r: 0 }, channels: 3 },
      })
        .joinChannel(alpha)
        .png()
        .toBuffer();
      return {
        input,
        left: Math.round(shadow.dx * height),
        top: Math.round(shadow.dy * height),
      };
    })
  );
  // Cut the shadow only where the screen is inside the phone: the screen's
  // square corners poke past the phone's rounded ones, and the shadow
  // there should stay.
  const shifted = screen.map(([x, y]) => [x + pad, y + pad]);
  const solidPadded = await sharp(solid)
    .extend({
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      bottom: pad,
      left: pad,
      right: pad,
      top: pad,
    })
    .png()
    .toBuffer();
  const hole = await sharp(
    screenSvg(canvas.width, canvas.height, shifted, "#000")
  )
    .composite([{ blend: "dest-in", input: solidPadded }])
    .png()
    .toBuffer();
  const shadows = await sharp({
    create: {
      ...canvas,
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      channels: 4,
    },
  })
    .composite([...layers, { blend: "dest-out", input: hole }])
    .png()
    .toBuffer();
  return {
    buffer: await sharp(shadows)
      .composite([{ input: phone, left: pad, top: pad }])
      .png()
      .toBuffer(),
    canvas,
    pad,
  };
};

const blender = BLENDER_PATHS.find(
  (candidate) => candidate === "blender" || existsSync(candidate)
);
const work = mkdtempSync(path.join(tmpdir(), "studio-devices-"));

console.log(`Rendering with ${blender} into ${work}…`);
execFileSync(
  blender,
  [
    "-b",
    "-P",
    path.join(import.meta.dirname, "phone.py"),
    "--",
    "--out",
    work,
    "--samples",
    values.samples,
    "--height",
    values.height,
    "--finish",
    values.finish,
    "--views",
    values.views,
  ],
  { stdio: ["ignore", "ignore", "inherit"] }
);

mkdirSync(OUT_DIR, { recursive: true });
const manifest = existsSync(MANIFEST)
  ? JSON.parse(readFileSync(MANIFEST, "utf-8"))
  : {};

for (const view of values.views.split(",").map((v) => v.trim())) {
  const id = `phone-${view}`;
  const meta = JSON.parse(readFileSync(path.join(work, `${id}.json`), "utf-8"));
  // Trim fully transparent margin; a few px of padding keeps the shadow's
  // faint edge from being clipped.
  const { data, info } = await sharp(path.join(work, `${id}.png`))
    .trim({ background: { alpha: 0, b: 0, g: 0, r: 0 }, threshold: 1 })
    .png()
    .toBuffer({ resolveWithObject: true });
  const file = `${id}.webp`;
  // The screen's corners in the trimmed image.
  const trimmed = meta.screen.map(([x, y]) => [
    x + (info.trimOffsetLeft ?? 0),
    y + (info.trimOffsetTop ?? 0),
  ]);
  const { buffer, canvas, pad } = await withShadow(
    data,
    info.width,
    info.height,
    trimmed
  );
  await sharp(buffer)
    .webp({ alphaQuality: 100, effort: 6, quality: 92 })
    .toFile(path.join(OUT_DIR, file));
  const dx = -(info.trimOffsetLeft ?? 0) - pad;
  const dy = -(info.trimOffsetTop ?? 0) - pad;
  manifest[id] = {
    // The phone itself inside the image (the rest is shadow margin): the
    // Studio places and selects the device by this box.
    body: { h: info.height, w: info.width, x: pad, y: pad },
    finish: meta.finish,
    height: canvas.height,
    screen: meta.screen.map(([x, y]) => [
      Math.round((x - dx) * 100) / 100,
      Math.round((y - dy) * 100) / 100,
    ]),
    screenRadius: meta.screenRadius,
    src: `/studio/devices/${file}`,
    view: meta.view,
    viewport: meta.viewport,
    width: canvas.width,
  };
  console.log(`${file}: ${manifest[id].width}×${manifest[id].height}`);
}

const sorted = Object.fromEntries(
  Object.entries(manifest).toSorted(([a], [b]) => a.localeCompare(b))
);
writeFileSync(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`Wrote ${path.relative(ROOT, MANIFEST)}`);
