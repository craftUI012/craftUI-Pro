import { FacePath, IsoIcon, Part, Slab } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// Two payment cards hovering one above the other: rounded slabs (radius
// 0.45, 0.25 thick). The top card carries a chip, a contactless mark, the
// card number and a two-circle network mark; the back card shows its stripe.
const SIZE: Vec3 = [6.5, 4.25, 0.25];
const BACK: Vec3 = [-3, -3.75, 0.5];
const FRONT: Vec3 = [-3.75, -1.25, 1.6];
const CASTS: IsoCast[] = [
  { box: [BACK[0], BACK[1], SIZE[0], SIZE[1], SIZE[2]], z: BACK[2] },
  { box: [FRONT[0], FRONT[1], SIZE[0], SIZE[1], SIZE[2]], z: FRONT[2] },
];

export const IsoCard = ({
  last4 = "4242",
  ...props
}: IsoIconProps & {
  /** Last four digits printed on the front card. */
  last4?: string;
}) => (
  <IsoIcon casts={CASTS} {...props}>
    <Part order={0}>
      <Slab
        at={BACK}
        content={(w) => (
          <rect
            fill="var(--iso-on-main)"
            height={0.55}
            opacity={0.18}
            width={w}
            x={0}
            y={0.7}
          />
        )}
        palette="accent"
        radius={0.45}
        size={SIZE}
      />
    </Part>
    <Part order={1}>
      <Slab
        at={FRONT}
        content={(w, d) => (
          <>
            <rect
              fill="var(--iso-glow)"
              height={0.85}
              rx={0.16}
              width={1.1}
              x={0.6}
              y={0.7}
            />
            <text
              fill="var(--iso-on-main)"
              fontSize={0.52}
              fontWeight={500}
              letterSpacing={0.06}
              style={{ fontVariantNumeric: "tabular-nums" }}
              x={0.6}
              y={d - 0.95}
            >
              {`•••• ${last4}`}
            </text>
            <circle
              cx={w - 1.35}
              cy={d - 1.1}
              fill="var(--iso-glow)"
              r={0.42}
            />
            <circle
              cx={w - 0.85}
              cy={d - 1.1}
              fill="var(--iso-glow)"
              opacity={0.55}
              r={0.42}
            />
          </>
        )}
        palette="main"
        radius={0.45}
        size={SIZE}
      />
      <FacePath
        at={[FRONT[0], FRONT[1], FRONT[2] + SIZE[2]]}
        d="M2.2 0.85 Q2.55 1.12 2.2 1.4 M2.6 0.62 Q3.15 1.12 2.6 1.62"
        fill="none"
        opacity={0.55}
        plane="top"
        stroke="var(--iso-on-main)"
        style={{
          strokeWidth: "max(0.15, calc(var(--iso-stroke-width) * 0.8))",
        }}
      />
    </Part>
  </IsoIcon>
);
