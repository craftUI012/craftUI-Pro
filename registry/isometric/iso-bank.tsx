import { Box, Cylinder, FaceEllipse, IsoIcon, Part, Poly } from "./iso-core";
import type { IsoIconProps } from "./iso-core";

// A classical bank: two steps, a hall, four columns, an entablature with the
// bank's name band, and a pediment carrying a coin emblem. Neutral stone;
// the accent lands on the name band and the emblem only.
const COLUMN_X = [-2.4, -0.8, 0.8, 2.4];
const BASE_Z = 1;
const COLUMN_H = 4;
const TOP_Z = BASE_Z + COLUMN_H;
const BEAM_H = 0.75;
const RIDGE_Z = 7.5;

export const IsoBank = (props: IsoIconProps) => (
  <IsoIcon casts={[{ box: [-4, -3.5, 8, 7, RIDGE_Z] }]} {...props}>
    <Part order={0}>
      <Box at={[-4, -3.5, 0]} palette="surface" size={[8, 7, 0.5]} />
      <Box at={[-3.5, -3, 0.5]} palette="surface" size={[7, 6, 0.5]} />
    </Part>
    <Part order={1}>
      <Box
        at={[-3, -3, BASE_Z]}
        left={(_, h) => (
          <rect
            fill="var(--iso-detail)"
            height={h - 1.25}
            opacity={0.45}
            rx={0.1}
            width={1.5}
            x={2.25}
            y={1.25}
          />
        )}
        palette="surface"
        size={[6, 4, COLUMN_H]}
      />
      {COLUMN_X.map((x) => (
        <Cylinder
          center={[x, 2, BASE_Z]}
          height={COLUMN_H}
          key={x}
          palette="surface"
          radius={0.45}
        />
      ))}
    </Part>
    <Part order={2}>
      <Box
        at={[-3.5, -3, TOP_Z]}
        left={(w, h) => (
          <rect
            fill="var(--iso-glow)"
            height={h * 0.4}
            rx={0.1}
            width={w * 0.5}
            x={w * 0.25}
            y={h * 0.3}
          />
        )}
        palette="surface"
        size={[7, 6, BEAM_H]}
      />
      <Poly
        palette="main"
        points={[
          [0, -3, RIDGE_Z],
          [0, 3, RIDGE_Z],
          [-3.5, 3, TOP_Z + BEAM_H],
          [-3.5, -3, TOP_Z + BEAM_H],
        ]}
      />
      <Poly
        palette="main"
        points={[
          [0, -3, RIDGE_Z],
          [0, 3, RIDGE_Z],
          [3.5, 3, TOP_Z + BEAM_H],
          [3.5, -3, TOP_Z + BEAM_H],
        ]}
      />
      <Poly
        palette="surface"
        points={[
          [-3.5, 3, TOP_Z + BEAM_H],
          [3.5, 3, TOP_Z + BEAM_H],
          [0, 3, RIDGE_Z],
        ]}
      />
      <FaceEllipse
        center={[0, 3.01, 6.35]}
        plane="left"
        r={0.4}
        style={{ fill: "var(--iso-glow)" }}
      />
    </Part>
  </IsoIcon>
);
