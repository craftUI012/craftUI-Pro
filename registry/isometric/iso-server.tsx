import { Box, IsoIcon, Part } from "./iso-core";
import type { IsoIconProps } from "./iso-core";

// Three rack units (tower keyline) stacked with a 0.5 gap. The front of each
// unit carries drive slots and two status lights; the side carries vents.
const UNIT = { d: 5, gap: 0.5, h: 2, w: 6 };

const Unit = ({ index }: { index: number }) => (
  <Part order={index}>
    <Box
      at={[-UNIT.w / 2, -UNIT.d / 2, index * (UNIT.h + UNIT.gap)]}
      left={(w, h) => (
        <>
          {[0, 1, 2].map((i) => (
            <rect
              fill="var(--iso-detail)"
              height={0.3}
              key={i}
              opacity={0.55}
              rx={0.15}
              width={0.9}
              x={0.6 + i * 1.2}
              y={h / 2 - 0.15}
            />
          ))}
          <circle cx={w - 1.4} cy={h / 2} fill="var(--iso-glow)" r={0.25} />
          <circle
            cx={w - 0.7}
            cy={h / 2}
            fill="var(--iso-glow)"
            opacity={0.45}
            r={0.25}
          />
        </>
      )}
      right={(d, h) =>
        [0, 1, 2, 3].map((i) => (
          <rect
            fill="var(--iso-detail)"
            height={h - 0.8}
            key={i}
            opacity={0.3}
            rx={0.1}
            width={0.2}
            x={d - 0.9 - i * 0.5}
            y={0.4}
          />
        ))
      }
      size={[UNIT.w, UNIT.d, UNIT.h]}
    />
  </Part>
);

export const IsoServer = (props: IsoIconProps) => (
  <IsoIcon casts={[{ box: [-3, -2.5, 6, 5, 7] }]} {...props}>
    <Unit index={0} />
    <Unit index={1} />
    <Unit index={2} />
  </IsoIcon>
);
