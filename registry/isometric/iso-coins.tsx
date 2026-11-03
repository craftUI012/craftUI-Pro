import { Cylinder, ISO_S, IsoIcon, Part, isoStroke, project } from "./iso-core";
import type { IsoIconProps, Vec3 } from "./iso-core";

// Three coin stacks rising 3 → 6 → 10, read left to right as a growth chart,
// with a trend arrow above them.
//
// The stacks sit on the line x + y = 0. Along it, screen x changes and
// depth (x + y + z, math §6) does not, so the stacks stand side by side at
// one baseline like real bars instead of overlapping. The trend arrow lives
// in the vertical plane through that line; its points (arrowhead included)
// are built in 3D and projected (math §3, strokes after projection).
// Under animate="assemble" the coins drop in level by level.
const COIN = { h: 0.55, r: 1.25 };
const STACKS: { count: number; at: [number, number] }[] = [
  { at: [-2.1, 2.1], count: 3 },
  { at: [0, 0], count: 6 },
  { at: [2.1, -2.1], count: 10 },
];
const RX = ISO_S * COIN.r * Math.sqrt(1.5);
const RY = ISO_S * COIN.r * Math.SQRT1_2;
const LIFT = 0.9;
const HEAD = { back: 0.9, half: 0.5 };

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [
  a[0] + b[0] * k,
  a[1] + b[1] * k,
  a[2] + b[2] * k,
];
const unit = (v: Vec3): Vec3 => {
  const len = Math.hypot(...v) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
};

// Trend points above each stack, then an arrowhead in the same plane:
// e is the in-plane perpendicular to the last segment (z minus its part
// along the segment).
const TREND: Vec3[] = STACKS.map(({ at: [x, y], count }) => [
  x,
  y,
  count * COIN.h + LIFT,
]);
const tip = TREND.at(-1) as Vec3;
const dir = unit(sub(tip, TREND.at(-2) as Vec3));
const perp = unit(
  sub([0, 0, 1], [dir[0] * dir[2], dir[1] * dir[2], dir[2] ** 2])
);
const base = add(tip, dir, -HEAD.back);
const HEAD_POINTS: Vec3[] = [
  add(base, perp, HEAD.half),
  tip,
  add(base, perp, -HEAD.half),
];

const line = (pts: Vec3[]) =>
  pts.map((p, i) => `${i === 0 ? "M" : "L"}${project(p).join(",")}`).join(" ");

export const IsoCoins = (props: IsoIconProps) => (
  <IsoIcon
    casts={STACKS.map(({ at: [x, y], count }) => ({
      disc: [x, y, COIN.r, count * COIN.h] as const,
    }))}
    {...props}
  >
    {STACKS.map(({ at: [x, y], count }, stack) =>
      Array.from({ length: count }, (_, level) => (
        <Part key={`${x}-${level}`} order={stack + level}>
          <Cylinder
            center={[x, y, level * COIN.h]}
            height={COIN.h}
            radius={COIN.r}
            top={
              level === count - 1 ? (
                <ellipse
                  fill="none"
                  opacity={0.55}
                  rx={RX * 0.6}
                  ry={RY * 0.6}
                  stroke="var(--iso-detail)"
                />
              ) : null
            }
          />
        </Part>
      ))
    )}
    <Part order={(STACKS.at(-1)?.count ?? 0) + 1}>
      <path
        d={`${line(TREND)} ${line(HEAD_POINTS)}`}
        fill="none"
        stroke="var(--iso-glow)"
        style={{ strokeWidth: isoStroke(1.4, 0.25) }}
      />
    </Part>
  </IsoIcon>
);
