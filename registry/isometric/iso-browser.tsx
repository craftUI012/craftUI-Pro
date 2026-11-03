import { Box, IsoIcon, Part } from "./iso-core";
import type { IsoIconProps } from "./iso-core";

// A browser window standing upright (panel keyline): title bar with three
// dots and an address bar, a hero block and lines of text.
const SIZE = { d: 1, h: 6, w: 7 };

export const IsoBrowser = (props: IsoIconProps) => (
  <IsoIcon casts={[{ box: [-3.5, -0.5, 7, 1, 6] }]} {...props}>
    <Part order={0}>
      <Box
        at={[-SIZE.w / 2, -SIZE.d / 2, 0]}
        left={(w, h) => (
          <>
            {[0, 1, 2].map((i) => (
              <circle
                cx={0.6 + i * 0.5}
                cy={0.55}
                fill="var(--iso-detail)"
                key={i}
                opacity={0.55}
                r={0.17}
              />
            ))}
            <rect
              fill="var(--iso-screen)"
              height={0.45}
              opacity={0.85}
              rx={0.22}
              width={w - 2.75}
              x={2.25}
              y={0.33}
            />
            <rect
              fill="var(--iso-screen)"
              height={h - 1.4}
              rx={0.15}
              width={w - 0.6}
              x={0.3}
              y={1.1}
            />
            <rect
              fill="var(--iso-glow)"
              height={1.75}
              opacity={0.9}
              rx={0.15}
              width={w - 1.5}
              x={0.75}
              y={1.55}
            />
            {[0, 1, 2].map((i) => (
              <rect
                fill="var(--iso-screen-ink)"
                height={0.25}
                key={i}
                opacity={0.4}
                rx={0.12}
                width={i === 2 ? 2.25 : 4}
                x={0.75}
                y={3.85 + i * 0.55}
              />
            ))}
          </>
        )}
        size={[SIZE.w, SIZE.d, SIZE.h]}
      />
    </Part>
  </IsoIcon>
);
