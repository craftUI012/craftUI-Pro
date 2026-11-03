import { IsoIcon, Part, Sphere } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// An edge network: a wireframe globe hovering above its shadow, with lit
// nodes where regions are. Nodes come from props as [latitude, longitude]
// in degrees; ones on the far side are hidden automatically.
const CENTER: Vec3 = [0, 0, 4.25];
const RADIUS = 3.4;
const CASTS: IsoCast[] = [
  { disc: [0, 0, RADIUS * 0.85, RADIUS * 1.6], z: CENTER[2] - RADIUS * 0.8 },
];

export const IsoGlobe = ({
  nodes = [
    [38, 20],
    [50, 75],
    [12, 40],
    [-15, 70],
    [30, 120],
    [-35, 25],
    [5, -10],
  ],
  ...props
}: IsoIconProps & {
  /** Lit regions as [latitude, longitude] in degrees. */
  nodes?: readonly (readonly [number, number])[];
}) => (
  <IsoIcon casts={CASTS} {...props}>
    <Part order={0}>
      <Sphere center={CENTER} nodes={nodes} radius={RADIUS} />
    </Part>
  </IsoIcon>
);
