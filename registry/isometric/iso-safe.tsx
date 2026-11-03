import {
  Box,
  FaceEllipse,
  FacePath,
  IsoIcon,
  Part,
  faceOrigin,
  isoStroke,
} from "./iso-core";
import type { IsoIconProps, Vec3 } from "./iso-core";

// A floor safe on four feet: a heavy body, a raised door with two hinges, a
// combination dial with spokes, and a lever handle.
const BODY_AT: Vec3 = [-3, -3, 0.5];
const BODY: Vec3 = [6, 6, 6];
const DOOR_AT: Vec3 = [-2.6, 3, 1.1];
const DOOR: Vec3 = [5.2, 0.4, 4.8];
const DOOR_FACE = faceOrigin(DOOR_AT, DOOR, "left");
// Dial centre in door face units (u across, v down).
const DIAL = { u: 2.1, v: 2.4 };

const Foot = ({ x, y }: { x: number; y: number }) => (
  <Box at={[x, y, 0]} palette="surface" size={[0.75, 0.75, 0.5]} />
);

export const IsoSafe = (props: IsoIconProps) => (
  <IsoIcon casts={[{ box: [-3, -3, 6, 6, 6.5] }]} {...props}>
    <Part order={0}>
      <Foot x={-3} y={-3} />
      <Foot x={2.25} y={-3} />
      <Foot x={-3} y={2.25} />
      <Foot x={2.25} y={2.25} />
      <Box
        at={BODY_AT}
        right={(d, h) => (
          <rect
            fill="var(--iso-detail)"
            height={0.6}
            opacity={0.3}
            rx={0.1}
            width={d - 2}
            x={1}
            y={h - 1.1}
          />
        )}
        size={BODY}
      />
    </Part>
    <Part order={1}>
      <Box
        at={DOOR_AT}
        left={(_, h) => (
          <>
            <rect
              fill="var(--iso-detail)"
              height={0.8}
              opacity={0.5}
              rx={0.1}
              width={0.3}
              x={0.1}
              y={0.7}
            />
            <rect
              fill="var(--iso-detail)"
              height={0.8}
              opacity={0.5}
              rx={0.1}
              width={0.3}
              x={0.1}
              y={h - 1.5}
            />
          </>
        )}
        size={DOOR}
      />
      <FaceEllipse
        center={[DOOR_AT[0] + DIAL.u, 3.41, DOOR_FACE[2] - DIAL.v]}
        plane="left"
        r={1.15}
        style={{ fill: "var(--iso-screen)" }}
      />
      <FacePath
        at={DOOR_FACE}
        d={`M${DIAL.u} ${DIAL.v - 0.85} L${DIAL.u} ${DIAL.v + 0.85} M${DIAL.u - 0.85} ${DIAL.v} L${DIAL.u + 0.85} ${DIAL.v}`}
        fill="none"
        plane="left"
        stroke="var(--iso-detail)"
        style={{ strokeWidth: isoStroke(1.1) }}
      />
      <FaceEllipse
        center={[DOOR_AT[0] + DIAL.u, 3.42, DOOR_FACE[2] - DIAL.v]}
        plane="left"
        r={0.4}
        style={{ fill: "var(--iso-glow)" }}
      />
      <Box at={[1.3, 3.4, 2.75]} palette="surface" size={[0.4, 0.5, 1.5]} />
    </Part>
  </IsoIcon>
);
