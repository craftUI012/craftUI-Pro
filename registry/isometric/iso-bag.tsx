import {
  Box,
  faceOrigin,
  FacePath,
  IsoIcon,
  isoStroke,
  Part,
} from "./iso-core";
import type { IsoIconProps, Vec3 } from "./iso-core";

// A paper shopping bag, open at the top, with two rope handles, a folded
// band, a round brand mark and a side gusset crease.
const AT: Vec3 = [-2.5, -1.5, 0];
const SIZE: Vec3 = [5, 3, 5.5];
const TOP_Z = AT[2] + SIZE[2];

// A rope loop rising from the top edge, drawn in a plane parallel to the
// front wall at depth y (left-wall face units; negative v is above the bag).
const Handle = ({ y }: { y: number }) => (
  <FacePath
    at={[AT[0], y, TOP_Z]}
    d="M1.5 0 C1.5 -2.4 3.5 -2.4 3.5 0"
    fill="none"
    plane="left"
    stroke="var(--iso-detail)"
    style={{ strokeWidth: isoStroke(1.35) }}
  />
);

export const IsoBag = (props: IsoIconProps) => (
  <IsoIcon {...props}>
    <Part order={0}>
      <Box
        at={AT}
        left={(w) => (
          <>
            <rect
              height={0.7}
              style={{ fill: "var(--iso-accent-left)" }}
              width={w}
              x={0}
              y={0}
            />
            <circle cx={w / 2} cy={2.9} fill="var(--iso-glow)" r={0.9} />
            <circle cx={w / 2} cy={2.9} fill="var(--iso-screen)" r={0.35} />
          </>
        )}
        right={(d) => (
          <rect
            height={0.7}
            style={{ fill: "var(--iso-accent-right)" }}
            width={d}
            x={0}
            y={0}
          />
        )}
        size={SIZE}
        top={(w, d) => (
          <rect
            fill="var(--iso-detail)"
            height={d - 0.5}
            opacity={0.28}
            width={w - 0.5}
            x={0.25}
            y={0.25}
          />
        )}
      />
      <FacePath
        at={faceOrigin(AT, SIZE, "right")}
        d="M1.5 0.7 L1.5 5.5"
        fill="none"
        opacity={0.35}
        plane="right"
        stroke="var(--iso-detail)"
      />
    </Part>
    <Part order={1}>
      <Handle y={-0.75} />
      <Handle y={0.75} />
    </Part>
  </IsoIcon>
);
