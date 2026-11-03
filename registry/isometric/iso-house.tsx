import { Box, IsoIcon, Part, Poly } from "./iso-core";
import type { IsoIconProps } from "./iso-core";

// A small house: neutral walls, a 45° gable roof in the main color (ridge
// along x), a chimney, a front door with a step, and windows. The back roof
// slope is edge-on to the viewer at 45°, so only the front slope and the
// gable show (math §3: faces with n·V ≤ 0 are skipped).
const RIDGE_Z = 7;
const EAVE = 3.5;

const Window = ({ x, y }: { x: number; y: number }) => (
  <>
    <rect
      fill="var(--iso-screen)"
      height={1.5}
      rx={0.1}
      width={2}
      x={x}
      y={y}
    />
    <rect
      fill="var(--iso-detail)"
      height={1.5}
      opacity={0.3}
      width={0.08}
      x={x + 0.96}
      y={y}
    />
    <rect
      fill="var(--iso-detail)"
      height={0.08}
      opacity={0.3}
      width={2}
      x={x}
      y={y + 0.71}
    />
  </>
);

export const IsoHouse = (props: IsoIconProps) => (
  <IsoIcon {...props}>
    <Part order={0}>
      <Box
        at={[-3, -3, 0]}
        left={() => (
          <>
            <Window x={0.75} y={1} />
            <rect
              height={2.5}
              rx={0.1}
              style={{ fill: "var(--iso-accent-left)" }}
              width={1.4}
              x={3.6}
              y={1.5}
            />
            <circle cx={4.75} cy={2.85} fill="var(--iso-screen)" r={0.1} />
          </>
        )}
        palette="surface"
        right={() => <Window x={2} y={1} />}
        size={[6, 6, 4]}
      />
      <Box at={[0.5, 3, 0]} palette="surface" size={[1.75, 0.5, 0.25]} />
    </Part>
    <Part order={1}>
      <Box at={[-2, -1.5, 5]} palette="surface" size={[1, 1, 2.5]} />
      <Poly
        palette="surface"
        points={[
          [3, -3, 4],
          [3, 3, 4],
          [3, 0, RIDGE_Z],
        ]}
      />
      <Poly
        points={[
          [-3, 0, RIDGE_Z],
          [3, 0, RIDGE_Z],
          [3, EAVE, RIDGE_Z - EAVE],
          [-3, EAVE, RIDGE_Z - EAVE],
        ]}
      />
    </Part>
  </IsoIcon>
);
