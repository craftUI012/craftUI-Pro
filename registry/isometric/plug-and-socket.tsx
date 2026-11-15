"use client";

import { useInView, useMotionValue, useMotionValueEvent } from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import { useRef, useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EASE,
  Extrude,
  FacePath,
  IsoStage,
  Rig,
  roundedRect,
  sample,
  scaleTrack,
  settle,
  shiftTrack,
  useClock,
} from "./iso-core";
import type { IsoPose, IsoTone, IsoTrack, IsoVariant, Vec3 } from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A blocked state told by one object, in line: an unplugged cord, its
 * plug and its socket facing each other across a gap, the cable hanging
 * between them with one curl in it. A fine outline, near-white faces, the plug's
 * two pins the one brand mark, facing the screen, no shadow. Under it,
 * the state's own words: a heading, a line, a button. Each value is ms
 * after it comes into view.
 *
 *    0ms   the two ends hang apart, still
 *  400ms   the plug reaches for the socket (380ms); the socket leans in
 *          after it, 60ms later and two thirds as far; the cable sags
 *  780ms   it strains the last little way and stops short of the socket
 * 1000ms   it gives up: both ends spring apart, past rest, and sway home
 * 2150ms   still: apart, exactly as it started
 *
 * A click (or `loop`, after a 5.2s hold) plays the reach again.
 * Reduced motion (or autoPlay off): the two ends apart, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click the reach starts this soon.
  again: 80,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The socket follows the plug this much later.
  lag: 60,
  // The plug travels most of the way in this long.
  reach: 380,
  // The reach starts this long after the cord comes into view.
  start: 400,
  // It strains at full stretch for this long before letting go.
  strain: 220,
};

/* How far things move, in world units. */
const MOVE = {
  // How far the plug travels toward the socket.
  plug: 0.46,
  // How much of the reach the first, quick part covers.
  quick: 0.88,
  // The socket's travel, as a share of the plug's.
  socket: 0.65,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The two ends: a block each, built facing +y and shown facing the
// screen, mirrored about the middle. `face` is how far each one's front
// end is from the middle; `z` is the height of its centre line.
const HEAD = { depth: 0.75, face: 0.95, h: 1.7, r: 0.5, w: 2.3, z: 5.4 };
const HEAD_TOP = HEAD.z + HEAD.h / 2;
const HEAD_END = HEAD.face + HEAD.w;

// The sleeve where the cable enters each end: smaller, set in the middle
// of the block's depth, and tucked a little way into it.
const SLEEVE = { depth: 0.45, h: 0.85, r: 0.22, tuck: 0.2, w: 0.55 };
const SLEEVE_Y = -(HEAD.depth - SLEEVE.depth) / 2;

// The plug's two pins, one over the other.
const PIN = { depth: 0.4, h: 0.24, len: 0.8, r: 0.08, spread: 0.42, tuck: 0.2 };
const PIN_Y = -(HEAD.depth - PIN.depth) / 2;

// The lip round the socket's mouth, a little taller than the block.
const LIP = { h: 2, r: 0.12, w: 0.3 };

// The grip: three ridges across each block, counted from the cable's end.
const GRIP = { at: [0.5, 0.82, 1.14] as const, h: 0.8 };

// The cable: a tube hanging from one sleeve to the other, in the plane
// through the middle of the blocks' depth, with one curl at its foot (a
// plain sag would read as a smile under two eyes). `reach` is the handle
// length of the two long curves at the sleeves and `belly` how far out
// from the middle their handles sit at the foot, the same on both sides,
// so the cable is as wide on the right as on the left; `curl` is the curl's
// half width, its height, the handles that round it and how far left of
// the middle it hangs (off centre, as a cord falls); `slack` is how far
// the foot drops for every unit the ends come together.
const CABLE = {
  belly: 4.3,
  curl: { h: 2, lead: 1.7, round: 1.25, w: 0.95, x: -1.1 },
  foot: 0.85,
  from: HEAD_END + SLEEVE.w - 0.25,
  half: 0.2,
  overlap: 2,
  reach: 2.8,
  slack: 0.42,
  steps: 22,
};
const CABLE_Y = -HEAD.depth / 2;

type P2 = readonly [number, number];
type Span = readonly [P2, P2, P2, P2];

const r2 = (n: number) => Math.round(n * 100) / 100;

// A point on a cubic curve and its direction there.
const cubic = ([a, b, c, d]: Span, t: number): [P2, P2] => {
  const m = 1 - t;
  const at = (i: 0 | 1) =>
    m * m * m * a[i] +
    3 * m * m * t * b[i] +
    3 * m * t * t * c[i] +
    t * t * t * d[i];
  const along = (i: 0 | 1) =>
    3 * m * m * (b[i] - a[i]) +
    6 * m * t * (c[i] - b[i]) +
    3 * t * t * (d[i] - c[i]);
  return [
    [at(0), at(1)],
    [along(0), along(1)],
  ];
};

/**
 * The cable's centre line, in x and z, as four curves: out of the socket's
 * sleeve and down to the foot, up the right of the curl to its top, down
 * its left and across the first curve, then up into the plug's sleeve.
 * `socket` and `plug` are how far each end has moved toward the middle;
 * the curl shifts with them and drops as they close.
 */
const cableSpans = (socket: number, plug: number): Span[] => {
  const { belly, curl, reach } = CABLE;
  const start: P2 = [-CABLE.from + socket, HEAD.z];
  const end: P2 = [CABLE.from - plug, HEAD.z];
  const shift = (socket - plug) / 2;
  const mid = curl.x + shift;
  const low = CABLE.foot - CABLE.slack * (socket + plug);
  const left: P2 = [mid - curl.w, low];
  const right: P2 = [mid + curl.w, low];
  const top: P2 = [mid, low + curl.h];
  return [
    [start, [start[0] - reach, HEAD.z], [shift - belly, low], left],
    [left, [left[0] + curl.lead, low], [mid + curl.round, top[1]], top],
    [top, [mid - curl.round, top[1]], [right[0] - curl.lead, low], right],
    [right, [shift + belly, low], [end[0] + reach, HEAD.z], end],
  ];
};

/** The two edges of a length of tube: its centre line pushed out by half its width on either side. */
interface Edges {
  near: P2[];
  far: P2[];
}

/**
 * The cable as two lengths of tube, the second lying over the first where
 * the curl crosses itself. Each is the two edges of its half of the centre
 * line; the first runs a few steps past the top of the curl, under the
 * second, so no gap shows where they meet.
 */
const cableEdges = (socket: number, plug: number): [Edges, Edges] => {
  const spans = cableSpans(socket, plug);
  const edge = (list: readonly Span[], extra: Span | null): Edges => {
    const near: P2[] = [];
    const far: P2[] = [];
    const push = (span: Span, upTo: number) => {
      for (let i = 0; i <= upTo; i += 1) {
        const [[x, z], [sx, sz]] = cubic(span, i / CABLE.steps);
        const len = Math.hypot(sx, sz) || 1;
        const nx = (-sz / len) * CABLE.half;
        const nz = (sx / len) * CABLE.half;
        near.push([x + nx, z + nz]);
        far.push([x - nx, z - nz]);
      }
    };
    for (const span of list) {
      push(span, CABLE.steps);
    }
    if (extra) {
      push(extra, CABLE.overlap);
    }
    return { far, near };
  };
  return [edge(spans.slice(0, 2), spans[2]), edge(spans.slice(2), null)];
};

// Points as a path on the cable's plane (u = x, v = −z).
const trace = (points: readonly P2[]) =>
  `M${points.map(([x, z]) => `${r2(x)} ${r2(-z)}`).join(" L")}`;

/* ───────────────────────────── The view ───────────────────────────────── */

/**
 * Facing the screen. The object is built facing +y, which the isometric
 * camera sees at an angle. The whole of it is turned 45° about the
 * vertical, so its front points straight at the viewer and its edges run
 * level and plumb; and it is stretched √(3/2) in height, because that
 * camera looks down from 35.26° and foreshortens heights by exactly that
 * much, so the front keeps its true proportions. It is still one exact
 * parallel projection of a solid: its thickness shows along its top edges.
 */
const FRONT = { stretch: Math.sqrt(1.5), turn: -45 };
const VIEW_POSE: IsoPose = {
  axis: "z",
  rotate: FRONT.turn,
  scale: [1, 1, FRONT.stretch],
};

/** Where a point of the object lands once it faces the screen. */
const facing = ([x, y, z]: Vec3): Vec3 => [
  (x + y) * Math.SQRT1_2,
  (y - x) * Math.SQRT1_2,
  z * FRONT.stretch,
];

// The frame fits the cord at rest: as wide as the cable, from its foot to
// the top of the socket's lip. The spring apart reaches a little wider;
// that runs into the stage's padding, which is not clipped.
const REST = cableEdges(0, 0).flatMap(({ far, near }) => [...far, ...near]);
const REACH_X = Math.max(...REST.map(([x]) => Math.abs(x)));
const LOW = Math.min(...REST.map(([, z]) => z));
const LIP_TOP = HEAD.z + LIP.h / 2;
const EXTENT: Vec3[] = [
  [-REACH_X, CABLE_Y, LOW],
  [REACH_X, CABLE_Y, LOW],
  [-REACH_X, -HEAD.depth, LIP_TOP],
  [REACH_X, -HEAD.depth, LIP_TOP],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: how far each end has moved in, and when it is at rest. */
interface Clip {
  end: number;
  plug: IsoTrack;
  socket: IsoTrack;
}

// The beat itself, starting `t0` ms into a run: the plug reaches, strains
// and springs back; the socket does the same a moment later and less far.
const beat = (t0: number): Clip => {
  const there = t0 + TIMING.reach;
  const letGo = there + TIMING.strain;
  const back = settle(0, letGo, 0.75, MOVE.plug);
  const plug: IsoTrack = [
    [t0, 0, EASE.easy],
    [there, MOVE.plug * MOVE.quick, EASE.drop],
    ...back,
  ];
  return {
    end: (back.at(-1)?.[0] ?? letGo) + TIMING.lag,
    plug,
    socket: shiftTrack(scaleTrack(plug, MOVE.socket), TIMING.lag),
  };
};

// The first run waits a moment after coming into view; a click does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/**
 * The cable, drawn as a flat tube (it is round, so it shows no top edge):
 * each length is its fill, then its two edges as lines, so the second
 * length covers the first where the curl crosses and no line closes the
 * tube where the two meet.
 */
const Cable = ({ socket, plug }: { socket: number; plug: number }) => (
  <>
    {cableEdges(socket, plug).map(({ far, near }, i) => (
      // oxlint-disable-next-line react/no-array-index-key -- two fixed lengths, never reordered
      <g key={i}>
        <FacePath
          at={[0, CABLE_Y, 0]}
          d={`${trace([...near, ...far.toReversed()])} Z`}
          plane="left"
          style={{ fill: "var(--iso-surface-left)", stroke: "none" }}
        />
        <FacePath
          at={[0, CABLE_Y, 0]}
          d={`${trace(near)} ${trace(far)}`}
          plane="left"
          strokeLinecap="round"
          style={LINE}
        />
      </g>
    ))}
  </>
);

/**
 * One end's block with its sleeve and grip. `side` is −1 for the socket
 * (left of the middle) and 1 for the plug.
 */
const Head = ({ side }: { side: -1 | 1 }) => {
  // The block's left edge, and its sleeve's, whichever side it is on.
  const x = side === 1 ? HEAD.face : -HEAD_END;
  const sleeveX = side === 1 ? HEAD_END - SLEEVE.tuck : -HEAD_END - SLEEVE.w;
  const grip = GRIP.at
    .map((from) => {
      const u = side === 1 ? HEAD.w - from : from;
      return `M${r2(u)} ${r2((HEAD.h - GRIP.h) / 2)} V${r2((HEAD.h + GRIP.h) / 2)}`;
    })
    .join(" ");
  return (
    <>
      <Extrude
        at={[sleeveX, SLEEVE_Y, HEAD.z + SLEEVE.h / 2]}
        convex
        d={roundedRect(SLEEVE.w + SLEEVE.tuck, SLEEVE.h, SLEEVE.r)}
        depth={SLEEVE.depth}
        palette="surface"
        plane="left"
      />
      <Extrude
        at={[x, 0, HEAD_TOP]}
        convex
        d={roundedRect(HEAD.w, HEAD.h, HEAD.r)}
        depth={HEAD.depth}
        palette="surface"
        plane="left"
      />
      <FacePath at={[x, 0, HEAD_TOP]} d={grip} plane="left" style={LINE} />
    </>
  );
};

/** The socket's end: its block, and the lip round its mouth. */
const Socket = () => (
  <>
    <Head side={-1} />
    <Extrude
      at={[-HEAD.face - LIP.w, 0, HEAD.z + LIP.h / 2]}
      convex
      d={roundedRect(LIP.w, LIP.h, LIP.r)}
      depth={HEAD.depth}
      palette="surface"
      plane="left"
    />
  </>
);

/** The plug's end: its two pins, the one brand mark, then its block. */
const Plug = () => (
  <>
    {[1, -1].map((up) => (
      <Extrude
        at={[HEAD.face - PIN.len, PIN_Y, HEAD.z + up * PIN.spread + PIN.h / 2]}
        convex
        d={roundedRect(PIN.len + PIN.tuck, PIN.h, PIN.r)}
        depth={PIN.depth}
        key={up}
        palette="main"
        plane="left"
      />
    ))}
    <Head side={1} />
  </>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** How far each end has moved in, re-rendered only when one changes. */
const useReach = (
  clock: MotionValue<number> | undefined,
  clip: Clip
): readonly [number, number] => {
  const idle = useMotionValue(0);
  const read = (ms: number): readonly [number, number] => [
    r2(sample(clip.socket, ms)),
    r2(sample(clip.plug, ms)),
  ];
  const [value, setValue] = useState<readonly [number, number]>([0, 0]);
  const last = useRef("0,0");
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    if (next.join(",") !== last.current) {
      last.current = next.join(",");
      setValue(next);
    }
  });
  return clock ? value : [0, 0];
};

/* ───────────────────────────── Shell ──────────────────────────────────── */

// Whether the visitor asked for less motion. It is read through a store
// and not in the first render: the server cannot know it, so the first
// render in the browser has to answer "no" as the server did, and switch
// once the page has taken over. Reading it straight away makes the two
// disagree, and React reports a failed hydration.
const REDUCE = "(prefers-reduced-motion: reduce)";
const watchReduce = (notify: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const useReduced = () =>
  useSyncExternalStore(
    watchReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false
  );

/** In view, reduced motion, the clock and its clip, and the replay. */
const useShell = ({
  autoPlay,
  loop,
  replayOnClick,
}: {
  autoPlay: boolean;
  loop: boolean;
  replayOnClick: boolean;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReduced();
  const still = reduced || !autoPlay;
  // Run 0 waits a moment after coming into view; later runs start at once.
  const [run, setRun] = useState(0);
  const clock = useClock(inView && !still, run);
  const clip = run === 0 ? INTRO : AGAIN;
  // One new run per finished run, however many frames or clicks ask.
  const asked = useRef(-1);
  const again = () => {
    if (asked.current !== run) {
      asked.current = run;
      setRun((n) => n + 1);
    }
  };
  useMotionValueEvent(clock, "change", (ms) => {
    if (loop && !still && ms >= clip.end + TIMING.hold) {
      again();
    }
  });
  const canReplay = replayOnClick && !still;
  const replay = () => {
    if (canReplay && clock.get() >= clip.end) {
      again();
    }
  };
  return { canReplay, clip, clock: still ? undefined : clock, ref, replay };
};

// In ink the walls step down half as far as the house ramp (0.03 and 0.07
// under the top, not 0.06 and 0.13): a blocked state is a quiet line
// drawing on the page, with only a whisper of form.
const PAPER: Record<string, string> = {
  "--iso-surface-left-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.03) c h)",
  "--iso-surface-right-c":
    "oklch(from var(--iso-surface-base) calc(max(l, 0.33) - 0.07) c h)",
};

// The blueprint (`line`) drawn at this size: its outline held at the same
// pixel weight as ink instead of a canvas-unit one, which would be three
// times too heavy on a stage this small. Faces stay the page's colour.
const BLUEPRINT: Record<string, string> = {
  "--iso-edge-w": "calc(var(--iso-stroke-width) * 4.33px)",
  "--iso-vector": "non-scaling-stroke",
};

// The engine's rim highlight has no width in the outlined variants, yet it
// still paints a pale hairline over the front outline of every extrusion
// (seen at 4× in Chromium). Clear its colour so the outline keeps its
// full weight.
const NO_RIM: Record<string, string> = {
  "--iso-accent-rim": "transparent",
  "--iso-main-rim": "transparent",
  "--iso-surface-rim": "transparent",
};

/**
 * Stage overrides: no hairline contour (every edge already carries the
 * outline), the paper walls in ink, the pixel outline in the blueprint,
 * and the outline on the side edges of rounded parts.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-silhouette": "var(--iso-edge, none)",
  }) as CSSProperties;

/* ───────────────────────────── Copy ───────────────────────────────────── */

// Optical padding: an icon carries its own white space, so the label's
// side gets 2px more than the icon's side (12px and 14px) or the label
// looks pushed against the edge. The second class wins over a Button that
// already nudges this side itself.
const BUTTON =
  "rounded-full has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5";

/** The plus on the button. */
const PlusIcon = () => (
  <svg
    aria-hidden="true"
    data-icon="inline-start"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * The state's own words, under the cord: the heading, a line of copy, and
 * the actions (the built-in button, or whatever is passed in).
 */
const Copy = ({
  heading,
  description,
  actionLabel,
  onAction,
  children,
}: {
  heading: string;
  description: string;
  actionLabel: string;
  onAction?: () => void;
  children?: ReactNode;
}) => {
  const button = actionLabel ? (
    <Button className={BUTTON} onClick={onAction}>
      <PlusIcon />
      {actionLabel}
    </Button>
  ) : null;
  const actions = children ?? button;
  return (
    <>
      {heading ? (
        <p className="mt-3 text-xl font-medium tracking-tight text-foreground">
          {heading}
        </p>
      ) : null}
      {description ? (
        <p className="mt-2 text-balance text-muted-foreground">{description}</p>
      ) : null}
      {actions ? <div className="mt-6">{actions}</div> : null}
    </>
  );
};

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface PlugAndSocketProps {
  /** Heading under the cord, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the plug's two pins; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The plug reaches for the socket when the cord scrolls into view. Off shows the two ends apart and nothing moving. */
  autoPlay?: boolean;
  /** Reach again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the cord makes the plug reach again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the cord is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-72`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Plug and socket: a complete not-connected state ("Not connected") with
 * a line illustration, a heading, a line of copy and a button, all props.
 * An unplugged cord, its plug and socket facing each other with the cable
 * hanging in a loop between them; the plug reaches for the socket, stops
 * short and springs back. One fine outline, near-white faces, no shadow,
 * facing the screen; the plug's two pins carry the brand, like the button
 * under it. Click the cord to play it again. Follows the shadcn theme.
 */
export const PlugAndSocket = ({
  heading = "Not connected",
  description = "Connect an app to start bringing your data in here.",
  actionLabel = "Connect an app",
  onAction,
  children,
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  autoPlay = true,
  loop = false,
  replayOnClick = true,
  title,
  artClassName,
  className,
}: PlugAndSocketProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
  const [socket, plug] = useReach(clock, clip);
  const art = (
    <IsoStage
      bounds={BOUNDS}
      shadow={false}
      strokeWidth={strokeWidth}
      style={stageStyle(variant)}
      title={title}
      tone={tone}
      variant={variant}
    >
      {/* Everything hangs in one rig that turns it to face the screen. */}
      <Rig pivot={[0, 0, 0]} {...VIEW_POSE}>
        <Cable plug={plug} socket={socket} />
        <Rig offset={[socket, 0, 0]} pivot={[0, 0, 0]}>
          <Socket />
        </Rig>
        <Rig offset={[-plug, 0, 0]} pivot={[0, 0, 0]}>
          <Plug />
        </Rig>
      </Rig>
    </IsoStage>
  );
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="plug-and-socket"
    >
      <div
        className={cn("w-72 max-w-full", artClassName)}
        data-slot="plug-and-socket-art"
        ref={ref}
      >
        {canReplay ? (
          <button
            aria-label={`${title ?? "Illustration"}. Press to play it again.`}
            className="block w-full cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={replay}
            type="button"
          >
            {art}
          </button>
        ) : (
          art
        )}
      </div>
      <Copy
        actionLabel={actionLabel}
        description={description}
        heading={heading}
        onAction={onAction}
      >
        {children}
      </Copy>
    </div>
  );
};

export default PlugAndSocket;
