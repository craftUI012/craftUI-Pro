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

// A wallet lying flat with stitched edges, a strap with a snap button, and
// a card tucked in so its top edge and chip show.
const BODY_AT: Vec3 = [-3.5, -2, 0];
const BODY: Vec3 = [7, 4, 2];
const CARD_AT: Vec3 = [-2.5, -1, 2];
const CARD: Vec3 = [4.5, 0.3, 2.25];
const STRAP_AT: Vec3 = [2.25, -2.1, 0.6];
const STRAP: Vec3 = [1.25, 4.2, 1.6];

export const IsoWallet = (props: IsoIconProps) => (
  <IsoIcon
    casts={[
      { box: [-3.5, -2.1, 7, 4.2, 2.2] },
      {
        box: [CARD_AT[0], CARD_AT[1], CARD[0], CARD[1], CARD[2]],
        z: CARD_AT[2],
      },
    ]}
    {...props}
  >
    <Part order={0}>
      <Box at={BODY_AT} size={BODY} />
      <FacePath
        at={faceOrigin(BODY_AT, BODY, "top")}
        d="M0.4 0.4 H6.6 V3.6 H0.4 Z"
        fill="none"
        opacity={0.5}
        plane="top"
        stroke="var(--iso-detail)"
        strokeDasharray="0.35 0.3"
        style={{ strokeWidth: isoStroke(0.7) }}
      />
    </Part>
    <Part order={1}>
      <Box
        at={CARD_AT}
        left={() => (
          <rect
            fill="var(--iso-glow)"
            height={0.6}
            rx={0.1}
            width={0.8}
            x={0.6}
            y={0.5}
          />
        )}
        palette="accent"
        size={CARD}
      />
    </Part>
    <Part order={2}>
      <Box at={STRAP_AT} palette="surface" size={STRAP} />
      <FaceEllipse
        center={[
          STRAP_AT[0] + STRAP[0] / 2,
          STRAP_AT[1] + STRAP[1] + 0.01,
          1.4,
        ]}
        plane="left"
        r={0.3}
        style={{ fill: "var(--iso-glow)" }}
      />
    </Part>
  </IsoIcon>
);
