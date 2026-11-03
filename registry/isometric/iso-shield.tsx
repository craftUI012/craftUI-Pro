import { Box, Extrude, FacePath, IsoIcon, isoStroke, Part } from "./iso-core";
import type { IsoIconProps, Vec3 } from "./iso-core";

// A shield (extrusion keyline) standing on a low plinth, with a check mark
// on its face. Outline is 5 wide, 6.05 tall, in left-wall face units.
const SHIELD =
  "M2.5 0 C3.4 0.575 4.2 0.75 5 0.75 V3 C5 4.6 3.9 5.475 2.5 6.05 C1.1 5.475 0 4.6 0 3 V0.75 C0.8 0.75 1.6 0.575 2.5 0 Z";
const FRONT: Vec3 = [-2.5, 0.5, 7];

export const IsoShield = (props: IsoIconProps) => (
  <IsoIcon
    casts={[{ box: [-3.5, -2, 7, 4, 1] }, { box: [-2.5, -0.5, 5, 1, 6], z: 1 }]}
    {...props}
  >
    <Part order={0}>
      <Box at={[-3.5, -2, 0]} palette="surface" size={[7, 4, 1]} />
    </Part>
    <Part order={1}>
      <Extrude at={FRONT} d={SHIELD} depth={1} plane="left">
        <FacePath
          at={FRONT}
          d="M1.4 3.05 L2.15 3.8 L3.6 2.3"
          fill="none"
          plane="left"
          stroke="var(--iso-glow)"
          style={{ strokeWidth: isoStroke(1.65) }}
        />
      </Extrude>
    </Part>
  </IsoIcon>
);
