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
  useClock,
} from "./iso-core";
import type { IsoPose, IsoTone, IsoTrack, IsoVariant, Vec3 } from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A blocked state told by one object, in line: a closed padlock that is
 * tried twice and stays shut. A fine outline, near-white faces, the
 * keyhole the one brand mark, facing the screen, no shadow. Under it, the
 * state's own words: a heading, a line, a button. Each value is ms after
 * it comes into view.
 *
 *    0ms   a closed padlock, still
 *  400ms   the shackle is pulled up and stops hard on its catch (140ms)
 *  540ms   the pull carries the whole lock up with it (110ms)
 *  650ms   let go: the body falls back, the shackle drops home with a tap
 * 1020ms   a second, smaller pull does the same
 * 1560ms   still: locked, exactly as it started
 *
 * A click (or `loop`, after a 5.2s hold) plays the two pulls again.
 * Reduced motion (or autoPlay off): the closed padlock, nothing moves.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // After a click the first pull starts this soon.
  again: 80,
  // The whole lock is carried up for this long once the catch bites.
  carry: 110,
  // How long it rests before a loop starts again.
  hold: 5200,
  // The first pull starts this long after the lock comes into view.
  start: 400,
  // From one pull to the next.
  step: 620,
  // The shackle travels to its catch in this long.
  tug: 140,
};

/* How far things move, in world units. */
const MOVE = {
  // The whole lock is carried up this far by the first pull.
  hop: 0.36,
  // The shackle's play before its catch stops it.
  pull: 0.46,
  // The second pull, as a share of the first.
  second: 0.6,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The body: a rounded block, built facing +y and shown facing the screen.
const BODY = { depth: 1, h: 4, r: 0.85, w: 5.2, z: 0.6 };
const BODY_X = -BODY.w / 2;
const BODY_TOP = BODY.z + BODY.h;
const BODY_AT: Vec3 = [BODY_X, 0, BODY_TOP];

// The shackle: a bar bent into an arch, half as deep as the body and set
// in the middle of its depth, so each leg goes into the body's top face.
const SHACKLE = { bar: 0.62, depth: 0.5, rise: 2.5, w: 3.3 };
const SHACKLE_Y = -(BODY.depth - SHACKLE.depth) / 2;

// The keyhole on the body's face (u across, v down from its top edge): a
// round hole and a slot that widens toward its foot.
const KEYHOLE = { flare: 0.27, neck: 0.17, r: 0.43, tail: 1.2, v: 1.5 };

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

// The frame fits the lock at rest. The pulls lift it a little; that runs
// into the stage's padding, which is not clipped.
const SHACKLE_BACK = SHACKLE_Y - SHACKLE.depth;
const EXTENT: Vec3[] = [
  [BODY_X, 0, BODY.z],
  [BODY_X + BODY.w, 0, BODY.z],
  [BODY_X, SHACKLE_BACK, BODY_TOP + SHACKLE.rise],
  [BODY_X + BODY.w, SHACKLE_BACK, BODY_TOP + SHACKLE.rise],
];
const BOUNDS = EXTENT.map(facing);

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip {
  end: number;
  hop: IsoTrack;
  pull: IsoTrack;
}

// One pull, starting at `t`, `k` times as strong as the first. The shackle
// slams into its catch, the catch carries the body up, and both drop back
// with one small rebound.
const tug = (t: number, k: number) => {
  const bite = t + TIMING.tug;
  const top = bite + TIMING.carry;
  const hop: IsoTrack = [
    [bite, 0, EASE.drop],
    [top, MOVE.hop * k, EASE.in],
    [top + 150, 0, EASE.drop],
    [top + 220, MOVE.hop * k * 0.2, EASE.in],
    [top + 290, 0],
  ];
  const pull: IsoTrack = [
    [t, 0, EASE.in],
    [bite, MOVE.pull * k, "hold"],
    [top + 50, MOVE.pull * k, EASE.in],
    [top + 170, 0, EASE.drop],
    [top + 230, MOVE.pull * k * 0.14, EASE.in],
    [top + 290, 0],
  ];
  return { end: top + 290, hop, pull };
};

// The beat itself, starting `t0` ms into a run: two pulls.
const beat = (t0: number): Clip => {
  const first = tug(t0, 1);
  const second = tug(t0 + TIMING.step, MOVE.second);
  return {
    end: second.end,
    hop: [...first.hop, ...second.hop],
    pull: [...first.pull, ...second.pull],
  };
};

// The first run waits a moment after coming into view; a click does not.
const INTRO = beat(TIMING.start);
const AGAIN = beat(TIMING.again);

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The whole lock, carried up by the pull and dropped back. */
const bodyPose =
  (clip: Clip) =>
  (ms: number): IsoPose => ({ offset: [0, 0, r2(sample(clip.hop, ms))] });

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

// A quarter circle as a cubic: the handle length for a unit radius.
const ARC = 0.5523;

/**
 * The shackle's outline in face units (u across from its left edge, v down
 * from the top of its arch): two legs joined by a half ring. The legs end
 * where they meet the body's top face, so pulling it up `pull` units makes
 * them that much longer: the bar slides out of the body, it is not lifted
 * off it.
 */
const shacklePath = (pull: number) => {
  const { bar, rise, w } = SHACKLE;
  const outer = w / 2;
  const inner = outer - bar;
  const ko = r2(outer * ARC);
  const ki = r2(inner * ARC);
  const foot = r2(rise + pull);
  return [
    `M0 ${foot}`,
    `V${outer}`,
    `C0 ${r2(outer - ko)} ${r2(outer - ko)} 0 ${outer} 0`,
    `C${r2(outer + ko)} 0 ${w} ${r2(outer - ko)} ${w} ${outer}`,
    `V${foot}`,
    `H${r2(w - bar)}`,
    `V${outer}`,
    `C${r2(w - bar)} ${r2(outer - ki)} ${r2(outer + ki)} ${bar} ${outer} ${bar}`,
    `C${r2(outer - ki)} ${bar} ${bar} ${r2(outer - ki)} ${bar} ${outer}`,
    `V${foot}`,
    "Z",
  ].join(" ");
};

// In the front view, one unit of depth shows as 1/√3 of a unit up the page
// (see "The view").
const SINK = 1 / Math.sqrt(3);

// The far edge of the arch: the outer half ring on the shackle's back face,
// and the two short uprights that join it to the front one. An arch is not
// convex, so the engine cannot find this edge itself; it is the same
// outline, on the back plane.
const SHACKLE_RIM = (() => {
  const { depth, w } = SHACKLE;
  const outer = w / 2;
  const ko = r2(outer * ARC);
  const lip = r2(outer + depth * SINK);
  return [
    `M0 ${lip}`,
    `V${outer}`,
    `C0 ${r2(outer - ko)} ${r2(outer - ko)} 0 ${outer} 0`,
    `C${r2(outer + ko)} 0 ${w} ${r2(outer - ko)} ${w} ${outer}`,
    `V${lip}`,
  ].join(" ");
})();

/** The shackle, `pull` units out of the body. */
const Shackle = ({ pull }: { pull: number }) => {
  const top = BODY_TOP + SHACKLE.rise + pull;
  return (
    <>
      <Extrude
        at={[-SHACKLE.w / 2, SHACKLE_Y, top]}
        d={shacklePath(pull)}
        depth={SHACKLE.depth}
        palette="surface"
        plane="left"
      />
      <FacePath
        at={[-SHACKLE.w / 2, SHACKLE_BACK, top]}
        d={SHACKLE_RIM}
        plane="left"
        style={LINE}
      />
    </>
  );
};

// The keyhole's outline: round the hole from one side of the slot to the
// other, then down the slot and across its foot.
const KEYHOLE_PATH = (() => {
  const { flare, neck, r, tail, v } = KEYHOLE;
  const cx = BODY.w / 2;
  const from = Math.asin(neck / r);
  const steps = 40;
  const round: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = from + ((2 * Math.PI - 2 * from) * i) / steps;
    round.push(`${r2(cx + r * Math.sin(a))} ${r2(v + r * Math.cos(a))}`);
  }
  return `M${round.join(" L")} L${r2(cx - flare)} ${r2(v + tail)} L${r2(cx + flare)} ${r2(v + tail)} Z`;
})();

/** The body, and the keyhole on its face: the one brand mark. */
const Body = () => (
  <>
    <Extrude
      at={BODY_AT}
      convex
      d={roundedRect(BODY.w, BODY.h, BODY.r)}
      depth={BODY.depth}
      palette="surface"
      plane="left"
    />
    <FacePath
      at={BODY_AT}
      d={KEYHOLE_PATH}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-main-left)" }}
    />
  </>
);

/* ───────────────────────────── Clock ──────────────────────────────────── */

/** How far the shackle is out of the body, re-rendered only when it changes. */
const usePull = (clock: MotionValue<number> | undefined, clip: Clip) => {
  const idle = useMotionValue(0);
  const [value, setValue] = useState(0);
  const last = useRef(0);
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = r2(sample(clip.pull, ms));
    if (next !== last.current) {
      last.current = next;
      setValue(next);
    }
  });
  return clock ? value : 0;
};

/** Rig props: animated on the clock, or the resting pose held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(INTRO.end));

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

/**
 * The state's own words, under the lock: the heading, a line of copy, and
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
    <Button className="rounded-full" onClick={onAction}>
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

export interface PadlockProps {
  /** Heading under the lock, up to about 28 characters. An empty string hides it. */
  heading?: string;
  /** The line under the heading: one or two short sentences. An empty string hides it. */
  description?: string;
  /** Label of the button, up to about 20 characters. An empty string hides the button. */
  actionLabel?: string;
  /** Called when the button is clicked. */
  onAction?: () => void;
  /** Your own actions under the copy (a link, two buttons), in place of the built-in button. */
  children?: ReactNode;
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the keyhole; the rest stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** The lock is tried when it scrolls into view. Off shows the closed lock and nothing moving. */
  autoPlay?: boolean;
  /** Try the lock again every few seconds. Off plays it once, which suits a state people sit in front of. */
  loop?: boolean;
  /** Clicking the lock tries it again. */
  replayOnClick?: boolean;
  /** Accessible description of the illustration. Without it the lock is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-48`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * Padlock: a complete no-access state ("You don't have access") with a
 * line illustration, a heading, a line of copy and a button, all props. A
 * closed padlock; its shackle is pulled up twice, stops on its catch each
 * time and drops back, still locked. One fine outline, near-white faces,
 * no shadow, facing the screen; the keyhole carries the brand, like the
 * button under it. Click the lock to play it again. Follows the shadcn
 * theme.
 */
export const Padlock = ({
  heading = "You don't have access",
  description = "Ask the owner of this workspace to let you in, or switch to another account.",
  actionLabel = "Request access",
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
}: PadlockProps) => {
  const { canReplay, clip, clock, ref, replay } = useShell({
    autoPlay,
    loop,
    replayOnClick,
  });
  const pull = usePull(clock, clip);
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
      {/* Everything stands in one rig that turns it to face the screen. */}
      <Rig pivot={[0, 0, 0]} {...VIEW_POSE}>
        <Rig pivot={[0, 0, BODY.z]} {...rigged(clock, bodyPose(clip))}>
          <Body />
          <Shackle pull={pull} />
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
      data-slot="padlock"
    >
      <div
        className={cn("w-48 max-w-full", artClassName)}
        data-slot="padlock-art"
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

export default Padlock;
