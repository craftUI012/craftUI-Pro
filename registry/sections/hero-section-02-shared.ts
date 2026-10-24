import type { ReactNode } from "react";

/* ─────────────────────────────────────────────────────────────────────────
 * Showreel hero: types and wheel geometry, shared by the server section
 * (hero-section-02.tsx) and the client wheel (hero-section-02-wheel.tsx).
 * Plain values only, no "use client": the server reads the layout offsets
 * from here, the client reads the geometry.
 *
 * One circle carries three concentric things:
 *
 *   back lip      a thick, quiet arc inside the band: the back of the drum
 *   image strip   the reels, each frame an annular sector of the band, so
 *                 neighbours share an exact radial edge and the band tiles
 *                 with no gaps and no overlap at any radius
 *   front rim     an accent hairline where the band meets the content side,
 *                 with spokes fanning out from the seams between frames
 *
 * Everything is drawn in DESIGN UNITS on a wheel whose centre sits off the
 * leading edge (the arc opens to the right). A point is always
 *
 *     x = cx + r·cos θ        y = r·sin θ
 *
 * and a frame is always `translate(x, y) rotate(θ)`.
 *
 * There are two wheels. WIDE stands on the left of the copy; NARROW is drawn
 * the same way and then mirrored across the diagonal (x ↔ y), so it lies
 * across the top and opens downward. Mirroring swaps which side of a frame
 * runs along the band, so each wheel sizes its frames for its own
 * orientation: both show a 16:9 picture on screen.
 * ───────────────────────────────────────────────────────────────────────── */

/** Views on one platform: a mark, and the count. */
export interface ShowreelViews {
  /** Read by screen readers ("YouTube views"); the icon stands in for it. */
  platform: string;
  value: string;
  icon?: ReactNode;
}

export interface ShowreelReel {
  /** Image URL, ideally 16:9 (a video still). It's cropped to the frame. */
  src: string;
  alt: string;
  /** What the piece is, in a line or two. Also names the frame. */
  description: string;
  /** Matches a `ShowreelCategory.id`, whose label shows above it. */
  category?: string;
  /** Makes the description a link (a case study, the film itself). */
  href?: string;
  /** Where it was watched, and how much. Two or three read best. */
  views?: ShowreelViews[];
}

/** Names a `ShowreelReel.category` id, shown above its description. */
export interface ShowreelCategory {
  id: string;
  label: string;
}

export const DEG = Math.PI / 180;

/** Half the arc the rims are drawn over; the stage clips beyond it. */
export const SPAN = 44;

/**
 * A sliver of angle on each side of a sector, so neighbours overlap by a
 * hair instead of meeting on an exact edge where antialiasing would let the
 * background through as a seam.
 */
const BLEED = 0.05;

/** Two decimals: enough for a path, short enough to read in devtools. */
const fixed = (value: number) => value.toFixed(2);

interface WheelConfig {
  /** How far past the rim each frame's caption hangs. */
  captionGap: number;
  /** Where the crest frame's centre sits, from the stage's leading edge. */
  crestX: number;
  /** Frame size: `radial` across the band, `tangential` along it. */
  radial: number;
  tangential: number;
  /** Radius to the centre line of the image band. */
  radius: number;
  /** The bezel riding on the outer side of every frame. */
  stripW: number;
  /** How far inside the band the back lip's centre line sits, and its width. */
  lipInset: number;
  lipWidth: number;
  /** How far past the rim the spokes fade out. */
  spokeFade: number;
}

const makeWheel = (config: WheelConfig) => {
  const cx = config.crestX - config.radius;
  const picOuter = config.radius + config.radial / 2;
  const picInner = picOuter - config.radial;
  const rimR = picOuter + config.stripW;

  /**
   * Angular width of one frame in degrees, and so the step between frames.
   * Arc length is s = R·θ: a frame that runs `tangential` along the band
   * spans `tangential / radius`.
   */
  const step = config.tangential / config.radius / DEG;
  const half = (step / 2 + BLEED) * DEG;

  /**
   * One ring of the band between radii r0 and r1, over ±half: the box it's
   * cut from, and the annular sector itself as an SVG path in that box's
   * own coordinates (identical for every frame, so it's built once). The
   * sector's leftmost points are where the inner arc ends (r0·cos half),
   * its rightmost the outer arc's midpoint (r1).
   */
  const ring = (r0: number, r1: number) => {
    const xMin = r0 * Math.cos(half);
    const yMax = r1 * Math.sin(half);
    const point = (r: number, phi: number) =>
      `${fixed(r * Math.cos(phi) - xMin)} ${fixed(r * Math.sin(phi) + yMax)}`;
    const d = `M ${point(r1, -half)} A ${r1} ${r1} 0 0 1 ${point(r1, half)} L ${point(r0, half)} A ${r0} ${r0} 0 0 0 ${point(r0, -half)} Z`;
    return {
      clip: `path("${d}")`,
      d,
      h: 2 * yMax,
      /** Radius of the box's centre, which is what a frame is placed by. */
      rc: (xMin + r1) / 2,
      w: r1 - xMin,
      xMin,
      yMax,
    };
  };

  const pic = ring(picInner, picOuter);
  const bezel = ring(picOuter, rimR);

  /** A point on the wheel at angle `a` (degrees from the crest), radius `r`. */
  const at = (a: number, r: number) => ({
    x: cx + r * Math.cos(a * DEG),
    y: r * Math.sin(a * DEG),
  });

  /** An arc of radius `r` from `a0` to `a1`, as a path command. */
  const arc = (r: number, a0: number, a1: number) => {
    const p = at(a0, r);
    const q = at(a1, r);
    return `M ${fixed(p.x)} ${fixed(p.y)} A ${r} ${r} 0 0 1 ${fixed(q.x)} ${fixed(q.y)}`;
  };

  return {
    arc,
    at,
    bezel,
    /** The bezel's box, in the picture box's coordinates. */
    bezelAt: { left: bezel.xMin - pic.xMin, top: pic.yMax - bezel.yMax },
    config,
    cx,
    lipR: picInner - config.lipInset,
    pic,
    picInner,
    picOuter,
    rimR,
    /** Where the rim crosses the crest line, from the leading edge. */
    rimX: cx + rimR,
    step,
  };
};

export type Wheel = ReturnType<typeof makeWheel>;

/** Beside the copy: frames 224 wide (across the band) by 126 tall (along it). */
export const WIDE = makeWheel({
  captionGap: 36,
  crestX: 300,
  lipInset: 96,
  lipWidth: 160,
  radial: 224,
  radius: 1000,
  spokeFade: 350,
  stripW: 40,
  tangential: 126,
});

/**
 * Above the copy, mirrored: frames run 224 along the band (on screen, their
 * width) by 126 across it. A larger radius keeps the wider frames from
 * bending too hard.
 */
export const NARROW = makeWheel({
  captionGap: 30,
  crestX: 230,
  lipInset: 70,
  lipWidth: 120,
  radial: 126,
  radius: 1100,
  spokeFade: 260,
  stripW: 32,
  tangential: 224,
});

/** Gap from the wide wheel's rim to the copy column. */
const COPY_GAP = 390;

/**
 * Where things sit along the stage's main axis, in design units. The section
 * multiplies these by --reel-s in CSS, so the copy lines up with the wheel
 * before any JavaScript runs.
 */
export const LAYOUT = {
  /** Room for a caption between the rim and the copy. */
  captionWidth: COPY_GAP - WIDE.config.captionGap - 40,
  copyX: WIDE.rimX + COPY_GAP,
  /** The narrow wheel's rim, from the top: its captions hang below it. */
  narrowRim: NARROW.rimX,
};
