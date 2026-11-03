import { Cylinder, ISO_S, IsoIcon, Part, project } from "./iso-core";
import type { IsoIconProps } from "./iso-core";

// Three stacked disks (cylinder keyline). Each disk shows two status lights
// on its front curve; the top disk carries an inner ring.
const DISK = { gap: 0.5, h: 2, r: 3 };
const RX = ISO_S * DISK.r * Math.sqrt(1.5);
const RY = ISO_S * DISK.r * Math.SQRT1_2;

// A point on the front curve, `t` of the way from the centre to the left
// silhouette, halfway up the side (math §4: the bottom ellipse's front arc).
const curvePoint = (z: number, t: number): [number, number] => {
  const [sx, by] = project([0, 0, z]);
  const dx = -t * RX;
  return [
    sx + dx,
    by - (ISO_S * DISK.h) / 2 + RY * Math.sqrt(1 - (dx / RX) ** 2),
  ];
};

const Disk = ({ index }: { index: number }) => {
  const z = index * (DISK.h + DISK.gap);
  const [ax, ay] = curvePoint(z, 0.62);
  const [bx, by] = curvePoint(z, 0.36);
  return (
    <Part order={index}>
      <Cylinder
        center={[0, 0, z]}
        height={DISK.h}
        radius={DISK.r}
        top={
          index === 2 ? (
            <ellipse
              fill="none"
              opacity={0.5}
              rx={RX * 0.58}
              ry={RY * 0.58}
              stroke="var(--iso-detail)"
            />
          ) : null
        }
      />
      <circle cx={ax} cy={ay} fill="var(--iso-glow)" r={0.28} stroke="none" />
      <circle
        cx={bx}
        cy={by}
        fill="var(--iso-glow)"
        opacity={0.45}
        r={0.28}
        stroke="none"
      />
    </Part>
  );
};

export const IsoDatabase = (props: IsoIconProps) => (
  <IsoIcon casts={[{ disc: [0, 0, 3, 7] }]} {...props}>
    <Disk index={0} />
    <Disk index={1} />
    <Disk index={2} />
  </IsoIcon>
);
