"use client";

import { EASE, FacePath, Rig, roundedRect, sample } from "./iso-core";
import type { IsoKey, IsoPose, IsoTrack, Vec3 } from "./iso-core";
import {
  ARC,
  ICON,
  LINE,
  LineState,
  faceFill,
  onClock,
  r2,
  useLineShell,
  viewBounds,
} from "./iso-line";
import type { LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * "No certificates yet", told by one object in line: a certificate facing
 * the screen (a quiet inset border, a title, lines of text, a signature)
 * whose round seal, two ribbon tails under it, is stamped onto the page.
 * Use: empty state. Move: a stamp: lifted toward the viewer (it grows),
 * pressed down with a small squash, the page giving under it, the ribbons
 * swinging after it. Each value is ms after the art comes into view.
 *
 *    0ms   the certificate stands still, its seal on the page
 *  400ms   the seal lifts off toward the viewer: it grows 30% and rises
 *          0.25 units, its ribbons with it (300ms, a soft pop)
 *  700ms   it hangs there (200ms)
 *  900ms   it comes down hard (140ms, speeding up)
 * 1040ms   it lands: squashes 10% (volume kept) and springs back; the
 *          page gives 3% under it and comes back (340ms)
 * 1100ms   the ribbons swing 5°, then 3°, 1.5° the other ways, the right
 *          one 50ms behind the left (560ms)
 * 1710ms   still: exactly as it started
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true.
 * Reduced motion, or `active` false before any play: the certificate,
 * sealed.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  again: 80,
  // The seal comes down this long.
  down: 140,
  // It hangs lifted this long.
  hang: 200,
  // How far the right ribbon lags the left.
  lag: 50,
  // It lifts this long.
  lift: 300,
  start: 400,
};

/* How far things move. */
const MOVE = {
  // The page's size as it gives under the stamp.
  give: 0.97,
  // How much the seal grows as it lifts toward the viewer.
  grow: 1.3,
  // How far it rises as it lifts, world units.
  rise: 0.25,
  // Its height as it lands (its width grows to keep its volume).
  squash: 0.9,
};

// The ribbons' swing after the landing: degrees, each one smaller.
const SWINGS = [
  { deg: 5, ms: 150 },
  { deg: -3, ms: 150 },
  { deg: 1.5, ms: 130 },
  { deg: 0, ms: 130 },
] as const;

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// Built facing +y about x = 0: the page is a face on the plane y = 0
// (paper is a face, not a solid), its foot 0.75 up so the ribbons can hang
// below it to z = 0.
const PAGE = { h: 6.5, w: 8, z: 0.75 };
const PAGE_AT: Vec3 = [-PAGE.w / 2, 0, PAGE.z + PAGE.h];
const PAGE_MID: Vec3 = [0, 0, PAGE.z + PAGE.h / 2];

// Everything on the page in face units (u right, v down from its top-left
// corner).

// The inset border: a quiet line half a unit in from the edge, its
// corners cut in as quarter circles.
const BORDER = { inset: 0.5, r: 0.5 };

// The title, a pill; a short line under it; the long name line; a
// signature over its line at the lower left.
const TITLE = { h: 0.5, u: 2.25, v: 1.25, w: 3.5 };
const RULES = [
  { len: 2, u: 3, v: 2.25 },
  { len: 5, u: 1.5, v: 3 },
  { len: 2.5, u: 1.25, v: 5 },
] as const;
const SIGNATURE =
  "M1.5 4.75 C1.75 4.25 1.9 4.95 2.15 4.6 C2.4 4.25 2.55 4.85 2.8 4.5 C2.95 4.3 3.1 4.55 3.25 4.4";

// The seal at the lower right, the one brand mark: a scalloped disc with a
// ring pressed into it.
const SEAL = { bumps: 18, inner: 0.88, outer: 1, ring: 0.62, u: 6, v: 4.5 };
const SEAL_AT: Vec3 = [PAGE_AT[0] + SEAL.u, 0, PAGE_AT[2] - SEAL.v];

// The two ribbon tails hanging from behind the seal, past the page's foot,
// each cut with a notch: [u, v] corners, top left round to top right.
const TAILS = [
  [
    [5.25, 4.75],
    [5.75, 4.75],
    [5.35, 7.25],
    [5.1, 6.95],
    [4.85, 7.25],
  ],
  [
    [6.25, 4.75],
    [6.75, 4.75],
    [7.15, 7.25],
    [6.9, 6.95],
    [6.65, 7.25],
  ],
] as const;

// The frame fits the page and the ribbon ends at rest.
const EXTENT: Vec3[] = [
  [-PAGE.w / 2, 0, 0],
  [PAGE.w / 2, 0, 0],
  [-PAGE.w / 2, 0, PAGE.z + PAGE.h],
  [PAGE.w / 2, 0, PAGE.z + PAGE.h],
];
const BOUNDS = viewBounds("front", EXTENT);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

interface Clip {
  end: number;
  /** The seal's size, 1 at rest. */
  grow: IsoTrack;
  /** How far the seal is lifted, world units (never below 0). */
  rise: IsoTrack;
  /** The seal's height scale as it lands. */
  squash: IsoTrack;
  /** The page's size as it gives. */
  give: IsoTrack;
  /** Each ribbon's swing, degrees. */
  swings: IsoTrack[];
}

const beat = (t0: number): Clip => {
  const up = t0 + TIMING.lift;
  const fall = up + TIMING.hang;
  const land = fall + TIMING.down;
  const grow: IsoKey[] = [
    [t0, 1, EASE.soft],
    [up, MOVE.grow, "hold"],
    [fall, MOVE.grow, EASE.in],
    [land, 1],
  ];
  const rise: IsoKey[] = [
    [t0, 0, EASE.soft],
    [up, MOVE.rise, "hold"],
    [fall, MOVE.rise, EASE.in],
    [land, 0],
  ];
  const squash: IsoKey[] = [
    [land, 1, EASE.drop],
    [land + 80, MOVE.squash, EASE.easy],
    [land + 200, 1.03, EASE.easy],
    [land + 300, 1],
  ];
  const give: IsoKey[] = [
    [land, 1, EASE.drop],
    [land + 90, MOVE.give, EASE.easy],
    [land + 220, 1.01, EASE.easy],
    [land + 340, 1],
  ];
  const swing = (lag: number, side: number): IsoTrack => {
    const keys: IsoKey[] = [[land + lag, 0, EASE.drop]];
    let t = land + lag;
    for (const { deg, ms } of SWINGS) {
      t += ms;
      keys.push([t, deg * side, EASE.easy]);
    }
    return keys;
  };
  const swings = [swing(60, 1), swing(60 + TIMING.lag, -1)];
  const end = land + 60 + TIMING.lag + SWINGS.reduce((s, w) => s + w.ms, 0);
  return { end, give, grow, rise, squash, swings };
};

const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const pagePose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = r2(sample(clip.give, ms));
    return { scale: [k, 1, k] };
  };

const sealPose =
  (clip: Clip) =>
  (ms: number): IsoPose => {
    const k = sample(clip.grow, ms);
    const s = sample(clip.squash, ms);
    // Volume is kept: as it squashes in height it widens.
    const w = 1 / Math.sqrt(s);
    return {
      offset: [0, 0, r2(sample(clip.rise, ms))],
      scale: [r2(k * w), 1, r2(k * s)],
    };
  };

const tailPose =
  (clip: Clip, i: number) =>
  (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.swings[i], ms)),
  });

/* ───────────────────────────── Pieces ─────────────────────────────────── */

/** The inset border: a rectangle with its corners cut in as quarter circles. */
const borderPath = () => {
  const { inset: i, r } = BORDER;
  const k = r2(r * ARC);
  const R = PAGE.w - i;
  const B = PAGE.h - i;
  return [
    `M${i + r} ${i}`,
    `H${R - r}`,
    `C${R - r} ${i + k} ${R - k} ${i + r} ${R} ${i + r}`,
    `V${B - r}`,
    `C${R - k} ${B - r} ${R - r} ${B - k} ${R - r} ${B}`,
    `H${i + r}`,
    `C${i + r} ${B - k} ${i + k} ${B - r} ${i} ${B - r}`,
    `V${i + r}`,
    `C${i + k} ${i + r} ${i + r} ${i + k} ${i + r} ${i}`,
    "Z",
  ].join(" ");
};

/** The seal's scalloped edge: bumps as quadratic curves between valleys. */
const sealPath = () => {
  const { bumps: n, inner, outer, u, v } = SEAL;
  const step = (Math.PI * 2) / n;
  // A quadratic's middle is half its control point and half its chord's
  // middle: this control point puts each bump's crest on the outer radius.
  const reach = 2 * outer - inner * Math.cos(step / 2);
  const at = (a: number, rr: number) =>
    `${r2(u + rr * Math.cos(a))} ${r2(v + rr * Math.sin(a))}`;
  const parts = [`M${at(0, inner)}`];
  for (let i = 0; i < n; i += 1) {
    parts.push(`Q${at((i + 0.5) * step, reach)} ${at((i + 1) * step, inner)}`);
  }
  parts.push("Z");
  return parts.join(" ");
};

const circlePath = (cx: number, cy: number, rr: number) => {
  const k = r2(rr * ARC);
  return [
    `M${r2(cx + rr)} ${cy}`,
    `C${r2(cx + rr)} ${r2(cy + k)} ${r2(cx + k)} ${r2(cy + rr)} ${cx} ${r2(cy + rr)}`,
    `C${r2(cx - k)} ${r2(cy + rr)} ${r2(cx - rr)} ${r2(cy + k)} ${r2(cx - rr)} ${cy}`,
    `C${r2(cx - rr)} ${r2(cy - k)} ${r2(cx - k)} ${r2(cy - rr)} ${cx} ${r2(cy - rr)}`,
    `C${r2(cx + k)} ${r2(cy - rr)} ${r2(cx + rr)} ${r2(cy - k)} ${r2(cx + rr)} ${cy}`,
    "Z",
  ].join(" ");
};

/** The page: its sheet, the border, the title, the lines and the signature. */
const Page = () => (
  <>
    <FacePath
      at={PAGE_AT}
      d={`M0 0 H${PAGE.w} V${PAGE.h} H0 Z`}
      plane="left"
      style={faceFill("surface", "left")}
    />
    <FacePath at={PAGE_AT} d={borderPath()} plane="left" style={LINE} />
    <FacePath
      at={PAGE_AT}
      d={roundedRect(TITLE.w, TITLE.h, TITLE.h / 2, TITLE.u, TITLE.v)}
      plane="left"
      style={faceFill("surface", "top")}
    />
    <FacePath
      at={PAGE_AT}
      d={`${RULES.map(({ len, u, v }) => `M${u} ${v} H${u + len}`).join(" ")} ${SIGNATURE}`}
      plane="left"
      style={LINE}
    />
  </>
);

/** One ribbon tail, a paper strip with a notched end. */
const Tail = ({ i }: { i: number }) => (
  <FacePath
    at={PAGE_AT}
    d={`M${TAILS[i].map(([u, v]) => `${u} ${v}`).join(" L")} Z`}
    plane="left"
    style={faceFill("surface", "top")}
  />
);

/** The seal: the one brand mark, a ring pressed into it. */
const Seal = () => (
  <>
    <FacePath
      at={PAGE_AT}
      d={sealPath()}
      plane="left"
      style={faceFill("main", "left")}
    />
    <FacePath
      at={PAGE_AT}
      d={circlePath(SEAL.u, SEAL.v, SEAL.ring)}
      plane="left"
      style={LINE}
    />
  </>
);

/* ───────────────────────────── Scene ──────────────────────────────────── */

export type CertificateProps = LineStateProps;

/**
 * Certificate: a complete "no certificates yet" state with a line
 * illustration, a heading, a line of copy and a button. A certificate
 * facing the screen (an inset border, a title, lines of text, a
 * signature) whose seal is stamped onto it: it lifts toward the viewer,
 * comes down with a small squash, the page gives under it and its two
 * ribbon tails swing and settle. One fine outline, paper faces, the seal
 * the one brand mark, no shadow. Plays when it comes into view, or each
 * time `active` turns true (PlayOnHover, or your own state). Follows the
 * shadcn theme.
 */
export const Certificate = ({
  heading = "No certificates yet",
  description = "Add a domain and we'll issue a certificate for it.",
  actionLabel = "Add domain",
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  ...rest
}: CertificateProps) => {
  const shell = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const { clip, clock } = shell;
  return (
    <LineState
      bounds={BOUNDS}
      defaultArtClassName="w-52"
      icon={ICON.plus}
      props={{
        actionLabel,
        description,
        heading,
        strokeWidth,
        tone,
        variant,
        ...rest,
      }}
      shell={shell}
      slot="certificate"
      view="front"
    >
      <Rig pivot={PAGE_MID} {...onClock(clock, pagePose(clip), clip.end)}>
        <Page />
        {/* The ribbons hang behind the seal and ride with it. */}
        <Rig pivot={SEAL_AT} {...onClock(clock, sealPose(clip), clip.end)}>
          {[0, 1].map((i) => (
            <Rig
              key={i}
              pivot={SEAL_AT}
              {...onClock(clock, tailPose(clip, i), clip.end)}
            >
              <Tail i={i} />
            </Rig>
          ))}
          <Seal />
        </Rig>
      </Rig>
    </LineState>
  );
};

export default Certificate;
