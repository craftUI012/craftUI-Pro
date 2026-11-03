import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Isometric core: true isometric projection, shared 3D primitives, light-based
 * rendering, cast shadows, badges and motion. Icons never draw raw screen
 * paths; they place primitives in world units, so every icon shares one grid,
 * one light and one set of props.
 *
 * Spec: .agents/skills/isometric-scene/references/isometric-math.md
 *
 * World axes: x runs right-down, y runs left-down, z runs up. Every icon fits
 * the 8-unit reference cube: x, y ∈ [-4, 4], z ∈ [0, 8], on a 0.5 grid.
 *
 * Rendering (duotone and solid): faces are separated by light, not lines.
 * Each face is a gradient (lighter where light lands, darker toward its
 * base), shared edges are sealed in the face's own paint, edges that face
 * the light get a thin rim highlight, and the outer silhouette gets a faint
 * hairline so pale objects still read on pale pages. The line variant keeps
 * full outlines instead.
 * ------------------------------------------------------------------------- */

/** Canvas units per world unit (math §8). */
export const ISO_S = 1.25;
/** cos 30°: horizontal reach of one x or y step (math §1). */
const C = Math.sqrt(3) / 2;
/** Circle → ellipse semi-axes per unit radius, drawing scale (math §4). */
const ELLIPSE_MAJOR = Math.sqrt(1.5);
const ELLIPSE_MINOR = Math.SQRT1_2;
/** Width that seals the hairline gap between neighbouring faces. */
const SEAM = 0.05;

export type Vec3 = readonly [number, number, number];

const round = (n: number) => Math.round(n * 100) / 100;

/** World → canvas (math §2): sx = S(x − y)·√3/2, sy = S((x + y)/2 − z). */
export const project = ([x, y, z]: Vec3): [number, number] => [
  round(ISO_S * (x - y) * C),
  round(ISO_S * ((x + y) / 2 - z)),
];

/* ------------------------------- Camera --------------------------------- */

/**
 * The viewpoint: a turn (yaw, degrees) of the camera around a vertical axis
 * through `pivot`. Yaw 0 is true isometric. Any other yaw is still an exact
 * parallel projection (the camera orbits a still scene, so light, shading
 * and shadows stay fixed in the world); only yaw 0 has equal 30° axes.
 * Keep |yaw| under 45° so the same three faces stay in view.
 */
export interface IsoCamera {
  pivot: readonly [number, number];
  yaw: number;
}

export const HOME_CAMERA: IsoCamera = { pivot: [0, 0], yaw: 0 };

const CameraContext = createContext<IsoCamera>(HOME_CAMERA);

/** The camera of the stage around this part (home view outside a stage). */
const useCamera = () => useContext(CameraContext);

// Turning the camera by +yaw is turning the world by −yaw about the pivot.
const toView = (cam: IsoCamera, [x, y, z]: Vec3): Vec3 => {
  if (cam.yaw === 0) {
    return [x, y, z];
  }
  const a = (-cam.yaw * Math.PI) / 180;
  const dx = x - cam.pivot[0];
  const dy = y - cam.pivot[1];
  return [
    cam.pivot[0] + dx * Math.cos(a) - dy * Math.sin(a),
    cam.pivot[1] + dx * Math.sin(a) + dy * Math.cos(a),
    z,
  ];
};

/** World → canvas through a camera. */
export const projectWith = (cam: IsoCamera, p: Vec3) => project(toView(cam, p));

// A world direction (no pivot) → canvas vector.
const projectDir = (cam: IsoCamera, d: Vec3): [number, number] => {
  const [x, y, z] = toView({ pivot: [0, 0], yaw: cam.yaw }, d);
  return [ISO_S * (x - y) * C, ISO_S * ((x + y) / 2 - z)];
};

const points = (list: readonly Vec3[], cam: IsoCamera = HOME_CAMERA) =>
  list.map((p) => projectWith(cam, p).join(",")).join(" ");

const pathOf = (
  list: readonly Vec3[],
  close = false,
  cam: IsoCamera = HOME_CAMERA
) =>
  `${list.map((p, i) => `${i === 0 ? "M" : "L"}${projectWith(cam, p).join(",")}`).join(" ")}${close ? " Z" : ""}`;

/* ------------------------------- Light ---------------------------------- */

// L ∝ (1, 2, 3), from the upper left (math §5). The left wall (+y) is the
// base color; any face steps oklch lightness by k · (n·L − n_left·L).
const L_NORM = Math.sqrt(14);
const LZ = 3 / L_NORM;
const L_BASE = 2 / L_NORM;

/**
 * Flat color for a face with normal n, shaded from the palette's base. Lx
 * and Ly come from CSS variables so `mirror` can swap them (math §7).
 */
const lit = (palette: IsoPalette, [nx, ny, nz]: Vec3) => {
  const len = Math.hypot(nx, ny, nz) || 1;
  const x = round((nx / len) * 1000) / 1000;
  const y = round((ny / len) * 1000) / 1000;
  const zTerm = round(((nz / len) * LZ - L_BASE) * 10_000) / 10_000;
  return `oklch(from var(--iso-${palette}-base) clamp(0, calc(l + var(--iso-${palette}-k) * (${x} * var(--iso-lx) + ${y} * var(--iso-ly) + ${zTerm})), 1) c h)`;
};

const isVisible = ([nx, ny, nz]: Vec3) => nx + ny + nz > 1e-6;

/* ------------------------------- Theme ---------------------------------- */

export type IsoTone =
  | "primary"
  | "foreground"
  | "muted"
  | "destructive"
  | "chart-1"
  | "chart-2"
  | "chart-3"
  | "chart-4"
  | "chart-5"
  // Any CSS color also works: "#f97316", "oklch(0.7 0.2 40)", "var(--brand)".
  | (string & Record<never, never>);

export type IsoVariant = "line" | "solid" | "duotone";

/** Which color family a face is shaded from. */
export type IsoPalette = "main" | "accent" | "surface";

type FaceName = "top" | "left" | "right";

const PALETTES: IsoPalette[] = ["main", "accent", "surface"];
const FACES: FaceName[] = ["top", "left", "right"];
const NORMALS: Record<FaceName, Vec3> = {
  left: [0, 1, 0],
  right: [1, 0, 0],
  top: [0, 0, 1],
};

const TONES: Record<string, string> = {
  "chart-1": "var(--chart-1)",
  "chart-2": "var(--chart-2)",
  "chart-3": "var(--chart-3)",
  "chart-4": "var(--chart-4)",
  "chart-5": "var(--chart-5)",
  destructive: "var(--destructive)",
  foreground: "var(--foreground)",
  muted: "var(--muted-foreground)",
  primary: "var(--primary)",
};

const toneColor = (tone: IsoTone) => TONES[tone] ?? tone;

const mix = (a: string, pct: number, b: string) =>
  `color-mix(in oklab, ${a} ${pct}%, ${b})`;

// Shading strength k per variant (math §5): faces sit ±0.088 (duotone) or
// ±0.107 (solid) either side of the base; gradients add a little more.
const K_DUOTONE = 0.33;
const K_SOLID = 0.4;

const paletteBase = (
  name: IsoPalette,
  color: string,
  variant: IsoVariant
): { base: string; k: number } => {
  const card = "var(--iso-card)";
  if (variant === "solid") {
    return {
      base: name === "surface" ? mix(color, 12, card) : color,
      k: K_SOLID,
    };
  }
  if (variant === "duotone") {
    return {
      base: mix(color, name === "surface" ? 6 : 28, card),
      k: K_DUOTONE,
    };
  }
  // Line: faces stay the card color so the outline carries the drawing;
  // accents keep a light tint so status details still read.
  return name === "accent"
    ? { base: mix(color, 30, card), k: K_DUOTONE }
    : { base: card, k: 0 };
};

const paletteVars = (
  name: IsoPalette,
  color: string,
  variant: IsoVariant
): Record<string, string> => {
  const { base, k } = paletteBase(name, color, variant);
  const vars: Record<string, string> = {
    [`--iso-${name}-base`]: base,
    [`--iso-${name}-k`]: String(k),
  };
  for (const face of FACES) {
    vars[`--iso-${name}-${face}-c`] = lit(name, NORMALS[face]);
  }
  // Rim: the lit edge where a top meets the walls.
  vars[`--iso-${name}-rim`] =
    `oklch(from var(--iso-${name}-top-c) clamp(0, calc(l + 0.12), 1) c h)`;
  return vars;
};

// Gradient paints: `--iso-<palette>-<face>` is a url() to this icon's own
// gradient, so `fill: var(--iso-main-left)` paints a lit face.
const paintVars = (uid: string): Record<string, string> => {
  const vars: Record<string, string> = {};
  for (const p of PALETTES) {
    for (const face of FACES) {
      vars[`--iso-${p}-${face}`] = `url(#${uid}-${p}-${face})`;
    }
  }
  return vars;
};

// Outline color per variant for the line variant, and the faint silhouette
// hairline for the edgeless variants.
const STROKE: Record<IsoVariant, (tone: string, ink: string) => string> = {
  duotone: (tone, ink) => mix(mix(tone, 45, ink), 38, "transparent"),
  line: (tone, ink) => mix(tone, 70, ink),
  solid: (tone) => mix(mix(tone, 50, "black"), 55, "transparent"),
};

const themeVars = ({
  tone,
  accent,
  variant,
  strokeWidth,
  mirror,
}: {
  tone: IsoTone;
  accent: IsoTone;
  variant: IsoVariant;
  strokeWidth: number;
  mirror: boolean;
}): Record<string, string> => {
  const t = toneColor(tone);
  const a = toneColor(accent);
  const ink = "var(--iso-ink)";
  const lx = round((1 / L_NORM) * 10_000) / 10_000;
  const ly = round((2 / L_NORM) * 10_000) / 10_000;
  const line = variant === "line";
  return {
    "--iso-accent": a,
    "--iso-card": "var(--card)",
    // Terminals and code: near black in every theme, a whisper of the tone.
    "--iso-console": mix(t, 8, "oklch(0.2 0.01 260)"),
    "--iso-contour": STROKE[variant](t, ink),
    "--iso-contour-w": line
      ? "var(--iso-stroke-width)"
      : "calc(var(--iso-stroke-width) * 0.6)",
    // Details drawn on faces: slots, marks, glyphs.
    "--iso-detail": variant === "solid" ? mix(t, 45, "black") : mix(t, 55, ink),
    // Line variant outlines every face; elsewhere faces seal in their own paint.
    "--iso-edge": line ? mix(t, 70, ink) : "initial",
    "--iso-edge-w": line ? "var(--iso-stroke-width)" : "initial",
    "--iso-glow": a,
    "--iso-ink": "var(--foreground)",
    // Light x and y components; mirroring swaps them (math §7).
    "--iso-lx": String(mirror ? ly : lx),
    "--iso-ly": String(mirror ? lx : ly),
    // Text and marks printed on main-palette faces (cards, chips).
    "--iso-on-main": variant === "solid" ? mix(t, 8, "white") : ink,
    "--iso-rim-w": line ? "0" : "calc(var(--iso-stroke-width) * 0.75)",
    "--iso-road": mix(ink, 9, "var(--iso-card)"),
    // Displays are lit: near white in every theme, so dark mode glows.
    "--iso-screen": mix(t, 5, "white"),
    "--iso-screen-ink": mix(t, 30, "oklch(0.25 0.02 260)"),
    // Shadows only ever darken: soft on light pages, nearly gone on dark ones.
    "--iso-shadow": mix("black", 12, "transparent"),
    "--iso-stroke": STROKE[variant](t, ink),
    "--iso-stroke-width": String(strokeWidth),
    "--iso-text": ink,
    "--iso-tone": t,
    ...paletteVars("main", t, variant),
    ...paletteVars("accent", a, variant),
    ...paletteVars("surface", ink, variant),
  };
};

/** The theme variables an icon sets, for wrappers (scenes) that draw shapes too. */
export const isoThemeStyle = ({
  uid,
  tone = "primary",
  accent,
  variant = "duotone",
  strokeWidth = 0.3,
  mirror = false,
}: {
  uid: string;
  tone?: IsoTone;
  accent?: IsoTone;
  variant?: IsoVariant;
  strokeWidth?: number;
  mirror?: boolean;
}) =>
  ({
    ...themeVars({
      accent: accent ?? tone,
      mirror,
      strokeWidth,
      tone,
      variant,
    }),
    ...paintVars(uid),
  }) as CSSProperties;

/** A stable id usable inside url(#…). */
export const useIsoId = () => useId().replaceAll(/[^a-zA-Z0-9_-]/g, "");

// Gradient direction (objectBoundingBox) and lightness offsets (× k) per
// face: light lands near the top of walls and the back of tops, and falls
// off toward the base, where surfaces meet the ground.
const GRADIENTS: Record<
  FaceName,
  { from: [number, number]; to: [number, number]; stops: [number, number] }
> = {
  left: { from: [0, 0], stops: [0.07, -0.16], to: [0.3, 1] },
  right: { from: [0, 0], stops: [0.02, -0.2], to: [0.3, 1] },
  top: { from: [0.3, 0], stops: [0.1, -0.05], to: [0.7, 1] },
};

/** Gradients and blur filters every icon (and scene) defines for itself. */
export const IsoDefs = ({ uid }: { uid: string }) => (
  <defs>
    {PALETTES.flatMap((p) =>
      FACES.map((face) => {
        const g = GRADIENTS[face];
        const stop = (offset: number) =>
          `oklch(from var(--iso-${p}-${face}-c) clamp(0, calc(l + var(--iso-${p}-k) * ${offset}), 1) c h)`;
        return (
          <linearGradient
            id={`${uid}-${p}-${face}`}
            key={`${p}-${face}`}
            x1={g.from[0]}
            x2={g.to[0]}
            y1={g.from[1]}
            y2={g.to[1]}
          >
            <stop offset="0" style={{ stopColor: stop(g.stops[0]) }} />
            <stop offset="1" style={{ stopColor: stop(g.stops[1]) }} />
          </linearGradient>
        );
      })
    )}
    <filter height="300%" id={`${uid}-cast`} width="300%" x="-100%" y="-100%">
      <feGaussianBlur stdDeviation="0.55" />
    </filter>
    <filter height="300%" id={`${uid}-ao`} width="300%" x="-100%" y="-100%">
      <feGaussianBlur stdDeviation="0.22" />
    </filter>
  </defs>
);

const faceStyle = (palette: IsoPalette, face: FaceName): CSSProperties => ({
  fill: `var(--iso-${palette}-${face})`,
  stroke: `var(--iso-edge, var(--iso-${palette}-${face}))`,
  strokeWidth: `var(--iso-edge-w, ${SEAM})`,
});

const contourStyle: CSSProperties = {
  fill: "none",
  stroke: "var(--iso-contour)",
  strokeWidth: "var(--iso-contour-w)",
};

const rimStyle = (palette: IsoPalette): CSSProperties => ({
  fill: "none",
  stroke: `var(--iso-${palette}-rim)`,
  strokeWidth: "var(--iso-rim-w)",
});

/**
 * A detail stroke as a multiple of the icon's outline weight, so handles,
 * strings and marks follow `strokeWidth` (and a scene's scale correction).
 * Marks keep a floor so they never vanish when outlines are switched off.
 */
export const isoStroke = (multiple: number, floor = 0.15) =>
  `max(${floor}, calc(var(--iso-stroke-width) * ${multiple}))`;

/* ----------------------------- Face mapping ----------------------------- */

export type Plane = FaceName;

/*
 * Face coordinates (u across, v down or toward the viewer) → canvas
 * (math §3). left: wall facing +y, u → +x, v → −z. right: wall facing +x,
 * u → −y, v → −z. top: u → +x, v → +y. All three scale area by S²·√3/2.
 */
// The world directions of each plane's u and v axes.
const PLANE_DIRS: Record<Plane, [Vec3, Vec3]> = {
  left: [
    [1, 0, 0],
    [0, 0, -1],
  ],
  right: [
    [0, -1, 0],
    [0, 0, -1],
  ],
  top: [
    [1, 0, 0],
    [0, 1, 0],
  ],
};

const planeAxes = (
  cam: IsoCamera,
  plane: Plane
): [[number, number], [number, number]] => [
  projectDir(cam, PLANE_DIRS[plane][0]),
  projectDir(cam, PLANE_DIRS[plane][1]),
];

const mapPoint = (
  plane: Plane,
  at: Vec3,
  u: number,
  v: number,
  cam: IsoCamera
) => {
  const [ox, oy] = projectWith(cam, at);
  const [[ux, uy], [vx, vy]] = planeAxes(cam, plane);
  return [round(ox + u * ux + v * vx), round(oy + u * uy + v * vy)];
};

/**
 * Projects a face-coordinate SVG path to canvas coordinates so it can be
 * stroked at an even weight (math §3, "strokes after projection").
 * Supports absolute M, L, H, V, C, Q and Z, which affine maps preserve.
 */
export const mapPath = (
  plane: Plane,
  at: Vec3,
  d: string,
  cam: IsoCamera = HOME_CAMERA
) => {
  const tokens = d.match(/[MLHVCQZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const out: string[] = [];
  let cmd = "";
  let cu = 0;
  let cv = 0;
  let i = 0;
  const take = () => {
    const token = tokens[i];
    i += 1;
    return token;
  };
  const num = () => Number(take());
  const pt = (u: number, v: number) => {
    cu = u;
    cv = v;
    return mapPoint(plane, at, u, v, cam).join(",");
  };
  while (i < tokens.length) {
    if (/^[A-Z]$/i.test(tokens[i])) {
      cmd = take().toUpperCase();
    }
    if (cmd === "Z") {
      out.push("Z");
      continue;
    }
    if (cmd === "M" || cmd === "L") {
      out.push(`${cmd}${pt(num(), num())}`);
      cmd = cmd === "M" ? "L" : cmd;
    } else if (cmd === "H") {
      out.push(`L${pt(num(), cv)}`);
    } else if (cmd === "V") {
      out.push(`L${pt(cu, num())}`);
    } else if (cmd === "C") {
      out.push(`C${pt(num(), num())} ${pt(num(), num())} ${pt(num(), num())}`);
    } else if (cmd === "Q") {
      out.push(`Q${pt(num(), num())} ${pt(num(), num())}`);
    } else {
      i += 1;
    }
  }
  return out.join(" ");
};

/** A rounded rectangle path in face units, corners as cubic quarter circles. */
export const roundedRect = (w: number, h: number, r: number, x = 0, y = 0) => {
  const k = r * 0.5523;
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `C${x + w - r + k} ${y} ${x + w} ${y + r - k} ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `C${x + w} ${y + h - r + k} ${x + w - r + k} ${y + h} ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `C${x + r - k} ${y + h} ${x} ${y + h - r + k} ${x} ${y + h - r}`,
    `V${y + r}`,
    `C${x} ${y + r - k} ${x + r - k} ${y} ${x + r} ${y}`,
    "Z",
  ].join(" ");
};

/**
 * Fill-only 2D details (labels, panels, text, slots) laid flat on a plane
 * through the face matrix. `at` is the face corner where u = v = 0. Text
 * placed here lies in the plane, like printing on the surface. For anything
 * stroked, use `FacePath`, which projects points before stroking.
 */
export const Face = ({
  plane,
  at,
  children,
}: {
  plane: Plane;
  at: Vec3;
  children: ReactNode;
}) => {
  const cam = useCamera();
  const [ox, oy] = projectWith(cam, at);
  const [[a, b], [c, d]] = planeAxes(cam, plane).map(([p, q]) => [
    Math.round(p * 1000) / 1000,
    Math.round(q * 1000) / 1000,
  ]);
  return (
    <g stroke="none" transform={`matrix(${a} ${b} ${c} ${d} ${ox} ${oy})`}>
      {children}
    </g>
  );
};

/** A path in face coordinates, projected first, then stroked or filled. */
export const FacePath = ({
  plane,
  at,
  d,
  ...rest
}: {
  plane: Plane;
  at: Vec3;
  d: string;
} & Omit<SVGProps<SVGPathElement>, "d">) => {
  const cam = useCamera();
  return <path d={mapPath(plane, at, d, cam)} {...rest} />;
};

/**
 * A circle of radius r lying on a plane, as its exact ellipse (math §4): a
 * circle mapped through the plane's matrix. At the home view that is
 * semi-axes S·r·√(3/2) and S·r/√2, major axis horizontal on tops, at 60°
 * down-right on left walls and 60° up-right on right walls; under any other
 * camera it stays exact. Use it for fills (a stroke would be scaled too).
 */
export const FaceEllipse = ({
  plane,
  center,
  r,
  ...rest
}: {
  plane: Plane;
  center: Vec3;
  r: number;
} & Omit<SVGProps<SVGEllipseElement>, "r">) => {
  const cam = useCamera();
  const [cx, cy] = projectWith(cam, center);
  const [[a, b], [c, d]] = planeAxes(cam, plane);
  return (
    <ellipse
      cx={0}
      cy={0}
      rx={r}
      ry={r}
      transform={`matrix(${round(a * 1000) / 1000} ${round(b * 1000) / 1000} ${round(c * 1000) / 1000} ${round(d * 1000) / 1000} ${cx} ${cy})`}
      {...rest}
    />
  );
};

/** World origin (u = v = 0 corner) of each visible face of a box. */
export const faceOrigin = (at: Vec3, size: Vec3, plane: Plane): Vec3 => {
  const [x, y, z] = at;
  const [w, d, h] = size;
  if (plane === "left") {
    return [x, y + d, z + h];
  }
  if (plane === "right") {
    return [x + w, y + d, z + h];
  }
  return [x, y, z + h];
};

/* ------------------------------ Primitives ------------------------------ */

type FaceContent = (width: number, height: number) => ReactNode;

/**
 * A rectangular block: three lit faces, rim highlights on the edges that
 * face the light, and a silhouette hairline. `left`, `right` and `top`
 * render fill-only details in face units (0..width, 0..height).
 */
export const Box = ({
  at = [0, 0, 0],
  size,
  palette = "main",
  left,
  right,
  top,
}: {
  at?: Vec3;
  size: Vec3;
  palette?: IsoPalette;
  left?: FaceContent;
  right?: FaceContent;
  top?: FaceContent;
}) => {
  const cam = useCamera();
  const [x, y, z] = at;
  const [w, d, h] = size;
  const zt = z + h;
  return (
    <g>
      <polygon
        points={points(
          [
            [x, y + d, zt],
            [x + w, y + d, zt],
            [x + w, y + d, z],
            [x, y + d, z],
          ],
          cam
        )}
        style={faceStyle(palette, "left")}
      />
      <polygon
        points={points(
          [
            [x + w, y + d, zt],
            [x + w, y, zt],
            [x + w, y, z],
            [x + w, y + d, z],
          ],
          cam
        )}
        style={faceStyle(palette, "right")}
      />
      <polygon
        points={points(
          [
            [x, y, zt],
            [x + w, y, zt],
            [x + w, y + d, zt],
            [x, y + d, zt],
          ],
          cam
        )}
        style={faceStyle(palette, "top")}
      />
      {left ? (
        <Face at={faceOrigin(at, size, "left")} plane="left">
          {left(w, h)}
        </Face>
      ) : null}
      {right ? (
        <Face at={faceOrigin(at, size, "right")} plane="right">
          {right(d, h)}
        </Face>
      ) : null}
      {top ? (
        <Face at={faceOrigin(at, size, "top")} plane="top">
          {top(w, d)}
        </Face>
      ) : null}
      <path
        d={pathOf(
          [
            [x, y + d, zt],
            [x + w, y + d, zt],
            [x + w, y, zt],
          ],
          false,
          cam
        )}
        style={rimStyle(palette)}
      />
      <path
        d={pathOf(
          [
            [x, y, zt],
            [x + w, y, zt],
            [x + w, y, z],
            [x + w, y + d, z],
            [x, y + d, z],
            [x, y + d, zt],
          ],
          true,
          cam
        )}
        style={contourStyle}
      />
    </g>
  );
};

/**
 * Any flat polygon in world space (roof slopes, awnings, ramps, gables).
 * Its normal comes from Newell's method and its shade from the light
 * (math §5). Winding doesn't matter: the normal is turned toward the
 * viewer, so list only faces that can be seen. Edge-on faces (n·V = 0) are
 * skipped.
 */
export const Poly = ({
  points: list,
  palette = "main",
  style,
  ...rest
}: {
  points: readonly Vec3[];
  palette?: IsoPalette;
} & Omit<SVGProps<SVGPolygonElement>, "points">) => {
  const cam = useCamera();
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < list.length; i += 1) {
    const [x1, y1, z1] = list[i];
    const [x2, y2, z2] = list[(i + 1) % list.length];
    nx += (y1 - y2) * (z1 + z2);
    ny += (z1 - z2) * (x1 + x2);
    nz += (x1 - x2) * (y1 + y2);
  }
  const sign = nx + ny + nz < 0 ? -1 : 1;
  const normal: Vec3 = [nx * sign, ny * sign, nz * sign];
  if (!isVisible(normal)) {
    return null;
  }
  const color = lit(palette, normal);
  return (
    <polygon
      points={points(list, cam)}
      style={{
        fill: color,
        stroke: `var(--iso-edge, ${color})`,
        strokeWidth: `var(--iso-edge-w, ${SEAM})`,
        ...style,
      }}
      {...rest}
    />
  );
};

/**
 * An upright cylinder centred on (cx, cy), standing on z. Ellipses follow
 * math §4; the side is two-toned at its silhouette centre (math §5). The
 * top's front arc carries the rim highlight; its back arc and the sides
 * carry the silhouette hairline.
 */
export const Cylinder = ({
  center: [cx, cy, z],
  radius,
  height,
  palette = "main",
  top,
}: {
  center: Vec3;
  radius: number;
  height: number;
  palette?: IsoPalette;
  /** Marks drawn on the top ellipse, in canvas units around its centre. */
  top?: ReactNode;
}) => {
  const cam = useCamera();
  // A turn about the vertical axis leaves a horizontal circle's ellipse
  // unchanged; only its centre moves.
  const [sx, by] = projectWith(cam, [cx, cy, z]);
  const ty = round(by - ISO_S * height);
  const rx = round(ISO_S * radius * ELLIPSE_MAJOR);
  const ry = round(ISO_S * radius * ELLIPSE_MINOR);
  const side = `M${sx - rx},${ty} L${sx - rx},${by} A${rx},${ry} 0 0 0 ${sx + rx},${by} L${sx + rx},${ty} Z`;
  const rightHalf = `M${sx},${ty + ry} L${sx},${by + ry} A${rx},${ry} 0 0 0 ${sx + rx},${by} L${sx + rx},${ty} A${rx},${ry} 0 0 1 ${sx},${ty + ry} Z`;
  const outline = `M${sx - rx},${ty} L${sx - rx},${by} A${rx},${ry} 0 0 0 ${sx + rx},${by} L${sx + rx},${ty} A${rx},${ry} 0 0 0 ${sx - rx},${ty}`;
  return (
    <g>
      <path d={side} style={faceStyle(palette, "left")} />
      <path d={rightHalf} style={faceStyle(palette, "right")} />
      <ellipse
        cx={sx}
        cy={ty}
        rx={rx}
        ry={ry}
        style={faceStyle(palette, "top")}
      />
      {top ? <g transform={`translate(${sx} ${ty})`}>{top}</g> : null}
      <path
        d={`M${sx - rx},${ty} A${rx},${ry} 0 0 0 ${sx + rx},${ty}`}
        style={rimStyle(palette)}
      />
      <path d={outline} style={contourStyle} />
    </g>
  );
};

// World direction of one unit of depth behind each plane (math §3).
const BACK: Record<Plane, Vec3> = {
  left: [0, -1, 0],
  right: [-1, 0, 0],
  top: [0, 0, -1],
};

/**
 * Any flat outline (shield, tag, lock, coin, cloud, rounded panel) given
 * thickness behind a plane. Front takes the plane's shade, the depth the
 * darker side shade. `frontStyle` overrides the front paint (glass, screens).
 */
export const Extrude = ({
  plane,
  at,
  d,
  depth,
  palette = "main",
  fillRule,
  frontStyle,
  children,
}: {
  plane: Plane;
  at: Vec3;
  /** Outline in face coordinates (absolute M L H V C Q Z). */
  d: string;
  depth: number;
  palette?: IsoPalette;
  fillRule?: "evenodd" | "nonzero";
  frontStyle?: CSSProperties;
  /** Details on the front face: use Face, FacePath or FaceEllipse with the same plane. */
  children?: ReactNode;
}) => {
  const cam = useCamera();
  const [bx, by] = projectDir(cam, BACK[plane]);
  const outline = mapPath(plane, at, d, cam);
  const steps = Math.max(2, Math.ceil(depth / 0.08));
  const sideFace: FaceName = plane === "right" ? "left" : "right";
  const side = `var(--iso-${palette}-${sideFace})`;
  return (
    <g>
      <path
        d={outline}
        fillRule={fillRule}
        style={{ ...contourStyle, fill: side }}
        transform={`translate(${round(bx * depth)} ${round(by * depth)})`}
      />
      {Array.from({ length: steps - 1 }, (_, i) => {
        const t = (depth * (steps - 1 - i)) / steps;
        return (
          <path
            d={outline}
            fillRule={fillRule}
            key={t}
            style={{ fill: side, stroke: side, strokeWidth: SEAM * 2 }}
            transform={`translate(${round(bx * t)} ${round(by * t)})`}
          />
        );
      })}
      <path
        d={outline}
        fillRule={fillRule}
        style={{
          ...faceStyle(palette, plane),
          ...frontStyle,
        }}
      />
      {children}
      <path
        d={outline}
        fillRule={fillRule}
        style={{
          ...rimStyle(palette),
          strokeWidth: "calc(var(--iso-rim-w) * 0.8)",
        }}
      />
    </g>
  );
};

/**
 * A rounded slab lying flat: a card, a UI panel, a tray. `at` is its lowest
 * back corner; `content` draws on the top face in face units (0..w, 0..d).
 */
export const Slab = ({
  at,
  size: [w, d, h],
  radius = 0.5,
  palette = "surface",
  frontStyle,
  content,
}: {
  at: Vec3;
  size: Vec3;
  radius?: number;
  palette?: IsoPalette;
  frontStyle?: CSSProperties;
  content?: FaceContent;
}) => {
  const top: Vec3 = [at[0], at[1], at[2] + h];
  return (
    <Extrude
      at={top}
      d={roundedRect(w, d, radius)}
      depth={h}
      frontStyle={frontStyle}
      palette={palette}
      plane="top"
    >
      {content ? (
        <Face at={top} plane="top">
          {content(w, d)}
        </Face>
      ) : null}
    </Extrude>
  );
};

/**
 * A rounded panel standing upright, facing the viewer's left (+y): a sign,
 * a settings card, a screen. `at` is its top-left corner on the front face;
 * `content` draws on that face in face units (0..w, 0..h).
 */
export const Panel = ({
  at,
  size: [w, h],
  depth = 0.4,
  radius = 0.5,
  palette = "surface",
  frontStyle,
  content,
}: {
  at: Vec3;
  /** Width along x and height along z. */
  size: readonly [number, number];
  depth?: number;
  radius?: number;
  palette?: IsoPalette;
  frontStyle?: CSSProperties;
  content?: FaceContent;
}) => (
  <Extrude
    at={at}
    d={roundedRect(w, h, radius)}
    depth={depth}
    frontStyle={frontStyle}
    palette={palette}
    plane="left"
  >
    {content ? (
      <Face at={at} plane="left">
        {content(w, h)}
      </Face>
    ) : null}
  </Extrude>
);

/** Frosted glass for panels: the surface paint, partly see-through. */
export const GLASS: CSSProperties = {
  fill: "color-mix(in oklab, var(--iso-surface-top-c) 78%, transparent)",
};

/** Clearer glass for stacked layers, so the layer below shows through. */
export const CLEAR_GLASS: CSSProperties = {
  fill: "color-mix(in oklab, var(--iso-surface-top-c) 55%, transparent)",
};

/** The site's monospace face (Tailwind's --font-mono), for code and URLs. */
export const ISO_MONO = "var(--font-mono, ui-monospace, monospace)";

/** A point on a sphere from latitude and longitude in degrees. */
const spherePoint = (
  [cx, cy, cz]: Vec3,
  r: number,
  lat: number,
  lon: number
): Vec3 => {
  const la = (lat * Math.PI) / 180;
  const lo = (lon * Math.PI) / 180;
  return [
    cx + r * Math.cos(la) * Math.cos(lo),
    cy + r * Math.cos(la) * Math.sin(lo),
    cz + r * Math.sin(la),
  ];
};

// Visible when the surface normal faces the viewer: n · (1, 1, 1) > 0.
const facesViewer = ([x, y, z]: Vec3, [cx, cy, cz]: Vec3) =>
  x - cx + (y - cy) + (z - cz) > 0;

// Split a sampled curve (already in view space) into runs that face the
// viewer and runs that don't.
const splitRuns = (pts: Vec3[], center: Vec3) => {
  const front: string[] = [];
  const back: string[] = [];
  let run: Vec3[] = [];
  let runFront = facesViewer(pts[0], center);
  const flush = () => {
    if (run.length > 1) {
      (runFront ? front : back).push(pathOf(run));
    }
  };
  for (const p of pts) {
    const f = facesViewer(p, center);
    run.push(p);
    if (f !== runFront) {
      flush();
      run = [p];
      runFront = f;
    }
  }
  flush();
  return { back: back.join(" "), front: front.join(" ") };
};

/**
 * A wireframe sphere (math §4: an orthographic sphere projects to a circle
 * of radius S·r·√(3/2), the same as its equator's major axis). Latitude
 * rings and meridians are sampled in 3D and split into the half facing the
 * viewer (drawn) and the half behind (faint). `nodes` are lit points on the
 * surface, given as [latitude, longitude] in degrees; hidden ones are
 * skipped.
 */
export const Sphere = ({
  center,
  radius,
  palette = "surface",
  latitudes = [-50, -20, 10, 40],
  meridians = [0, 45, 90, 135],
  nodes = [],
}: {
  center: Vec3;
  radius: number;
  palette?: IsoPalette;
  latitudes?: readonly number[];
  meridians?: readonly number[];
  nodes?: readonly (readonly [number, number])[];
}) => {
  const cam = useCamera();
  // Work in view space: turn the sampled points with the camera, then test
  // which side faces the viewer and project with the home matrix.
  const view = (p: Vec3) => toView(cam, p);
  const centerView = view(center);
  const [sx, sy] = project(centerView);
  const R = round(ISO_S * radius * ELLIPSE_MAJOR);
  const steps = 72;
  const curves = [
    ...latitudes.map((lat) =>
      Array.from({ length: steps + 1 }, (_, i) =>
        view(spherePoint(center, radius, lat, (i / steps) * 360))
      )
    ),
    ...meridians.map((lon) =>
      Array.from({ length: steps + 1 }, (_, i) =>
        view(spherePoint(center, radius, (i / steps) * 360 - 180, lon))
      )
    ),
  ].map((pts) => splitRuns(pts, centerView));
  const litNodes = nodes
    .map(([lat, lon]) => view(spherePoint(center, radius, lat, lon)))
    .filter((p) => facesViewer(p, centerView))
    .map((p) => project(p));
  return (
    <g>
      <circle
        cx={sx}
        cy={sy}
        r={R}
        style={{
          fill: `color-mix(in oklab, var(--iso-${palette}-top-c) 70%, transparent)`,
        }}
      />
      <g fill="none" style={{ stroke: "var(--iso-contour)" }}>
        {curves.map((c) => (
          <path
            d={c.back}
            key={`b${c.back.slice(0, 24)}`}
            opacity={0.18}
            style={{ strokeWidth: isoStroke(0.4, 0.05) }}
          />
        ))}
        {curves.map((c) => (
          <path
            d={c.front}
            key={`f${c.front.slice(0, 24)}`}
            opacity={0.55}
            style={{ strokeWidth: isoStroke(0.55, 0.07) }}
          />
        ))}
      </g>
      <path
        d={`M${sx - R * 0.94},${sy - R * 0.34} A${R},${R} 0 0 1 ${sx + R * 0.34},${sy - R * 0.94}`}
        style={rimStyle(palette)}
      />
      <circle cx={sx} cy={sy} r={R} style={contourStyle} />
      {litNodes.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <circle
            cx={x}
            cy={y}
            fill="var(--iso-glow)"
            opacity={0.22}
            r={0.55}
          />
          <circle cx={x} cy={y} fill="var(--iso-glow)" r={0.24} />
        </g>
      ))}
    </g>
  );
};

/**
 * One stage of an icon. Under `animate="assemble"` parts drop in one after
 * another in `order`; otherwise this is a plain group.
 */
export const Part = ({
  order = 0,
  children,
}: {
  order?: number;
  children: ReactNode;
}) => (
  <g
    className="motion-safe:group-data-[animate=assemble]/iso:animate-[iso-drop_0.7s_cubic-bezier(0.22,1,0.36,1)_both]"
    style={{ animationDelay: `${order * 90}ms` } as CSSProperties}
  >
    {children}
  </g>
);

/* ------------------------------- Shadows -------------------------------- */

/**
 * What an icon's solid parts occupy, for its shadow: a box [x, y, w, d, h]
 * or an upright disc [cx, cy, r, h], optionally raised to height z.
 */
export type IsoCast =
  | { box: readonly [number, number, number, number, number]; z?: number }
  | { disc: readonly [number, number, number, number]; z?: number };

type P2 = readonly [number, number];

// Light travels along −L, so a point at height z lands on the ground at
// (x − z/3, y − 2z/3) (math §5, cast shadow).
const onGround = ([x, y]: P2, z: number): P2 => [x - z / 3, y - (2 * z) / 3];

const footprint = (cast: IsoCast): P2[] => {
  if ("box" in cast) {
    const [x, y, w, d] = cast.box;
    return [
      [x, y],
      [x + w, y],
      [x + w, y + d],
      [x, y + d],
    ];
  }
  const [cx, cy, r] = cast.disc;
  return Array.from({ length: 20 }, (_, i) => {
    const a = (i / 20) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as P2;
  });
};

const castHeight = (cast: IsoCast) =>
  "box" in cast ? cast.box[4] : cast.disc[3];

// Andrew's monotone chain convex hull on ground points.
const cross = (o: P2, a: P2, b: P2) =>
  (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

const hull = (pts: P2[]): P2[] => {
  const sorted = pts.toSorted((a, b) => a[0] - b[0] || a[1] - b[1]);
  const half = (list: P2[]) => {
    const out: P2[] = [];
    for (const p of list) {
      while (
        out.length >= 2 &&
        cross(out.at(-2) as P2, out.at(-1) as P2, p) <= 0
      ) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };
  return [...half(sorted), ...half([...sorted].toReversed())];
};

const groundPolygon = (pts: P2[], g = 0, cam: IsoCamera = HOME_CAMERA) =>
  points(
    pts.map(([x, y]) => [x, y, g] as Vec3),
    cam
  );

/**
 * Soft cast shadows plus a tighter contact shadow where parts touch the
 * surface. `ground` is that surface's height (a desk top): heights are
 * measured above it, and the shadow is drawn on it.
 */
const Shadows = ({
  casts,
  uid,
  className,
  ground = 0,
  cam = HOME_CAMERA,
}: {
  casts: readonly IsoCast[];
  uid: string;
  className?: string;
  ground?: number;
  /** Shadows lie fixed in the world; the camera only changes how they're seen. */
  cam?: IsoCamera;
}) => (
  <g className={className} style={{ fill: "var(--iso-shadow)" }}>
    <g filter={`url(#${uid}-cast)`} opacity={0.75}>
      {casts.map((cast) => {
        const base = footprint(cast);
        const z0 = (cast.z ?? ground) - ground;
        const z1 = z0 + castHeight(cast);
        const shadow = hull([
          ...base.map((p) => onGround(p, z0)),
          ...base.map((p) => onGround(p, z1)),
        ]);
        return (
          <polygon
            key={JSON.stringify(cast)}
            points={groundPolygon(shadow, ground, cam)}
          />
        );
      })}
    </g>
    <g filter={`url(#${uid}-ao)`}>
      {casts
        .filter((cast) => (cast.z ?? ground) - ground < 0.6)
        .map((cast) => (
          <polygon
            key={JSON.stringify(cast)}
            points={groundPolygon(footprint(cast), ground, cam)}
          />
        ))}
    </g>
  </g>
);

/* ------------------------------- Badge ---------------------------------- */

export type IsoBadge = "check" | "x" | "alert" | "plus" | number | ReactNode;

const GLYPHS: Record<string, ReactNode> = {
  alert: (
    <>
      <path d="M12 7.2v5.6" />
      <circle
        cx="12"
        cy="16.4"
        fill="var(--background)"
        r="1.1"
        stroke="none"
      />
    </>
  ),
  check: <path d="M7.6 12.4l3 3 5.8-6.2" />,
  plus: <path d="M12 7.5v9M7.5 12h9" />,
  x: <path d="M8.7 8.7l6.6 6.6M15.3 8.7l-6.6 6.6" />,
};

const Badge = ({ badge }: { badge: IsoBadge }) => {
  const isGlyph = typeof badge === "string" && badge in GLYPHS;
  const isNumber = typeof badge === "number";
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-[4%] right-[4%] grid size-[22%] place-items-center drop-shadow-[0_0.125rem_0.25rem_rgb(0_0_0/0.18)]"
    >
      {isGlyph || isNumber ? (
        <svg className="size-full overflow-visible" viewBox="0 0 24 24">
          <circle
            cx="12"
            cy="12"
            r="11"
            stroke="var(--iso-card)"
            strokeWidth="1.5"
            style={{
              fill:
                badge === "x" || badge === "alert"
                  ? "var(--destructive)"
                  : "var(--iso-tone)",
            }}
          />
          {isNumber ? (
            <text
              dominantBaseline="central"
              fill="var(--background)"
              fontSize={badge > 9 ? 9.5 : 11.5}
              fontWeight={600}
              textAnchor="middle"
              x="12"
              y="12.4"
            >
              {badge > 99 ? "99+" : badge}
            </text>
          ) : (
            <g
              fill="none"
              stroke="var(--background)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2.2"
            >
              {GLYPHS[badge as string]}
            </g>
          )}
        </svg>
      ) : (
        badge
      )}
    </span>
  );
};

/* ------------------------------- Frame ---------------------------------- */

export type IsoAnimate = "none" | "float" | "hover-lift" | "assemble";

export interface IsoIconProps {
  /** Width and height. A number is pixels; a string is any CSS length. Or size with className (`size-16`). */
  size?: number | string;
  /** Main color: a theme token name or any CSS color. */
  tone?: IsoTone;
  /** Detail color for lights, chips and highlights. Defaults to `tone`. */
  accent?: IsoTone;
  variant?: IsoVariant;
  /** Edge weight in canvas units (24-unit canvas): rims and hairlines, or outlines in the line variant. */
  strokeWidth?: number;
  /** Status mark in the top right: a built-in glyph, a count, or your own node. */
  badge?: IsoBadge;
  animate?: IsoAnimate;
  /** Soft cast and contact shadows under the object. */
  shadow?: boolean;
  /** View from the opposite side: flips the drawing and keeps the light top left. */
  mirror?: boolean;
  /** Accessible name. Without one the icon is decorative and hidden from screen readers. */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const KEYFRAMES =
  "@keyframes iso-float{0%,100%{translate:0 0}50%{translate:0 -0.05rem}}@keyframes iso-shadow{0%,100%{opacity:1}50%{opacity:.7}}@keyframes iso-drop{from{translate:0 -0.15rem;opacity:0}to{translate:0 0;opacity:1}}";

// Motion classes per animate mode: the body moves, the shadow answers it.
const MOTION: Record<IsoAnimate, { body: string; shadow: string }> = {
  assemble: { body: "", shadow: "" },
  float: {
    body: "motion-safe:animate-[iso-float_4s_ease-in-out_infinite]",
    shadow: "motion-safe:animate-[iso-shadow_4s_ease-in-out_infinite]",
  },
  "hover-lift": {
    body: "motion-safe:group-hover/iso:-translate-y-[0.05rem]",
    shadow: "motion-safe:group-hover/iso:opacity-70",
  },
  none: { body: "", shadow: "" },
};

// Mirroring swaps world x and y (math §7). Shadows are recomputed for the
// swapped shapes rather than flipped, so they still fall away from the light.
const mirrorCast = (cast: IsoCast): IsoCast => {
  if ("box" in cast) {
    const [x, y, w, d, h] = cast.box;
    return { box: [y, x, d, w, h], z: cast.z };
  }
  const [cx, cy, r, h] = cast.disc;
  return { disc: [cy, cx, r, h], z: cast.z };
};

const hasBadge = (badge: IsoBadge | undefined) =>
  badge !== undefined && badge !== null && badge !== false;

/** Shared frame for every isometric icon. Icons pass their parts as children. */
export const IsoIcon = ({
  size,
  tone = "primary",
  accent,
  variant = "duotone",
  strokeWidth = 0.3,
  badge,
  animate = "none",
  shadow = true,
  mirror = false,
  title,
  className,
  style,
  footprint: radius = 3.75,
  casts,
  children,
}: IsoIconProps & {
  /** Contact-shadow radius when no `casts` are given. */
  footprint?: number;
  /** The icon's solid parts, for cast and contact shadows. */
  casts?: readonly IsoCast[];
  children: ReactNode;
}) => {
  const uid = useIsoId();
  const sizeStyle =
    size === undefined ? undefined : { height: size, width: size };
  return (
    <span
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn(
        "group/iso relative inline-block size-24 shrink-0 align-middle",
        className
      )}
      data-animate={animate}
      data-slot="iso-icon"
      role={title ? "img" : undefined}
      style={{
        ...isoThemeStyle({ accent, mirror, strokeWidth, tone, uid, variant }),
        ...sizeStyle,
        ...style,
      }}
    >
      <svg
        aria-hidden="true"
        className="block size-full overflow-visible"
        viewBox="-12 -17 24 24"
      >
        <IsoDefs uid={uid} />
        {animate === "none" ? null : <style>{KEYFRAMES}</style>}
        {shadow ? (
          <g
            className={cn(
              "transition-opacity duration-300 ease-out",
              MOTION[animate].shadow
            )}
          >
            <Shadows
              casts={(casts ?? [{ disc: [0, 0, radius * 0.8, 0] }]).map((c) =>
                mirror ? mirrorCast(c) : c
              )}
              uid={uid}
            />
          </g>
        ) : null}
        <g
          className={cn(
            "transition-[translate] duration-300 ease-out",
            MOTION[animate].body
          )}
          style={{
            stroke: "none",
            strokeLinecap: "round",
            strokeLinejoin: "round",
          }}
        >
          <g transform={mirror ? "scale(-1 1)" : undefined}>{children}</g>
        </g>
      </svg>
      {hasBadge(badge) ? <Badge badge={badge} /> : null}
    </span>
  );
};

/**
 * How far the camera may turn, in degrees: a number for the same either
 * way, or [min, max] when one side reads better (turn toward a screen, not
 * away from it).
 */
export type IsoOrbit = number | readonly [number, number];

// Turning past 45° would bring other faces into view; keep a margin.
const MAX_ORBIT = 40;

const orbitRange = (orbit: IsoOrbit): [number, number] => {
  const [lo, hi] =
    typeof orbit === "number" ? [-Math.abs(orbit), Math.abs(orbit)] : orbit;
  return [
    Math.max(-MAX_ORBIT, Math.min(0, lo)),
    Math.min(MAX_ORBIT, Math.max(0, hi)),
  ];
};

/* ------------------------------- Stage ---------------------------------- */

const STAGE_GROUP: CSSProperties = {
  stroke: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

/**
 * A whole illustration in one SVG, for scenes whose parts move together
 * (one coordinate space, one set of gradients, exact choreography). The
 * view fits `bounds`, the world points the scene must show. Draw order:
 * `base` (a desk, a floor plate) after its own shadow on the page, then the
 * shadows of `casts` on the base's top (`ground`), then `children`.
 */
export const IsoStage = ({
  tone = "primary",
  accent,
  variant = "duotone",
  strokeWidth = 0.3,
  bounds,
  base,
  baseCasts = [],
  casts = [],
  ground = 0,
  shadow = true,
  camera = HOME_CAMERA,
  orbit = 0,
  title,
  className,
  style,
  children,
}: Omit<IsoIconProps, "animate" | "badge" | "mirror" | "size"> & {
  /** World points the view must include; the frame pads them. */
  bounds: readonly Vec3[];
  /** The viewpoint (see `useIsoOrbit`). Home is true isometric. */
  camera?: IsoCamera;
  /**
   * How far the camera will turn (degrees, or [min, max]). The frame is
   * fitted to every angle in that range, so the scene never changes size as
   * it turns. 0 for a still scene.
   */
  orbit?: IsoOrbit;
  /** What everything stands on, drawn first. */
  base?: ReactNode;
  /** The base's own solid parts, for its shadow on the page. */
  baseCasts?: readonly IsoCast[];
  /** Solid parts standing on the base, for shadows on its top. */
  casts?: readonly IsoCast[];
  /** Height of the base's top, where `casts` shadows land. */
  ground?: number;
  children: ReactNode;
}) => {
  const uid = useIsoId();
  const [lo, hi] = orbitRange(orbit);
  const angles = [lo, lo / 2, 0, hi / 2, hi];
  const pts = angles.flatMap((yaw) =>
    bounds.map((p) => projectWith({ pivot: camera.pivot, yaw }, p))
  );
  const pad = 1.5;
  const minX = Math.min(...pts.map((p) => p[0])) - pad;
  const minY = Math.min(...pts.map((p) => p[1])) - pad;
  const w = Math.max(...pts.map((p) => p[0])) + pad - minX;
  const h = Math.max(...pts.map((p) => p[1])) + pad - minY;
  return (
    <div
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn("relative w-full", className)}
      data-slot="iso-stage"
      role={title ? "img" : undefined}
      style={{
        aspectRatio: `${round(w)} / ${round(h)}`,
        ...isoThemeStyle({ accent, strokeWidth, tone, uid, variant }),
        ...style,
      }}
    >
      <svg
        aria-hidden="true"
        className="block size-full overflow-visible"
        viewBox={`${round(minX)} ${round(minY)} ${round(w)} ${round(h)}`}
      >
        <IsoDefs uid={uid} />
        <CameraContext.Provider value={camera}>
          {shadow && baseCasts.length > 0 ? (
            <Shadows cam={camera} casts={baseCasts} uid={uid} />
          ) : null}
          <g style={STAGE_GROUP}>{base}</g>
          {shadow && casts.length > 0 ? (
            <Shadows cam={camera} casts={casts} ground={ground} uid={uid} />
          ) : null}
          <g style={STAGE_GROUP}>{children}</g>
        </CameraContext.Provider>
      </svg>
    </div>
  );
};

/* ------------------------------- Orbit ---------------------------------- */

/** How the viewer turns a stage: drag it, let it follow the pointer, or not at all. */
export type IsoRotate = "drag" | "pointer" | "off";

// A slightly underdamped spring (damping ratio ≈ 0.9): settles with life,
// no visible bounce.
const ORBIT_SPRING = { damping: 24, stiffness: 180 };
// Degrees per arrow-key press.
const KEY_STEP = 10;
// How far past the limit a drag can stretch, and how hard it resists.
const RUBBER = { give: 0.3, max: 8 };

const rubber = (yaw: number, [lo, hi]: [number, number]) => {
  if (yaw > hi) {
    return hi + Math.min(RUBBER.max, (yaw - hi) * RUBBER.give);
  }
  if (yaw < lo) {
    return lo - Math.min(RUBBER.max, (lo - yaw) * RUBBER.give);
  }
  return yaw;
};

/**
 * Lets the viewer turn a stage's camera. "drag": drag sideways (or use the
 * arrow keys) to look around, and it springs home on release. "pointer":
 * the view leans toward the pointer and settles home when it leaves.
 * Returns the camera for `IsoStage` and props for the wrapper element.
 */
export const useIsoOrbit = ({
  mode = "drag",
  orbit = 35,
  pivot,
  reduced = false,
}: {
  mode?: IsoRotate;
  /** How far it may turn (each side capped at 40° so the same faces stay in view). */
  orbit?: IsoOrbit;
  /** The vertical axis the camera turns around, in world x and y. */
  pivot: readonly [number, number];
  /** Reduced motion: no spring, moves jump straight to where they settle. */
  reduced?: boolean;
}) => {
  const range = orbitRange(orbit);
  const [lo, hi] = range;
  const clamp = (v: number) => Math.max(lo, Math.min(hi, v));
  const [yaw, setYaw] = useState(0);
  const [dragging, setDragging] = useState(false);
  const state = useRef({
    frame: 0,
    last: 0,
    startX: 0,
    startYaw: 0,
    target: 0,
    velocity: 0,
    width: 1,
    yaw: 0,
  });

  useEffect(
    () => () => {
      cancelAnimationFrame(state.current.frame);
    },
    []
  );

  const show = (value: number) => {
    state.current.yaw = value;
    setYaw(Math.round(value * 100) / 100);
  };

  const springTo = (target: number) => {
    const st = state.current;
    st.target = target;
    cancelAnimationFrame(st.frame);
    if (reduced) {
      st.velocity = 0;
      show(target);
      return;
    }
    st.last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - st.last) / 1000);
      st.last = now;
      const accel =
        -ORBIT_SPRING.stiffness * (st.yaw - st.target) -
        ORBIT_SPRING.damping * st.velocity;
      st.velocity += accel * dt;
      const next = st.yaw + st.velocity * dt;
      if (Math.abs(next - st.target) < 0.02 && Math.abs(st.velocity) < 0.05) {
        st.velocity = 0;
        show(st.target);
        return;
      }
      show(next);
      st.frame = requestAnimationFrame(step);
    };
    st.frame = requestAnimationFrame(step);
  };

  const camera: IsoCamera = { pivot, yaw };
  if (mode === "off") {
    return { camera: { pivot, yaw: 0 }, dragging: false, orbitProps: {} };
  }

  const orbitProps = {
    onKeyDown: (e: { key: string; preventDefault: () => void }) => {
      const st = state.current;
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        springTo(clamp(st.target + dir * KEY_STEP));
      } else if (e.key === "Home" || e.key === "Escape") {
        springTo(0);
      }
    },
    onPointerCancel: () => {
      setDragging(false);
      springTo(0);
    },
    onPointerDown: (e: {
      button: number;
      clientX: number;
      currentTarget: Element;
      pointerId: number;
    }) => {
      if (e.button !== 0) {
        return;
      }
      const st = state.current;
      cancelAnimationFrame(st.frame);
      st.startX = e.clientX;
      st.startYaw = st.yaw;
      st.width = e.currentTarget.getBoundingClientRect().width || 1;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Some pointers can't be captured (already released, synthetic);
        // the drag still works while the pointer stays over the scene.
      }
      setDragging(true);
    },
    onPointerLeave: () => {
      if (mode === "pointer" && !dragging) {
        springTo(0);
      }
    },
    onPointerMove: (e: { clientX: number; currentTarget: Element }) => {
      const st = state.current;
      if (dragging) {
        // A full-width drag sweeps the whole range, with a little extra.
        const raw =
          st.startYaw + ((e.clientX - st.startX) / st.width) * (hi - lo) * 1.2;
        show(rubber(raw, range));
        return;
      }
      if (mode === "pointer") {
        const rect = e.currentTarget.getBoundingClientRect();
        // Left half leans toward min, right half toward max.
        const t = (e.clientX - rect.left) / (rect.width || 1) - 0.5;
        springTo(clamp(t < 0 ? -t * 2 * lo : t * 2 * hi));
      }
    },
    onPointerUp: () => {
      setDragging(false);
      springTo(0);
    },
    style: {
      cursor: dragging ? "grabbing" : "grab",
      touchAction: "pan-y",
      userSelect: "none",
    } as CSSProperties,
    tabIndex: 0,
  };
  return { camera, dragging, orbitProps };
};
