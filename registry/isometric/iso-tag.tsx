import { Extrude, Face, FacePath, IsoIcon, isoStroke, Part } from "./iso-core";
import type { IsoIconProps, Vec3 } from "./iso-core";

// A hanging price tag, extruded from a flat outline with a punched hole and
// its string, floating above its shadow. Outline in left-wall face units:
// 6 wide, 3 tall, point to the left, hole at (1.35, 1.5).
const HOLE = { cx: 1.35, cy: 1.5, r: 0.35 };

const octagon = ({ cx, cy, r }: typeof HOLE) =>
  `${Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x = Math.round((cx + r * Math.cos(a)) * 1000) / 1000;
    const y = Math.round((cy + r * Math.sin(a)) * 1000) / 1000;
    return `${i === 0 ? "M" : "L"}${x} ${y}`;
  }).join(" ")} Z`;

const OUTLINE = `M0 1.5 L1.5 0 H6 V3 H1.5 Z ${octagon(HOLE)}`;
const FRONT: Vec3 = [-3, 0.25, 5.5];

export const IsoTag = (props: IsoIconProps) => (
  <IsoIcon footprint={3} {...props}>
    <Part order={0}>
      <Extrude
        at={FRONT}
        d={OUTLINE}
        depth={0.5}
        fillRule="evenodd"
        plane="left"
      >
        <Face at={FRONT} plane="left">
          <rect
            fill="var(--iso-glow)"
            height={0.55}
            rx={0.15}
            width={2.6}
            x={2.4}
            y={0.85}
          />
          <rect
            fill="var(--iso-detail)"
            height={0.32}
            opacity={0.5}
            rx={0.16}
            width={1.6}
            x={2.4}
            y={1.7}
          />
        </Face>
        <FacePath
          at={FRONT}
          d="M1.35 1.15 C0.4 0.2 0.5 -0.9 1.6 -1.7"
          fill="none"
          plane="left"
          stroke="var(--iso-detail)"
          style={{ strokeWidth: isoStroke(0.85) }}
        />
      </Extrude>
    </Part>
  </IsoIcon>
);
