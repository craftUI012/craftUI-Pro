"use client";

import type { CSSProperties, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  EASE,
  Face,
  FacePath,
  FloorGrid,
  IsoStage,
  Rig,
  roundedRect,
  sample,
  shiftTrack,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoKey,
  IsoOrbit,
  IsoPose,
  IsoRotate,
  IsoTone,
  IsoTrack,
  IsoVariant,
  Vec3,
} from "./iso-core";
import {
  ButtonIcon,
  FRONT_POSE,
  ICON,
  facing,
  onClock,
  r2,
  useLineShell,
  useReduced,
} from "./iso-line";
import type { LineClip, LineStateProps } from "./iso-line";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * An empty state told by one object: a blank ID badge hanging from its
 * strap, a placeholder where the photo goes and a plus on its corner.
 * Nobody is on the team yet. Under it, the empty state's own words: a
 * heading, a line, a button. Drawn in ink, no shadow, facing the screen.
 * Each value is ms after it comes into view.
 *
 *    0ms   hanging straight and still
 *  400ms   flicked: the strap swings out and back, each swing smaller
 *          (about 1.4s); the badge twists on the strap, the same way
 *  490ms   the card follows on its eyelet, 90ms behind and the other way
 * 1500ms   as it comes to rest, the plus on the photo pulses once
 * 2100ms   still
 *
 * Rest to rest, so one clip built twice: 400ms wait in view, 80ms when
 * `active` turns true (and again after a 5.2s hold with `loop`).
 * Reduced motion, or `active` false before any play: hanging still. It
 * leans with the pointer either way.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // When `active` turns true the flick comes this soon.
  again: 80,
  // The flick, after the badge comes into view.
  flick: 400,
  // Milliseconds of one half swing of the strap.
  half: 230,
  // How long the card lags the strap.
  lag: 90,
  // The plus pulses, this long after the flick.
  pulse: 1100,
};

/* The flick: the first swing of each part, in degrees. Small on purpose:
 * mid-swing the badge is off the isometric axes, and a wide swing reads
 * as drawn wrong rather than as moving. */
const FLICK = {
  // The card on its eyelet.
  card: 5,
  // How much smaller each half swing is than the one before.
  decay: 0.62,
  // The strap about its top.
  strap: -6,
  // The badge about the strap.
  twist: 11,
};

/* How much the plus grows when it pulses. */
const PULSE = 0.3;

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// The card: a rounded panel facing the viewer's left (+y), hanging clear
// of the floor. Behind its top edge, the clip's plate with the eyelet.
// Every part is a flat face on one plane, one outline each: a card, plate
// and strap with thickness drew strips that tapered into doubled smudges
// round their rounded corners. Paint order alone puts one over another.
const CARD = { h: 6.6, r: 0.5, w: 5.4, z: 1.2 };
const CARD_TOP = CARD.z + CARD.h;
const FRONT_Y = 0;
// The card's front face, top-left corner: the origin of its details.
const CARD_AT: Vec3 = [-CARD.w / 2, FRONT_Y, CARD_TOP];

// The clip's plate: mostly above the card, its foot hidden behind it.
const PLATE = { above: 0.85, foot: 0.5, r: 0.3, w: 1.8 };
const PLATE_Y = FRONT_Y;
const PLATE_AT: Vec3 = [-PLATE.w / 2, PLATE_Y, CARD_TOP + PLATE.above];
// The eyelet in the plate, where the strap passes through and the card
// turns: one hole, a clear margin inside the plate's top edge.
const EYELET = { hole: 0.22, v: 0.44 };
const EYELET_AT: Vec3 = [0, PLATE_Y, CARD_TOP + PLATE.above - EYELET.v];

// The strap: a slim rounded bar rising from the eyelet to where it hangs.
// Its foot is cut along the hole's top, so it runs into the hole and
// shares its outline there (a rounded end over the hole drew a second
// circle a hair inside it).
const STRAP = { h: 1.75, w: 0.34 };
const ANCHOR: Vec3 = [0, PLATE_Y, EYELET_AT[2] + STRAP.h - STRAP.w / 2];
const STRAP_AT: Vec3 = [-STRAP.w / 2, PLATE_Y, ANCHOR[2]];

// On the card's face (u across, v down from its top edge): the photo
// window with a placeholder figure, two lines for a name and a role, and
// the plus on the window's corner.
const PHOTO = { r: 0.3, size: 3.3, u: (CARD.w - 3.3) / 2, v: 0.85 };
const FIGURE = {
  // The head: radius, and its centre below the window's top.
  head: 0.68,
  headV: 1.2,
  // The shoulders: half their width, and their top below the window's top.
  shoulders: 1.25,
  shouldersV: 2.15,
};
const LINES: { u: number; v: number; w: number }[] = [
  { u: 1.1, v: 4.75, w: 1.25 },
  { u: 2.55, v: 4.75, w: 1.75 },
  { u: 1.5, v: 5.3, w: 1.15 },
  { u: 2.85, v: 5.3, w: 1.05 },
];
const LINE_H = 0.2;
const PLUS = {
  // Half the length of each arm, and its thickness.
  arm: 0.24,
  bar: 0.11,
  r: 0.48,
  u: PHOTO.u + PHOTO.size - 0.12,
  v: PHOTO.v + PHOTO.size - 0.12,
};
const PLUS_AT: Vec3 = [CARD_AT[0] + PLUS.u, CARD_AT[1], CARD_AT[2] - PLUS.v];

// The frame: the badge at rest with a little room, up to the anchor. The
// widest swings run into the stage's padding, which is not clipped.
const REACH = { x: CARD.w / 2 + 0.7, y: 0.6 };
const BOUNDS: Vec3[] = [
  [-REACH.x, FRONT_Y, CARD.z - 0.2],
  [REACH.x, FRONT_Y, CARD.z - 0.2],
  [-REACH.x, FRONT_Y, CARD_TOP],
  [REACH.x, FRONT_Y, CARD_TOP],
  [0, REACH.y, CARD.z],
  [0, -REACH.y, CARD_TOP],
  [0, PLATE_Y, ANCHOR[2] + STRAP.w / 2],
];

const GRID = { at: [-6, -6] as const, size: [12, 12] as const };
const PIVOT: readonly [number, number] = [0, 0];
/* ───────────────────────────── The view ───────────────────────────────── */

type View = "front" | "isometric";

/**
 * Facing the screen (the kit's front view: turned 45° about the vertical,
 * stretched √(3/2) in height, its thickness along its top edge and down a
 * side as it turns), or left at the isometric three-quarter angle.
 */
const VIEW_POSE: Record<View, IsoPose> = {
  front: FRONT_POSE,
  isometric: {},
};
const boundsFor = (view: View) =>
  view === "front" ? BOUNDS.map(facing) : BOUNDS;

// How far it turns by default: evenly either way from the front. At the
// isometric angle the badge's face is 45° from edge-on on one side and it
// twists 11° on its strap, so the camera stops at 20° that way.
const ORBITS: Record<View, IsoOrbit> = { front: 16, isometric: [-12, 20] };

/* ───────────────────────────── Tracks ─────────────────────────────────── */

/**
 * A swing that dies away, as an offset from rest: out to `amp`, back
 * through rest to the other side, each half swing smaller than the last.
 */
const swing = (amp: number, start: number, half: number): IsoTrack => {
  const keys: IsoKey[] = [[start, 0, EASE.soft]];
  let reach = amp;
  let at = start + Math.round(half * 0.7);
  for (let i = 0; i < 6; i += 1) {
    keys.push([at, reach, EASE.easy]);
    reach *= -FLICK.decay;
    at += half;
  }
  keys.push([at, 0]);
  return keys;
};

/** One run of the clock: what each part does, and when it is at rest. */
interface Clip extends LineClip {
  card: IsoTrack;
  plus: IsoTrack;
  strap: IsoTrack;
  twist: IsoTrack;
}

// The beat itself, the flick `t0` ms into a run.
const beat = (t0: number): Clip => {
  const pulse = t0 + TIMING.pulse;
  const tracks = {
    // The card answers late and a little slower; the twist slower again.
    card: shiftTrack(swing(FLICK.card, t0, TIMING.half + 20), TIMING.lag),
    plus: [
      [pulse, 0, EASE.soft],
      [pulse + 160, PULSE, EASE.easy],
      [pulse + 520, 0],
    ] as IsoTrack,
    strap: swing(FLICK.strap, t0, TIMING.half),
    twist: swing(FLICK.twist, t0, TIMING.half + 45),
  };
  // At rest once the slowest part (the twist's last small swing) is.
  const end = Math.max(
    ...Object.values(tracks).map((track) => track.at(-1)?.[0] ?? 0)
  );
  return { ...tracks, end };
};

// The first run waits a moment after coming into view; `active` does not.
const INTRO = beat(TIMING.flick);
const AGAIN = beat(TIMING.again);

/** The poses of one clip. */
const posesOf = (clip: Clip) => ({
  card: (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.card, ms)),
  }),
  plus: (ms: number): IsoPose => ({
    scale: r2(1 + sample(clip.plus, ms)),
  }),
  strap: (ms: number): IsoPose => ({
    axis: "y",
    rotate: r2(sample(clip.strap, ms)),
  }),
  twist: (ms: number): IsoPose => ({
    axis: "z",
    rotate: r2(sample(clip.twist, ms)),
  }),
});

/* ───────────────────────────── Pieces ─────────────────────────────────── */

// The one outline, for marks a scene strokes itself (the lit variants
// have no pixel edge, so they fall back to their hairline).
const LINE: CSSProperties = {
  stroke: "var(--iso-edge, var(--iso-stroke))",
  strokeLinejoin: "var(--iso-join, round)" as CSSProperties["strokeLinejoin"],
  strokeWidth: "var(--iso-edge-w, calc(var(--iso-stroke-width) * 0.6))",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

/** A circle in face units, as four cubic quarter turns. */
const circlePath = (u: number, v: number, r: number) =>
  roundedRect(2 * r, 2 * r, r, u - r, v - r);

/** The clip's plate and its eyelet: the hole through it. */
const Clip = () => (
  <>
    <FacePath
      at={PLATE_AT}
      d={roundedRect(PLATE.w, PLATE.above + PLATE.foot, PLATE.r)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-surface-left)" }}
    />
    <FacePath
      at={PLATE_AT}
      d={circlePath(PLATE.w / 2, EYELET.v, EYELET.hole)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-inside)" }}
    />
  </>
);

/** The card, with the photo window, the placeholder figure and the lines. */
const Card = () => {
  const cu = CARD.w / 2;
  const bottom = PHOTO.v + PHOTO.size;
  const top = PHOTO.v + FIGURE.shouldersV;
  return (
    <>
      <FacePath
        at={CARD_AT}
        d={roundedRect(CARD.w, CARD.h, CARD.r)}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-surface-left)" }}
      />
      <FacePath
        at={CARD_AT}
        d={roundedRect(PHOTO.size, PHOTO.size, PHOTO.r, PHOTO.u, PHOTO.v)}
        plane="left"
        style={{ ...LINE, fill: "var(--iso-surface-top)" }}
      />
      <Face at={CARD_AT} plane="left">
        <g fill="var(--iso-ink)" opacity={0.16}>
          <path d={circlePath(cu, PHOTO.v + FIGURE.headV, FIGURE.head)} />
          <path
            d={`M${cu - FIGURE.shoulders} ${bottom} Q${cu - FIGURE.shoulders} ${top} ${cu} ${top} Q${cu + FIGURE.shoulders} ${top} ${cu + FIGURE.shoulders} ${bottom} Z`}
          />
          {LINES.map((l) => (
            <rect
              height={LINE_H}
              key={`${l.u},${l.v}`}
              rx={LINE_H / 2}
              width={l.w}
              x={l.u}
              y={l.v}
            />
          ))}
        </g>
      </Face>
    </>
  );
};

/** The plus on the photo's corner: the one brand mark. */
const Plus = () => (
  <>
    <FacePath
      at={CARD_AT}
      d={circlePath(PLUS.u, PLUS.v, PLUS.r)}
      plane="left"
      style={{ ...LINE, fill: "var(--iso-main-left)" }}
    />
    <Face at={CARD_AT} plane="left">
      <rect
        fill="var(--iso-on-main)"
        height={PLUS.bar}
        rx={PLUS.bar / 2}
        width={PLUS.arm * 2}
        x={PLUS.u - PLUS.arm}
        y={PLUS.v - PLUS.bar / 2}
      />
      <rect
        fill="var(--iso-on-main)"
        height={PLUS.arm * 2}
        rx={PLUS.bar / 2}
        width={PLUS.bar}
        x={PLUS.u - PLUS.bar / 2}
        y={PLUS.v - PLUS.arm}
      />
    </Face>
  </>
);

/**
 * The strap, in face units (u across, v down from its top): a slim bar
 * with a rounded top, its foot cut along the top of the eyelet's hole
 * (centred at the strap's foot less half its width). The cut is the hole's
 * arc as one quadratic through its top.
 */
const strapPath = () => {
  const { w, h } = STRAP;
  const r = w / 2;
  const k = r * 0.5523;
  const centre = h - r;
  const meet = r2(centre - Math.sqrt(EYELET.hole ** 2 - r ** 2));
  const apex = centre - EYELET.hole;
  return [
    `M0 ${r}`,
    `C0 ${r2(r - k)} ${r2(r - k)} 0 ${r} 0`,
    `C${r2(r + k)} 0 ${w} ${r2(r - k)} ${w} ${r}`,
    `V${meet}`,
    `Q${r} ${r2(2 * apex - meet)} 0 ${meet}`,
    "Z",
  ].join(" ");
};
const STRAP_PATH = strapPath();

/** The strap: a slim bar from the eyelet up to where the badge hangs. */
const Strap = () => (
  <FacePath
    at={STRAP_AT}
    d={STRAP_PATH}
    plane="left"
    style={{ ...LINE, fill: "var(--iso-surface-left)" }}
  />
);

/* ───────────────────────────── Shell ──────────────────────────────────── */

// A turnable scene is a focusable group that says how to turn it.
const turnableLabel = (rotate: IsoRotate, title?: string) =>
  rotate === "off"
    ? {}
    : {
        "aria-label": `${title ?? "Illustration"}. Move the pointer or use the left and right arrow keys to turn it.`,
        role: "group",
      };

// In ink the walls step down half as far as the house ramp (0.03 and 0.07
// under the top, not 0.06 and 0.13): an empty state is a quiet line
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
 * the outline on the side edges of rounded parts, and the value seen
 * through the eyelet.
 */
const stageStyle = (variant: IsoVariant) =>
  ({
    "--iso-contour-w": "0",
    ...(variant === "ink" ? PAPER : {}),
    ...(variant === "line" ? BLUEPRINT : {}),
    ...(variant === "ink" || variant === "line" ? NO_RIM : {}),
    "--iso-inside": "oklch(from var(--iso-surface-right-c) calc(l - 0.1) c h)",
    "--iso-silhouette": "var(--iso-edge, none)",
  }) as CSSProperties;

/* ───────────────────────────── Copy ───────────────────────────────────── */

// Optical padding: an icon carries its own white space, so the label's
// side gets 2px more than the icon's side (12px and 14px) or the label
// looks pushed against the edge. The second class wins over a Button that
// already nudges this side itself.
const BUTTON =
  "rounded-full has-[>svg]:pl-3 has-[>svg]:pr-3.5 has-data-[icon=inline-start]:pr-3.5";

/**
 * The empty state's own words, under the badge: the heading, a line of
 * copy, and the actions (the built-in button, or whatever is passed in).
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
      <ButtonIcon d={ICON.plus} />
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

export interface IdBadgeProps extends LineStateProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. It shows on the plus at the photo's corner; the rest of the badge stays neutral. */
  tone?: IsoTone;
  /** "ink" (default): a fine outline with a whisper of shading on the walls. "line": the outline alone, faces the colour of the page. "soft", "duotone" and "solid" are the lit, coloured looks. */
  variant?: IsoVariant;
  /** Line weight: in `ink` and `line` the default 0.23 is a 1 px outline at any size (0.3 is the 1.3 px of the larger scenes). */
  strokeWidth?: number;
  /** Flicks the badge each time it turns true (hover, focus, an invite going out…). Left out, it is flicked once when the badge scrolls into view. Pass false to keep it hanging still until you say. */
  active?: boolean;
  /** Flick it again after a long hold (while `active`, or always when `active` is left out). Off (default) suits an empty state people sit in front of. */
  loop?: boolean;
  /** How it faces: "front" (default) turns it square to the screen, level and plumb; "isometric" shows it at the isometric three-quarter angle. */
  view?: "front" | "isometric";
  /** Dashed construction grid on the floor. */
  grid?: boolean;
  /**
   * Let the viewer turn the badge: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /** How far it turns, in degrees: a number for both ways, or [min, max]. Default 16 in the front view, [-12, 20] in the isometric one (keep that one under 25, or the twisting badge goes edge-on). */
  orbit?: IsoOrbit;
  /** Accessible description of the illustration. Without it the badge is decorative and the copy speaks for it. */
  title?: string;
  /** Classes for the illustration alone; size it with width (it keeps its aspect ratio). Default `w-52`. */
  artClassName?: string;
  /** Classes for the wrapper of the whole empty state (it is a centred column, `max-w-sm` wide). */
  className?: string;
}

/**
 * ID badge: a complete empty state ("No members yet") with an isometric
 * ink illustration, a heading, a line of copy and a button, all props.
 * A blank ID badge hangs from its strap: a clip plate with an eyelet, a
 * photo window with a placeholder figure, two lines for a name and a
 * role. It is flicked once, swings and twists to rest, and the plus on
 * the photo's corner (the one brand mark, like the button under it)
 * pulses. One even outline, no shadow. It plays when it comes into view,
 * or each time `active` turns true (PlayOnHover, or your own state); it
 * leans with the pointer. Follows the shadcn theme.
 */
export const IdBadge = ({
  heading = "No members yet",
  description = "Start by adding your first member to collaborate and get things rolling.",
  actionLabel = "Add new member",
  onAction,
  children,
  tone = "primary",
  variant = "ink",
  strokeWidth = 0.23,
  active,
  loop = false,
  onPlayEnd,
  view = "front",
  grid = false,
  rotate = "pointer",
  orbit,
  title,
  artClassName,
  className,
}: IdBadgeProps) => {
  const turn = orbit ?? ORBITS[view];
  const { clip, clock, ref } = useLineShell({
    active,
    again: AGAIN,
    intro: INTRO,
    loop,
    onPlayEnd,
  });
  const reduced = useReduced();
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit: turn,
    pivot: PIVOT,
    reduced,
  });
  const poses = posesOf(clip);
  return (
    <div
      className={cn(
        "flex w-full max-w-sm flex-col items-center text-center",
        className
      )}
      data-slot="id-badge"
    >
      <div
        {...turnableLabel(rotate, title)}
        className={cn(
          "w-52 max-w-full rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
          artClassName
        )}
        data-slot="id-badge-art"
        ref={ref}
        {...orbitProps}
      >
        <IsoStage
          bounds={boundsFor(view)}
          camera={camera}
          orbit={rotate === "off" ? 0 : turn}
          shadow={false}
          strokeWidth={strokeWidth}
          style={stageStyle(variant)}
          title={title}
          tone={tone}
          variant={variant}
        >
          {/* Everything hangs in one rig that turns it to face the screen
              (or leaves it at the isometric angle). */}
          <Rig pivot={[0, 0, 0]} {...VIEW_POSE[view]}>
            {grid ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null}
            {/* The strap swings about where it hangs; the badge twists on
              it; the card turns on its eyelet. All three come to rest
              straight: plumb and square. */}
            <Rig
              axis="y"
              pivot={ANCHOR}
              {...onClock(clock, poses.strap, clip.end)}
            >
              <Rig
                axis="z"
                pivot={[0, PLATE_Y, 0]}
                {...onClock(clock, poses.twist, clip.end)}
              >
                <Rig
                  axis="y"
                  pivot={EYELET_AT}
                  {...onClock(clock, poses.card, clip.end)}
                >
                  <Clip />
                  <Card />
                  <Rig
                    pivot={PLUS_AT}
                    {...onClock(clock, poses.plus, clip.end)}
                  >
                    <Plus />
                  </Rig>
                </Rig>
                <Strap />
              </Rig>
            </Rig>
          </Rig>
        </IsoStage>
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

export default IdBadge;
