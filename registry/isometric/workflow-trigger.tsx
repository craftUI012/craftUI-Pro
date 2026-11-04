"use client";

import {
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from "motion/react";
import type { MotionValue } from "motion/react";
import type { CSSProperties } from "react";
import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

import {
  EASE,
  FaceEllipse,
  FacePath,
  FloorGrid,
  IsoStage,
  Panel,
  press,
  projectWith,
  Rig,
  roundedRect,
  sample,
  settle,
  Slab,
  useClock,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCamera,
  IsoOrbit,
  IsoPose,
  IsoRotate,
  IsoTone,
  IsoTrack,
  IsoVariant,
  Vec3,
} from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * One moment of a workflow automation: an event lands in one app, the AI
 * step picks it up, and the workflow acts in the other app. Three rounded
 * tiles float level over nothing: the mail app front left, the chat app
 * behind it at the back, the AI step to the right. Dashed lanes run along
 * the floor from each app to the AI step, straight along the axes with one
 * rounded bend. Which event fires decides the direction and the reaction:
 * an email runs mail → AI → chat and posts a summary; a chat command runs
 * chat → AI → mail and sends the email. Events take turns, one per cycle.
 * The app tiles stay put; only the AI step moves. Each value is ms into a
 * cycle.
 *
 *    0ms   calm: three tiles, lanes dashed
 *  300ms   the event lands: a label rises out of the source app on a
 *          dashed tether ("1 · New email · Acme Inc.")
 * 1000ms   the lane inks in from the source to the AI step (700ms), the
 *          dashes filling solid in the brand around the bend
 * 1700ms   the ink reaches the AI step: it presses in, its sparkle turns
 * 2150ms   the second lane inks in, AI step → target (700ms)
 * 2850ms   the ink lands; the target's result rises
 *          ("✓ Summary posted · #sales")
 * 5400ms   hold ends: labels sink back into their tiles, the ink drains
 *          toward the target
 * 6400ms   the next event, from the other app
 *
 * Reduced motion (or autoPlay off): the first event's end state.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // The first lane starts inking in.
  lane1: 1000,
  // The second lane starts inking in.
  lane2: 2150,
  // Labels sink, ink drains.
  out: 5400,
  // One event, start to finish.
  period: 6400,
  // The result label rises as the ink lands.
  result: 2850,
  // The event lands: its label rises.
  source: 300,
  // Milliseconds for the ink to run one lane.
  travel: 700,
};

/* The AI step's verbs */
const MOTION = {
  // Degrees the AI sparkle turns as it works (the star is 4-fold symmetric).
  aiTurn: 90,
  // How far the AI step presses in when the ink arrives (z scale).
  press: 0.32,
};

/* The lanes */
const LANE = {
  // World units of the rounded bend's radius.
  bend: 1.5,
  // How long the ink takes to drain at the end, ms.
  drain: 520,
  // Samples along each lane, evenly spaced by length.
  steps: 64,
  // Height of the lanes: low on the tiles' walls.
  z: 1.05,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

type Slot = "mail" | "ai" | "chat";
type App = Exclude<Slot, "ai">;

// Every tile is a rounded slab, 5 × 5 × 0.8, floating over the floor.
const TILE = { depth: 0.8, radius: 1.15, size: 5 };

// Centres of the tiles' bottoms, all level at z 0.8. Mail and chat share
// x, so chat sits up and to the right of mail on screen, far enough back
// (9 apart) that the mail label clears it; the AI step is 8.5 along x, to
// the right. Each app's lane runs along x from the app, bends round a 1.5
// radius and runs along y into the AI step's near (mail) or far (chat)
// side; the bend ends 0.5 short of the AI tile's face.
const CENTRES: Record<Slot, Vec3> = {
  ai: [8.5, 0.5, 0.8],
  chat: [0, -4, 0.8],
  mail: [0, 5, 0.8],
};

const tileAt = (s: Slot): Vec3 => [
  CENTRES[s][0] - TILE.size / 2,
  CENTRES[s][1] - TILE.size / 2,
  CENTRES[s][2],
];
const tileTop = (s: Slot) => CENTRES[s][2] + TILE.depth;
const topCentre = (s: Slot): Vec3 => [CENTRES[s][0], CENTRES[s][1], tileTop(s)];

// The labels: lit pills standing above their tile, facing the viewer's
// left (+y), on a dashed tether rising from the tile's top.
const PILL = {
  depth: 0.25,
  // Height above the tile's top of the pill's bottom edge.
  gap: 3.4,
  h: 1.6,
  // In front of the tile's centre, so the tether runs behind the pill.
  y: 0.35,
};
// Pill width from its copy: room for the badge, then about 0.29 a character.
const pillWidth = (chars: number) =>
  Math.min(9.5, Math.max(5, Math.round((2.1 + chars * 0.29) * 2) / 2));

// The frame: every tile, and the tallest a label can stand over each app.
const BOUNDS: Vec3[] = [
  ...(["ai", "mail", "chat"] as Slot[]).flatMap((s): Vec3[] => {
    const [x, y, z] = tileAt(s);
    return [
      [x, y, z + TILE.depth],
      [x + TILE.size, y, z + TILE.depth],
      [x + TILE.size, y + TILE.size, z],
      [x, y + TILE.size, z],
    ];
  }),
  ...(["mail", "chat"] as App[]).flatMap((s): Vec3[] => {
    const [cx, cy] = CENTRES[s];
    const z = tileTop(s) + PILL.gap + PILL.h;
    return [
      [cx - 4, cy + PILL.y, z],
      [cx + 4, cy + PILL.y, z],
    ];
  }),
];

// Paint order: chat (x + y = −4) is behind mail (5).
const APPS_FAR_TO_NEAR: App[] = ["chat", "mail"];

const GRID = { at: [-4, -8] as const, size: [16, 16] as const };
// The camera turns around the middle of the three tiles.
const PIVOT: readonly [number, number] = [3, 0.5];
// Turning toward the labels' faces (+) reads well; away (−) soon takes
// them edge-on, so keep that side short.
const DEFAULT_ORBIT: IsoOrbit = [-12, 30];

/* ───────────────────────────── Events ─────────────────────────────────── */

/** One event the workflow reacts to, and what it does in the other app. */
export interface WorkflowEvent {
  /** The app the event lands in ("mail" or "chat"); the workflow acts in the other one. */
  from: "mail" | "chat";
  /** What happened, up to about 14 characters ("New email"). */
  event: string;
  /** Where or from whom, up to about 10 characters ("Acme Inc."). */
  detail: string;
  /** What the workflow did, up to about 14 characters ("Summary posted"). */
  result: string;
  /** Where it did it, up to about 10 characters ("#sales"). */
  resultDetail: string;
}

const DEFAULT_EVENTS: WorkflowEvent[] = [
  {
    detail: "Acme Inc.",
    event: "New email",
    from: "mail",
    result: "Summary posted",
    resultDetail: "#sales",
  },
  {
    detail: "#sales",
    event: "/follow-up",
    from: "chat",
    result: "Email sent",
    resultDetail: "Acme Inc.",
  },
];

const otherApp = (a: App): App => (a === "mail" ? "chat" : "mail");

/** Which event a time on the clock belongs to, and the time inside it. */
const phase = (ms: number, count: number) => ({
  index: Math.floor(ms / TIMING.period) % Math.max(1, count),
  t: ms % TIMING.period,
});

// What reduced motion shows: the first event, finished, before the hold ends.
const STILL_MS = TIMING.out - 200;

/* ───────────────────────────── Tracks ─────────────────────────────────── */

const AI_PRESS = press(MOTION.press, TIMING.lane1 + TIMING.travel - 40);
const AI_TURN = settle(MOTION.aiTurn, TIMING.lane1 + TIMING.travel, 0.8);

// A label rises out of its tile with a soft pop, holds, sinks back in.
const popTrack = (start: number): IsoTrack => [
  [start, 0, EASE.soft],
  [start + 360, 1, "hold"],
  [TIMING.out, 1, EASE.in],
  [TIMING.out + 280, 0],
];
const EVENT_POP = popTrack(TIMING.source);
const RESULT_POP = popTrack(TIMING.result);

// Ink along a lane: its head runs source → target, then its tail drains.
const inkHead = (start: number): IsoTrack => [
  [start, 0, [0.45, 0, 0.55, 1]],
  [start + TIMING.travel, 1],
];
const INK_TAIL: IsoTrack = [
  [TIMING.out, 0, EASE.easy],
  [TIMING.out + LANE.drain, 1],
];
const LANE1_HEAD = inkHead(TIMING.lane1);
const LANE2_HEAD = inkHead(TIMING.lane2);

/* ───────────────────────────── Lanes ──────────────────────────────────── */

/** Resamples a polyline to `n` + 1 points evenly spaced by length, so ink fills at an even pace. */
const evenly = (pts: readonly Vec3[], n: number): Vec3[] => {
  const acc = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const [a, b] = [pts[i - 1], pts[i]];
    acc.push(acc[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = acc.at(-1) ?? 1;
  const out: Vec3[] = [];
  let j = 1;
  for (let k = 0; k <= n; k += 1) {
    const d = (total * k) / n;
    while (j < pts.length - 1 && acc[j] < d) {
      j += 1;
    }
    const span = acc[j] - acc[j - 1] || 1;
    const f = Math.min(1, Math.max(0, (d - acc[j - 1]) / span));
    const [a, b] = [pts[j - 1], pts[j]];
    out.push([
      a[0] + (b[0] - a[0]) * f,
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
    ]);
  }
  return out;
};

/**
 * An app's lane to the AI step, lying on the floor plane at LANE.z: along
 * x from the app's centre to the AI step's x, a quarter circle of radius
 * LANE.bend round the corner, then along y into the AI step's centre.
 * Its ends sit under the tiles, which are drawn over them.
 */
const appLane = (app: App): Vec3[] => {
  const [x0, y0] = CENTRES[app];
  const [x1, y1] = CENTRES.ai;
  const r = LANE.bend;
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  // Centre of the bend: back from the corner along x, on along y.
  const ox = x1 - dx * r;
  const oy = y0 + dy * r;
  const bend = Array.from({ length: 13 }, (_, i): Vec3 => {
    const a = (i / 12) * (Math.PI / 2);
    return [ox + dx * r * Math.sin(a), oy - dy * r * Math.cos(a), LANE.z];
  });
  return evenly([[x0, y0, LANE.z], ...bend, [x1, y1, LANE.z]], LANE.steps);
};

/** A lane in the direction the event flows. */
const lanePoints = (from: Slot, to: Slot): Vec3[] =>
  from === "ai" ? appLane(to as App).toReversed() : appLane(from as App);

const lanePath = (cam: IsoCamera, pts: readonly Vec3[]) =>
  pts
    .map((p, i) => `${i === 0 ? "M" : "L"}${projectWith(cam, p).join(",")}`)
    .join(" ");

/** The part of a sampled lane between two fractions of its length. */
const slice = (pts: readonly Vec3[], from: number, to: number) => {
  const n = pts.length - 1;
  const lo = Math.max(0, Math.min(n, from * n));
  const hi = Math.max(0, Math.min(n, to * n));
  if (hi - lo < 1e-3) {
    return [];
  }
  const at = (f: number): Vec3 => {
    const i = Math.min(n - 1, Math.floor(f));
    const k = f - i;
    const [a, b] = [pts[i], pts[i + 1]];
    return [
      a[0] + (b[0] - a[0]) * k,
      a[1] + (b[1] - a[1]) * k,
      a[2] + (b[2] - a[2]) * k,
    ];
  };
  const inner = pts.slice(Math.ceil(lo), Math.floor(hi) + 1);
  return [at(lo), ...inner, at(hi)];
};

/** A clock-driven value, re-rendered only when it changes. */
const useClockValue = <T,>(
  clock: MotionValue<number> | undefined,
  read: (ms: number) => T,
  still: boolean
) => {
  const idle = useMotionValue(0);
  const [value, setValue] = useState<T>(() => read(still ? STILL_MS : 0));
  const last = useRef(JSON.stringify(value));
  useMotionValueEvent(clock ?? idle, "change", (ms) => {
    const next = read(ms);
    const key = JSON.stringify(next);
    if (key !== last.current) {
      last.current = key;
      setValue(next);
    }
  });
  return value;
};

const r2 = (n: number) => Math.round(n * 200) / 200;

/**
 * The two lanes: dashed hairlines on the floor with one rounded bend, and the
 * brand ink that fills them solid in the direction the event runs, with a
 * bead at its head while it travels.
 */
const Lanes = ({
  camera,
  clock,
  events,
  still,
}: {
  camera: IsoCamera;
  clock: MotionValue<number> | undefined;
  events: readonly WorkflowEvent[];
  still: boolean;
}) => {
  const ink = useClockValue(
    clock,
    (ms) => {
      const { index, t } = phase(ms, events.length);
      return {
        head1: r2(sample(LANE1_HEAD, t)),
        head2: r2(sample(LANE2_HEAD, t)),
        index,
        tail: r2(sample(INK_TAIL, t)),
      };
    },
    still
  );
  const from = events[ink.index]?.from ?? "mail";
  const to = otherApp(from);
  const legs = [
    { head: ink.head1, pts: lanePoints(from, "ai") },
    { head: ink.head2, pts: lanePoints("ai", to) },
  ];
  return (
    <g fill="none" strokeLinecap="round">
      {/* The dashed lanes, always there: the routes the events travel. */}
      {legs.map(({ pts }) => (
        <path
          d={lanePath(camera, pts)}
          key={`d${pts[0].join(",")}`}
          stroke="var(--iso-guide)"
          strokeDasharray="0.32 0.3"
          strokeWidth={0.075}
        />
      ))}
      {legs.map(({ head, pts }) => {
        const run = slice(pts, ink.tail, head);
        if (run.length < 2) {
          return null;
        }
        const travelling = head > 0 && head < 1;
        const [bx, by] = projectWith(camera, run.at(-1) as Vec3);
        return (
          <g key={`i${pts[0].join(",")}`}>
            <path
              d={lanePath(camera, run)}
              stroke="var(--iso-tone)"
              strokeWidth={0.15}
            />
            {travelling ? (
              <circle cx={bx} cy={by} fill="var(--iso-tone)" r={0.26} />
            ) : null}
          </g>
        );
      })}
    </g>
  );
};

/* ───────────────────────────── Tiles ──────────────────────────────────── */

const EDGE: CSSProperties = {
  stroke: "var(--iso-edge, var(--iso-contour))",
  strokeLinejoin: "round",
  strokeWidth: "var(--iso-edge-w, var(--iso-contour-w))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};
const TONE_LINE: CSSProperties = {
  stroke: "var(--iso-tone)",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: "calc(var(--iso-edge-w, 1px) * 1.6)",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/** The mail app: an envelope lying on the tile, its flap in the brand. */
const MailGlyph = () => {
  const at = tileAt("mail");
  const top: Vec3 = [at[0], at[1], tileTop("mail")];
  return (
    <>
      <FacePath
        at={top}
        d={roundedRect(2.2, 3, 0.26, 1.4, 1)}
        fill="var(--iso-screen)"
        plane="top"
        style={EDGE}
      />
      {/* The flap folds from the long back edge, tinted, edged in the brand. */}
      <FacePath
        at={top}
        d="M1.55 1.15 L2.65 2.5 L1.55 3.85 Z"
        fill="color-mix(in oklab, var(--iso-tone) 16%, var(--iso-screen))"
        plane="top"
        style={TONE_LINE}
      />
    </>
  );
};

/** The chat app: a speech bubble with a typing indicator. */
const ChatGlyph = () => {
  const at = tileAt("chat");
  const top: Vec3 = [at[0], at[1], tileTop("chat")];
  return (
    <>
      {/* The tail first, so the bubble's body covers its inner edge. */}
      <FacePath
        at={top}
        d="M1.7 3 L1.25 4.05 L2.6 3.1 Z"
        fill="var(--iso-screen)"
        plane="top"
        style={EDGE}
      />
      <FacePath
        at={top}
        d={roundedRect(2.9, 2, 0.7, 1.05, 1.3)}
        fill="var(--iso-screen)"
        plane="top"
        style={EDGE}
      />
      {[1.85, 2.5, 3.15].map((u) => (
        <FaceEllipse
          center={[top[0] + u, top[1] + 2.3, top[2]]}
          fill="var(--iso-tone)"
          key={u}
          plane="top"
          r={0.2}
        />
      ))}
    </>
  );
};

/** A four-point sparkle in face units, from quadratic curves through its centre. */
const sparkle = (cx: number, cy: number, r: number) =>
  `M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r} Z`;

/** The AI step's mark: a big sparkle and a small one, printed on the brand tile. */
const AiGlyph = () => {
  const at = tileAt("ai");
  const top: Vec3 = [at[0], at[1], tileTop("ai")];
  return (
    <FacePath
      at={top}
      d={`${sparkle(2.5, 2.55, 1.45)} ${sparkle(3.85, 1.2, 0.55)}`}
      fill="var(--iso-on-main)"
      plane="top"
    />
  );
};

/* ───────────────────────────── Labels ─────────────────────────────────── */

const TETHER: CSSProperties = {
  strokeWidth: "var(--iso-guide-w)",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/**
 * A lit label standing over an app tile on a dashed tether: a round badge
 * ("1" for the event, a check for the result), the label, and its detail
 * muted. Rises out of the tile (scale about the tether's foot).
 */
const Label = ({
  slot,
  kind,
  label,
  detail,
}: {
  slot: App;
  kind: "event" | "result";
  label: string;
  detail: string;
}) => {
  const [cx, cy] = CENTRES[slot];
  const w = pillWidth(label.length + detail.length + 3);
  const bottom = tileTop(slot) + PILL.gap;
  const at: Vec3 = [cx - w / 2, cy + PILL.y, bottom + PILL.h];
  return (
    <>
      <FacePath
        at={[cx, cy, 0]}
        d={`M0 ${-tileTop(slot)} V${-(bottom + 0.4)}`}
        fill="none"
        plane="left"
        stroke="var(--iso-guide)"
        strokeDasharray="0.22 0.2"
        strokeLinecap="butt"
        style={TETHER}
      />
      <Panel
        at={at}
        content={(_, h) => (
          <>
            <circle
              cx={0.82}
              cy={h / 2}
              fill={kind === "event" ? "var(--destructive)" : "var(--iso-tone)"}
              r={0.44}
            />
            <text
              fill="white"
              fontSize={0.48}
              fontWeight={700}
              textAnchor="middle"
              x={0.82}
              y={h / 2 + 0.17}
            >
              {kind === "event" ? "1" : "✓"}
            </text>
            <text
              fill="var(--iso-screen-ink)"
              fontSize={0.54}
              fontWeight={600}
              x={1.52}
              y={h / 2 + 0.19}
            >
              {label}
              <tspan fontWeight={500} opacity={0.55}>
                {` · ${detail}`}
              </tspan>
            </text>
          </>
        )}
        depth={PILL.depth}
        frontStyle={{ fill: "var(--iso-screen)" }}
        radius={PILL.h / 2}
        size={[w, PILL.h]}
      />
    </>
  );
};

/* ───────────────────────────── Poses ──────────────────────────────────── */

const labelPose =
  (slot: App, events: readonly WorkflowEvent[]) =>
  (ms: number): IsoPose => {
    const { index, t } = phase(ms, events.length);
    const source = (events[index]?.from ?? "mail") === slot;
    const pop = sample(source ? EVENT_POP : RESULT_POP, t);
    return { scale: Math.max(0.001, pop) };
  };

const aiPose = (ms: number): IsoPose => ({
  scale: [1, 1, sample(AI_PRESS, ms % TIMING.period)],
});
const sparklePose = (ms: number): IsoPose => ({
  axis: "z",
  rotate: sample(AI_TURN, ms % TIMING.period),
});

/** Rig props: animated on the clock, or the pose at STILL_MS held. */
const rigged = (
  clock: MotionValue<number> | undefined,
  pose: (ms: number) => IsoPose
) => (clock ? { clock, pose } : pose(STILL_MS));

/* ───────────────────────────── Shell ──────────────────────────────────── */

// A turnable scene is a focusable group that says how to turn it.
const turnableLabel = (rotate: IsoRotate, title?: string) =>
  rotate === "off"
    ? {}
    : {
        "aria-label": `${title ?? "Illustration"}. Move the pointer or use the left and right arrow keys to turn it.`,
        role: "group",
      };

interface PointerLike {
  button: number;
  clientX: number;
  clientY: number;
  currentTarget: Element;
  pointerId: number;
}
interface OrbitHandlers {
  onPointerDown?: (e: PointerLike) => void;
  onPointerUp?: () => void;
}

/** In view, reduced motion, the clock (restarted on a plain click) and the camera. */
const useShell = ({
  autoPlay,
  orbit,
  rotate,
}: {
  autoPlay: boolean;
  orbit: IsoOrbit;
  rotate: IsoRotate;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion() ?? false;
  const still = reduced || !autoPlay;
  const [run, setRun] = useState(0);
  const clock = useClock(inView && !still, run);
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  // A plain click (no drag) replays from the first event; drags still turn.
  const pressed = useRef({ x: 0, y: 0 });
  const handlers = orbitProps as OrbitHandlers;
  const pointer = {
    onPointerDown: (e: PointerLike) => {
      pressed.current = { x: e.clientX, y: e.clientY };
      handlers.onPointerDown?.(e);
    },
    onPointerUp: (e: PointerLike) => {
      handlers.onPointerUp?.();
      const moved =
        Math.hypot(
          e.clientX - pressed.current.x,
          e.clientY - pressed.current.y
        ) > 6;
      if (!(still || moved)) {
        setRun((n) => n + 1);
      }
    },
  };
  return {
    camera,
    clock: still ? undefined : clock,
    orbitProps,
    pointer,
    ref,
    still,
  };
};

/** Stage overrides: no hairline contour outside the blueprint. */
const stageStyle = (line: boolean) =>
  ({
    "--iso-contour-w": line ? undefined : "0",
  }) as CSSProperties;

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface WorkflowTriggerProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. The AI step, the ink and the checks. */
  tone?: IsoTone;
  /** Colour of lit details. Defaults to `tone`. */
  accent?: IsoTone;
  /**
   * The events, in the order they fire, one per cycle. Each lands in one
   * app and the workflow acts in the other. Default: a new email from Acme
   * Inc. posts a summary to #sales, then a /follow-up in #sales sends Acme
   * Inc. an email.
   */
  events?: WorkflowEvent[];
  /** Soft gradient drawing with a tinted outline (default), flat ink, soft tint, full colour, or blueprint outline. */
  variant?: IsoVariant;
  /** Line weight: in `soft` 0.3 is a 1 px outline at any size (1.3 px in `ink`). */
  strokeWidth?: number;
  /** Plays while in view, one event per cycle, looping. Off shows the first event finished. */
  autoPlay?: boolean;
  /** Dashed construction grid on the floor. */
  grid?: boolean;
  /**
   * Let the viewer turn the scene: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /** How far it turns, in degrees: a number for both ways, or [min, max]. Default [-12, 30]. */
  orbit?: IsoOrbit;
  /** Accessible description. Without it the scene is decorative. */
  title?: string;
  /** Classes for the wrapper; size the scene with width (it keeps its aspect ratio). */
  className?: string;
}

/**
 * Workflow trigger, in soft isometric: a mail app, an AI step and a chat
 * app as rounded tiles floating level, joined by dashed floor lanes with a
 * rounded bend. An event lands in one app (a label rises: "1 · New
 * email"), brand ink fills the lane to the AI step, which presses in and
 * turns its sparkle, then fills on to the other app, whose label shows
 * what the workflow did. Events take turns, so the flow runs both ways. Click to
 * replay; leans with the pointer. Follows the shadcn theme.
 */
export const WorkflowTrigger = ({
  tone = "primary",
  accent,
  events = DEFAULT_EVENTS,
  variant = "soft",
  strokeWidth = 0.3,
  autoPlay = true,
  grid = false,
  rotate = "pointer",
  orbit = DEFAULT_ORBIT,
  title,
  className,
}: WorkflowTriggerProps) => {
  const { camera, clock, orbitProps, pointer, ref, still } = useShell({
    autoPlay,
    orbit,
    rotate,
  });
  // Which event is playing, and which labels are up (a hidden label is
  // not drawn at all: scaled to nothing, its outline would leave a dot).
  const story = useClockValue(
    clock,
    (ms) => {
      const { index, t } = phase(ms, events.length);
      return {
        event: sample(EVENT_POP, t) > 0.01,
        index,
        result: sample(RESULT_POP, t) > 0.01,
      };
    },
    still
  );
  const current = events[story.index] ?? DEFAULT_EVENTS[0];
  return (
    <div
      {...turnableLabel(rotate, title)}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      data-slot="workflow-trigger"
      ref={ref}
      {...orbitProps}
      onPointerDown={pointer.onPointerDown}
      onPointerUp={pointer.onPointerUp}
    >
      <IsoStage
        accent={accent}
        bounds={BOUNDS}
        camera={camera}
        orbit={rotate === "off" ? 0 : orbit}
        shadow={false}
        strokeWidth={strokeWidth}
        style={stageStyle(variant === "line")}
        title={title}
        tone={tone}
        variant={variant}
      >
        {grid ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null}
        <Lanes camera={camera} clock={clock} events={events} still={still} />
        {/* The apps, far to near (chat behind mail), still. */}
        {APPS_FAR_TO_NEAR.map((slot) => (
          <g key={slot}>
            <Slab
              at={tileAt(slot)}
              palette="surface"
              radius={TILE.radius}
              size={[TILE.size, TILE.size, TILE.depth]}
            />
            {slot === "mail" ? <MailGlyph /> : <ChatGlyph />}
          </g>
        ))}
        {/* The AI step, to the right: the one lit thing. */}
        <Rig pivot={CENTRES.ai} {...rigged(clock, aiPose)}>
          <Slab
            at={tileAt("ai")}
            palette="main"
            radius={TILE.radius}
            size={[TILE.size, TILE.size, TILE.depth]}
          />
          <Rig pivot={topCentre("ai")} {...rigged(clock, sparklePose)}>
            <AiGlyph />
          </Rig>
        </Rig>
        {APPS_FAR_TO_NEAR.map((slot) => {
          const source = slot === current.from;
          if (!(source ? story.event : story.result)) {
            return null;
          }
          return (
            <Rig
              key={`label-${slot}`}
              pivot={topCentre(slot)}
              {...rigged(clock, labelPose(slot, events))}
            >
              <Label
                detail={source ? current.detail : current.resultDetail}
                kind={source ? "event" : "result"}
                label={source ? current.event : current.result}
                slot={slot}
              />
            </Rig>
          );
        })}
      </IsoStage>
    </div>
  );
};

export default WorkflowTrigger;
