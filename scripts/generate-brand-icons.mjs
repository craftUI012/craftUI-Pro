// Builds every icon and brand image the site serves from the logo masters in
// public/logo. Run after changing the logo:
//
//   pnpm brand:icons
//
// Masters (exported from Figma, kept as-is):
//   glass-squircle-pair.svg                     the vector mark (navbar, favicon.svg)
//   glass-squircle-pair-transparent-3640w.png   the mark on transparent, for small icons
//   glass-squircle-pair-profile-dark-2048.png   the mark on its dark tile (touch, maskable)
//   glass-squircle-pair-profile-light-2048.png  the mark on its light tile (search results)
//
// Outputs are referenced from seo/metadata.ts, app/manifest.ts, seo/json-ld.tsx
// and the OG image routes.

import { readFile, writeFile } from "node:fs/promises";

import sharp from "sharp";

const LOGO = "public/logo";
const SVG = `${LOGO}/glass-squircle-pair.svg`;
const TRANSPARENT = `${LOGO}/glass-squircle-pair-transparent-3640w.png`;
const DARK = `${LOGO}/glass-squircle-pair-profile-dark-2048.png`;
const LIGHT = `${LOGO}/glass-squircle-pair-profile-light-2048.png`;

// The SVG master's artboard is 91 × 77 with the mark off-centre. Shapes span
// x 17–75 and y 11–64; this square frames them with an even margin.
const SQUARE_VIEWBOX = "16 7.5 60 60";

// The transparent mark, trimmed to its shapes and centred on a square canvas
// with a small margin, so small icons use every pixel.
const squareMark = async () => {
  const { data, info } = await sharp(TRANSPARENT)
    .trim()
    .png()
    .toBuffer({ resolveWithObject: true });
  const side = Math.round(Math.max(info.width, info.height) * 1.04);
  const left = Math.floor((side - info.width) / 2);
  const top = Math.floor((side - info.height) / 2);
  return sharp(data)
    .extend({
      background: { alpha: 0, b: 0, g: 0, r: 0 },
      bottom: side - info.height - top,
      left,
      right: side - info.width - left,
      top,
    })
    .png()
    .toBuffer();
};

const png = (input, size, file) =>
  sharp(input)
    .resize(size, size, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(file);

// An .ico holding PNG-encoded frames (supported by every current browser).
const ico = async (input, sizes, file) => {
  const frames = await Promise.all(
    sizes.map((size) =>
      sharp(input).resize(size, size, { kernel: "lanczos3" }).png().toBuffer()
    )
  );
  const header = Buffer.alloc(6 + 16 * frames.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(frames.length, 4);
  let offset = header.length;
  for (const [index, frame] of frames.entries()) {
    const size = sizes[index];
    const entry = 6 + 16 * index;
    header.writeUInt8(size >= 256 ? 0 : size, entry);
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(frame.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += frame.length;
  }
  await writeFile(file, Buffer.concat([header, ...frames]));
};

// The tile masters with their outer margin cropped, so the mark fills more of
// an app icon (iOS shows the whole square, rounded).
const tile = async (input, keep) => {
  const { width } = await sharp(input).metadata();
  const side = Math.round(width * keep);
  const inset = Math.round((width - side) / 2);
  return sharp(input)
    .extract({ height: side, left: inset, top: inset, width: side })
    .toBuffer();
};

const mark = await squareMark();
const svg = await readFile(SVG, "utf-8");

await Promise.all([
  // Browser tabs. The SVG is the sharpest; the PNGs and .ico are fallbacks.
  writeFile(
    "public/favicon.svg",
    svg.replace(
      /width="[^"]*" height="[^"]*" viewBox="[^"]*"/,
      `width="60" height="60" viewBox="${SQUARE_VIEWBOX}"`
    )
  ),
  ico(mark, [16, 32, 48], "public/favicon.ico"),
  png(mark, 16, "public/favicon-16x16.png"),
  png(mark, 32, "public/favicon-32x32.png"),
  png(mark, 96, "public/favicon-96x96.png"),
  // Home screen and installed app.
  png(await tile(DARK, 0.78), 180, "public/apple-touch-icon.png"),
  png(mark, 192, "public/android-chrome-192x192.png"),
  png(mark, 512, "public/android-chrome-512x512.png"),
  // Maskable: the full dark tile, so the mark sits inside the safe zone.
  png(DARK, 512, "public/android-chrome-maskable-512x512.png"),
  // Organization logo for search results (square, on its light tile).
  png(LIGHT, 512, `${LOGO}/logo-512.png`),
  // The mark for the OG image routes (Satori can't render the SVG's blur).
  png(mark, 256, `${LOGO}/logo-mark-256.png`),
]);

console.log("Brand icons written to public/ and public/logo/.");
