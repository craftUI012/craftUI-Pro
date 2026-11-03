import { Box, FacePath, IsoIcon, Part, Poly, faceOrigin } from "./iso-core";
import type { IsoIconProps, IsoPalette, Vec3 } from "./iso-core";

// A corner shop: neutral walls, a sign band, a display window with goods, a
// glazed door, a striped awning sloping out over the front, a side window
// and a rooftop unit. The brand color lives in the awning and sign only.
const AT: Vec3 = [-3.5, -3, 0];
const SIZE: Vec3 = [7, 6, 5.5];
const FRONT_Y = AT[1] + SIZE[1];
// Awning: hinged on the wall at z = 4, sloping out to y = 4 at z = 3.25,
// with a 0.4 valance. Seven 1-unit stripes, brand and neutral alternating.
const AWNING = { drop: 0.4, hingeZ: 4, lipY: 4, lipZ: 3.25 };
const STRIPES = Array.from({ length: 7 }, (_, i) => AT[0] + i);

const stripePalette = (i: number): IsoPalette =>
  i % 2 === 0 ? "main" : "surface";

const Awning = () => (
  <>
    {STRIPES.map((x, i) => (
      <Poly
        key={x}
        palette={stripePalette(i)}
        points={[
          [x, FRONT_Y, AWNING.hingeZ],
          [x + 1, FRONT_Y, AWNING.hingeZ],
          [x + 1, AWNING.lipY, AWNING.lipZ],
          [x, AWNING.lipY, AWNING.lipZ],
        ]}
      />
    ))}
    {STRIPES.map((x, i) => (
      <Poly
        key={x}
        palette={stripePalette(i)}
        points={[
          [x, AWNING.lipY, AWNING.lipZ],
          [x + 1, AWNING.lipY, AWNING.lipZ],
          [x + 1, AWNING.lipY, AWNING.lipZ - AWNING.drop],
          [x, AWNING.lipY, AWNING.lipZ - AWNING.drop],
        ]}
      />
    ))}
    <Poly
      palette="main"
      points={[
        [AT[0] + SIZE[0], FRONT_Y, AWNING.hingeZ],
        [AT[0] + SIZE[0], AWNING.lipY, AWNING.lipZ],
        [AT[0] + SIZE[0], AWNING.lipY, AWNING.lipZ - AWNING.drop],
      ]}
    />
  </>
);

const Goods = () => (
  <>
    <rect
      fill="var(--iso-glow)"
      height={0.8}
      rx={0.1}
      width={0.7}
      x={0.8}
      y={3.9}
    />
    <rect
      fill="var(--iso-detail)"
      height={1.2}
      opacity={0.35}
      rx={0.1}
      width={0.55}
      x={1.7}
      y={3.5}
    />
    <rect
      fill="var(--iso-glow)"
      height={0.55}
      opacity={0.6}
      rx={0.1}
      width={0.9}
      x={2.75}
      y={4.15}
    />
    <rect
      fill="var(--iso-detail)"
      height={0.08}
      opacity={0.3}
      width={3.6}
      x={0.5}
      y={4.7}
    />
  </>
);

export const IsoStore = (props: IsoIconProps) => (
  <IsoIcon {...props}>
    <Part order={0}>
      <Box
        at={AT}
        left={(w) => (
          <>
            <rect
              height={1.1}
              rx={0.1}
              style={{ fill: "var(--iso-main-left)" }}
              width={w - 1}
              x={0.5}
              y={0.4}
            />
            <rect
              fill="var(--iso-screen)"
              height={0.38}
              opacity={0.9}
              rx={0.19}
              width={2.5}
              x={1}
              y={0.76}
            />
            <rect
              fill="var(--iso-screen)"
              height={2.1}
              rx={0.1}
              width={3.6}
              x={0.5}
              y={2.6}
            />
            <Goods />
            <rect
              fill="var(--iso-detail)"
              height={3.1}
              opacity={0.55}
              rx={0.1}
              width={1.6}
              x={4.7}
              y={2.4}
            />
            <rect
              fill="var(--iso-screen)"
              height={1.4}
              opacity={0.85}
              rx={0.08}
              width={1.1}
              x={4.95}
              y={2.7}
            />
            <circle cx={5.95} cy={4.25} fill="var(--iso-screen)" r={0.1} />
          </>
        )}
        palette="surface"
        right={() => (
          <>
            <rect
              fill="var(--iso-screen)"
              height={1.5}
              rx={0.1}
              width={2.5}
              x={1.25}
              y={2.6}
            />
            <rect
              fill="var(--iso-detail)"
              height={1.5}
              opacity={0.25}
              width={0.08}
              x={2.46}
              y={2.6}
            />
          </>
        )}
        size={SIZE}
      />
      <FacePath
        at={faceOrigin(AT, SIZE, "right")}
        d="M5.4 0.3 L5.4 5.5"
        fill="none"
        opacity={0.35}
        plane="right"
        stroke="var(--iso-detail)"
      />
    </Part>
    <Part order={1}>
      <Box
        at={[-2, -2.5, 5.5]}
        left={(w, h) =>
          [0, 1, 2].map((i) => (
            <rect
              fill="var(--iso-detail)"
              height={h - 0.5}
              key={i}
              opacity={0.3}
              rx={0.06}
              width={0.12}
              x={w / 2 - 0.4 + i * 0.4}
              y={0.25}
            />
          ))
        }
        palette="surface"
        size={[2, 1.5, 1]}
      />
    </Part>
    <Part order={2}>
      <Awning />
    </Part>
  </IsoIcon>
);
