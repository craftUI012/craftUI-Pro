import { Children, cloneElement, isValidElement } from "react";
import type { CSSProperties, ReactElement, ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  Box,
  FaceEllipse,
  IsoDefs,
  isoStroke,
  isoThemeStyle,
  project,
  useIsoId,
} from "./iso-core";
import type { IsoTone, IsoVariant, Vec3 } from "./iso-core";

/*
 * Places isometric icons on a shared grid (math §8): one cell is 10 world
 * units (the 8-unit cube plus a 2-unit gap). Icons are 24 canvas units wide
 * with their ground centre at canvas (12, 17), so a cell's world point maps
 * straight onto an icon box. Items may sit between cells, be raised (z) or
 * scaled, so objects keep believable sizes next to each other.
 *
 * Floors: "grid" (default) is a field of dots on the ground plane that fades
 * out from the middle, so objects stand in open space instead of on a
 * diorama slab. "slab" is the solid platform. "none" floats everything.
 */
const PITCH = 10;
const HALF = PITCH / 2;
const SLAB = 1;
const ROAD = 2;
const DOT_STEP = 2;

/** A grid point: [col, row], fractions allowed. */
export type Cell = readonly [number, number];

interface Bounds {
  minX: number;
  minY: number;
  w: number;
  h: number;
}

interface ItemProps {
  /** Column, from 0. Fractions place an item between cells. */
  x: number;
  /** Row, from 0. */
  y: number;
  /** Height above the floor in world units (stack items or float them). */
  z?: number;
  /** Size relative to a full cell. A parcel next to a house might be 0.3. */
  scale?: number;
  /**
   * How tall the item draws, in its own world units (default 8, the full
   * cube). Flat panels and plates draw ~1.5; it trims empty space above.
   */
  height?: number;
  children: ReactNode;
  /** Set by IsoScene. */
  bounds?: Bounds;
  /** Set by IsoScene: the scene's line weight, before this item's scale. */
  sceneStroke?: number;
}

interface StrokeProps {
  strokeWidth?: number;
}

/*
 * An icon's strokeWidth is measured on its own 24-unit canvas, so an icon at
 * scale 0.3 would draw lines 0.3× as thick as its neighbours. Each item
 * hands its icon strokeWidth ÷ scale so every line in the scene has the
 * same weight on screen. An icon given its own strokeWidth keeps it.
 */
const withSceneStroke = (children: ReactNode, stroke: number, scale: number) =>
  Children.map(children, (child) =>
    isValidElement<StrokeProps>(child) &&
    typeof child.type !== "string" &&
    child.props.strokeWidth === undefined
      ? cloneElement(child, { strokeWidth: stroke / scale })
      : child
  );

const world = ([col, row]: Cell, z = 0): Vec3 => [col * PITCH, row * PITCH, z];

const itemBox = ({ x, y, z = 0, scale = 1 }: ItemProps) => {
  const [sx, sy] = project(world([x, y], z));
  return {
    h: 24 * scale,
    left: sx - 12 * scale,
    top: sy - 17 * scale,
    w: 24 * scale,
  };
};

export const IsoSceneItem = (props: ItemProps) => {
  const { bounds, children, sceneStroke = 0.3, scale = 1, x, y, z = 0 } = props;
  if (!bounds) {
    return null;
  }
  const box = itemBox(props);
  return (
    <div
      // The cell sets the size; an icon's own size prop is overridden here.
      className="absolute [&>[data-slot=iso-icon]]:size-full!"
      style={{
        height: `${(box.h / bounds.h) * 100}%`,
        left: `${((box.left - bounds.minX) / bounds.w) * 100}%`,
        top: `${((box.top - bounds.minY) / bounds.h) * 100}%`,
        width: `${(box.w / bounds.w) * 100}%`,
        // Nearer to the viewer paints later (math §6: x + y + z).
        zIndex: Math.round((x + y) * 100 + z),
      }}
    >
      {withSceneStroke(children, sceneStroke, scale)}
    </div>
  );
};

export interface IsoLink {
  from: Cell;
  to: Cell;
  /** "flow": a faint track with a pulse of light travelling along it. "road": a flat strip with a centre line. */
  style?: "flow" | "road";
  /** Which way the link turns: along columns first ("x", default) or rows first ("y"). */
  bend?: "x" | "y";
}

// A link runs along the grid with one turn: along columns then rows
// (bend "x"), or rows then columns (bend "y"). A straight link has no turn,
// so repeated points are dropped.
const linkCorners = ({ from, to, bend = "x" }: IsoLink): Cell[] =>
  (
    [from, bend === "x" ? [to[0], from[1]] : [from[0], to[1]], to] as Cell[]
  ).filter(
    (c, i, all) => i === 0 || c[0] !== all[i - 1][0] || c[1] !== all[i - 1][1]
  );

const pathD = (cells: Cell[]) =>
  cells
    .map((c, i) => `${i === 0 ? "M" : "L"}${project(world(c)).join(",")}`)
    .join(" ");

// A floor strip around one straight segment, padded at both ends so turns
// close cleanly.
const stripPoints = (a: Cell, b: Cell) => {
  const [ax, ay] = world(a);
  const [bx, by] = world(b);
  const x0 = Math.min(ax, bx) - ROAD;
  const x1 = Math.max(ax, bx) + ROAD;
  const y0 = Math.min(ay, by) - ROAD;
  const y1 = Math.max(ay, by) + ROAD;
  const corners: Vec3[] = [
    [x0, y0, 0],
    [x1, y0, 0],
    [x1, y1, 0],
    [x0, y1, 0],
  ];
  return corners.map((p) => project(p).join(",")).join(" ");
};

const Link = ({ link, index }: { link: IsoLink; index: number }) => {
  const corners = linkCorners(link);
  const d = pathD(corners);
  if (link.style === "road") {
    return (
      <g>
        {corners.slice(1).map((c, i) => (
          <polygon
            key={c.join(",")}
            points={stripPoints(corners[i], c)}
            style={{ fill: "var(--iso-road)" }}
          />
        ))}
        <path
          d={d}
          fill="none"
          stroke="var(--iso-screen)"
          strokeDasharray="1.2 1"
          strokeLinecap="round"
          style={{ strokeWidth: isoStroke(0.85) }}
        />
      </g>
    );
  }
  return (
    <g>
      <path
        d={d}
        fill="none"
        opacity={0.28}
        stroke="var(--iso-tone)"
        strokeLinecap="round"
        style={{ strokeWidth: isoStroke(0.9) }}
      />
      <path
        className="motion-safe:animate-[iso-pulse_2.8s_cubic-bezier(0.45,0,0.55,1)_infinite]"
        d={d}
        fill="none"
        pathLength={100}
        stroke="var(--iso-glow)"
        // One pulse: the gap is longer than the path (pathLength 100), and the
        // offset runs from just before the start to just past the end.
        strokeDasharray="5 120"
        strokeLinecap="round"
        style={{
          animationDelay: `${index * 700}ms`,
          strokeWidth: isoStroke(1.7, 0.25),
        }}
      />
    </g>
  );
};

/** Dots on the ground plane, fading out with distance from the middle. */
const DotGrid = ({
  cols,
  rows,
  bounds,
}: {
  cols: number;
  rows: number;
  bounds: Bounds;
}) => {
  const x0 = -HALF - PITCH;
  const x1 = cols * PITCH - HALF + PITCH;
  const y0 = -HALF - PITCH;
  const y1 = rows * PITCH - HALF + PITCH;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = (x1 - x0) / 2;
  const ry = (y1 - y0) / 2;
  const dots: { x: number; y: number; o: number }[] = [];
  for (let x = x0; x <= x1; x += DOT_STEP) {
    for (let y = y0; y <= y1; y += DOT_STEP) {
      const t = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      const o = Math.max(0, 1 - t) ** 1.5;
      const [sx, sy] = project([x, y, 0]);
      const inside =
        sx > bounds.minX + 0.5 &&
        sx < bounds.minX + bounds.w - 0.5 &&
        sy > bounds.minY + 0.5 &&
        sy < bounds.minY + bounds.h - 0.5;
      if (o > 0.04 && inside) {
        dots.push({ o: Math.round(o * 100) / 100, x, y });
      }
    }
  }
  return (
    <g style={{ fill: "var(--iso-ink)" }}>
      {dots.map(({ x, y, o }) => (
        <FaceEllipse
          center={[x, y, 0]}
          key={`${x},${y}`}
          opacity={o * 0.32}
          plane="top"
          r={0.09}
        />
      ))}
    </g>
  );
};

const isItem = (child: ReactNode): child is ReactElement<ItemProps> =>
  isValidElement(child) && child.type === IsoSceneItem;

const sceneBounds = (
  items: ItemProps[],
  cols: number,
  rows: number,
  floor: IsoFloor
): Bounds => {
  const xs: number[] = [];
  const ys: number[] = [];
  // Fit to what icons can draw (the reference cube's hexagon, math §8:
  // x ±8.66, y −15…5, plus a little for edges and shadows), not their full
  // 24-unit canvas, so scenes carry no dead margin.
  for (const item of items) {
    const [sx, sy] = project(world([item.x, item.y], item.z));
    const s = item.scale ?? 1;
    // The footprint's back corner sits 5 canvas units above the ground
    // point; height adds S per world unit (math §8).
    const reach = 5.5 + 1.25 * (item.height ?? 8);
    xs.push(sx - 9.2 * s, sx + 9.2 * s);
    ys.push(sy - reach * s, sy + 5.5 * s);
  }
  if (floor === "slab") {
    const corners: Vec3[] = [
      [-HALF, -HALF, 0],
      [cols * PITCH - HALF, -HALF, 0],
      [-HALF, rows * PITCH - HALF, -SLAB],
      [cols * PITCH - HALF, rows * PITCH - HALF, -SLAB],
    ];
    for (const corner of corners) {
      const [sx, sy] = project(corner);
      xs.push(sx);
      ys.push(sy);
    }
  }
  const pad = 1;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  return {
    h: Math.max(...ys) + pad - minY,
    minX,
    minY,
    w: Math.max(...xs) + pad - minX,
  };
};

export type IsoFloor = "grid" | "slab" | "none";

export const IsoScene = ({
  cols,
  rows,
  links = [],
  floor = "grid",
  tone = "primary",
  variant = "duotone",
  strokeWidth = 0.3,
  className,
  style,
  children,
}: {
  cols: number;
  rows: number;
  links?: IsoLink[];
  /** Ground treatment: fading dot grid, solid slab, or nothing. */
  floor?: IsoFloor;
  /** Floor and link color. Icons keep their own props. */
  tone?: IsoTone;
  variant?: IsoVariant;
  /**
   * Line weight for the whole scene, in canvas units of a full-size cell.
   * Applies to the floor, links and every icon; each item corrects for its
   * scale so lines match on screen.
   */
  strokeWidth?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) => {
  const uid = useIsoId();
  const items = Children.toArray(children)
    .filter(isItem)
    .map((c) => c.props);
  const bounds = sceneBounds(items, cols, rows, floor);
  return (
    <div
      className={cn("relative w-full", className)}
      data-slot="iso-scene"
      style={{
        aspectRatio: `${bounds.w} / ${bounds.h}`,
        ...isoThemeStyle({ strokeWidth, tone, uid, variant }),
        ...style,
      }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.w} ${bounds.h}`}
      >
        <IsoDefs uid={uid} />
        <style>
          {
            "@keyframes iso-pulse{from{stroke-dashoffset:5}to{stroke-dashoffset:-100}}"
          }
        </style>
        {floor === "grid" ? (
          <DotGrid bounds={bounds} cols={cols} rows={rows} />
        ) : null}
        {floor === "slab" ? (
          <Box
            at={[-HALF, -HALF, -SLAB]}
            palette="surface"
            size={[cols * PITCH, rows * PITCH, SLAB]}
          />
        ) : null}
        {links.map((link, index) => (
          <Link
            index={index}
            key={`${link.from.join(",")}-${link.to.join(",")}`}
            link={link}
          />
        ))}
      </svg>
      {Children.map(children, (child) =>
        isItem(child)
          ? cloneElement(child, { bounds, sceneStroke: strokeWidth })
          : child
      )}
    </div>
  );
};
