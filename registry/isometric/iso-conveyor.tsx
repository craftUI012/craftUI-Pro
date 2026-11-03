import {
  Box,
  faceOrigin,
  FacePath,
  IsoIcon,
  isoStroke,
  Part,
} from "./iso-core";
import type { IsoIconProps, Vec3 } from "./iso-core";

// A conveyor running toward +x: four legs, a frame with a rail, a belt with
// roller seams and direction chevrons, and two parcels riding on it.
const BELT_AT: Vec3 = [-4, -1.5, 1.5];
const BELT_SIZE: Vec3 = [8, 3, 0.5];
const BELT_TOP = BELT_AT[2] + BELT_SIZE[2];

const Leg = ({ x, y }: { x: number; y: number }) => (
  <Box at={[x, y, 0]} palette="surface" size={[0.5, 0.5, 1.5]} />
);

const Parcel = ({ at, size }: { at: Vec3; size: Vec3 }) => (
  <Box
    at={at}
    left={(w, h) => (
      <rect
        fill="var(--iso-screen)"
        height={Math.min(1, h * 0.4)}
        rx={0.08}
        width={w * 0.4}
        x={0.3}
        y={0.35}
      />
    )}
    size={size}
    top={(w, d) => (
      <rect
        height={0.5}
        style={{ fill: "var(--iso-accent-top)" }}
        width={w}
        x={0}
        y={d / 2 - 0.25}
      />
    )}
  />
);

export const IsoConveyor = (props: IsoIconProps) => (
  <IsoIcon footprint={4} {...props}>
    <Part order={0}>
      <Leg x={-3.5} y={-1.5} />
      <Leg x={3} y={-1.5} />
      <Leg x={-3.5} y={1} />
      <Leg x={3} y={1} />
      <Box
        at={BELT_AT}
        left={(w, h) => (
          <rect
            fill="var(--iso-glow)"
            height={h * 0.3}
            opacity={0.8}
            width={w}
            x={0}
            y={h * 0.35}
          />
        )}
        palette="surface"
        size={BELT_SIZE}
        top={(w, d) => (
          <>
            <rect
              fill="var(--iso-detail)"
              height={d - 0.8}
              opacity={0.16}
              width={w}
              x={0}
              y={0.4}
            />
            {Array.from({ length: 7 }, (_, i) => (
              <rect
                fill="var(--iso-detail)"
                height={d - 0.8}
                key={i}
                opacity={0.22}
                width={0.06}
                x={1 + i}
                y={0.4}
              />
            ))}
          </>
        )}
      />
      <FacePath
        at={faceOrigin(BELT_AT, BELT_SIZE, "top")}
        d="M6.7 1 L7.2 1.5 L6.7 2 M7.3 1 L7.8 1.5 L7.3 2"
        fill="none"
        plane="top"
        stroke="var(--iso-glow)"
        style={{ strokeWidth: isoStroke(1) }}
      />
    </Part>
    <Part order={1}>
      <Parcel at={[-3.25, -1, BELT_TOP]} size={[2, 2, 1.5]} />
    </Part>
    <Part order={2}>
      <Parcel at={[0, -1.25, BELT_TOP]} size={[2.5, 2.5, 2]} />
    </Part>
  </IsoIcon>
);
