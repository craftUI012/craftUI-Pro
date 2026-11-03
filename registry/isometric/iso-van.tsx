import { Box, FaceEllipse, IsoIcon, Part, Poly } from "./iso-core";
import type { IsoIconProps } from "./iso-core";

// A delivery van driving toward +x (down-right): cargo body with a brand
// stripe and parcel mark, a cab with a raked windshield and side window,
// headlights, a bumper and two visible wheels. Use `mirror` to face left.
const Y0 = -1.75;
const Y1 = 1.75;
const FLOOR = 0.75;

const Wheel = ({ x }: { x: number }) => (
  <>
    <FaceEllipse
      center={[x, Y1 + 0.01, FLOOR]}
      plane="left"
      r={0.85}
      style={{ fill: "var(--iso-detail)" }}
    />
    <FaceEllipse
      center={[x, Y1 + 0.02, FLOOR]}
      plane="left"
      r={0.35}
      stroke="none"
      style={{ fill: "var(--iso-screen)" }}
    />
  </>
);

export const IsoVan = (props: IsoIconProps) => (
  <IsoIcon footprint={4} {...props}>
    <Part order={0}>
      <Box
        at={[-4, Y0, FLOOR]}
        left={(w) => (
          <>
            <rect fill="var(--iso-glow)" height={0.5} width={w} x={0} y={2.4} />
            <rect
              fill="var(--iso-screen)"
              height={1.25}
              rx={0.12}
              width={1.5}
              x={0.75}
              y={0.75}
            />
            <rect
              fill="var(--iso-glow)"
              height={1.25}
              opacity={0.75}
              width={0.35}
              x={1.33}
              y={0.75}
            />
          </>
        )}
        size={[5, 3.5, 4]}
      />
    </Part>
    <Part order={1}>
      <Box
        at={[1, Y0, FLOOR]}
        left={() => (
          <rect
            fill="var(--iso-screen)"
            height={0.95}
            rx={0.12}
            width={1}
            x={0.25}
            y={0.4}
          />
        )}
        size={[1.5, 3.5, 2.75]}
      />
      <Box
        at={[2.5, Y0, FLOOR]}
        right={(d) => (
          <>
            <circle cx={0.55} cy={0.55} fill="var(--iso-glow)" r={0.22} />
            <circle cx={d - 0.55} cy={0.55} fill="var(--iso-glow)" r={0.22} />
          </>
        )}
        size={[1, 3.5, 1.5]}
      />
      <Poly
        points={[
          [2.5, Y0, 3.5],
          [2.5, Y1, 3.5],
          [3.5, Y1, 2.25],
          [3.5, Y0, 2.25],
        ]}
      />
      <Poly
        points={[
          [2.6, Y0 + 0.3, 3.35],
          [2.6, Y1 - 0.3, 3.35],
          [3.4, Y1 - 0.3, 2.35],
          [3.4, Y0 + 0.3, 2.35],
        ]}
        stroke="none"
        style={{ fill: "var(--iso-screen)" }}
      />
      <Poly
        points={[
          [2.5, Y1, 3.5],
          [3.5, Y1, 2.25],
          [2.5, Y1, 2.25],
        ]}
      />
      <Box at={[3.5, Y0 + 0.25, 0.5]} palette="surface" size={[0.25, 3, 0.5]} />
    </Part>
    <Part order={2}>
      <Wheel x={-2.5} />
      <Wheel x={2} />
    </Part>
  </IsoIcon>
);
