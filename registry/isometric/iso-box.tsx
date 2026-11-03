import { Box, IsoIcon, Part } from "./iso-core";
import type { IsoIconProps } from "./iso-core";

// A shipping box (cube keyline): tape across the lid and down the side, a
// shipping label on the front.
const SIZE = { d: 6, h: 5, w: 6 };
const TAPE = 1.25;

export const IsoBox = (props: IsoIconProps) => {
  const band = SIZE.d / 2 - TAPE / 2;
  return (
    <IsoIcon {...props}>
      <Part order={0}>
        <Box
          at={[-SIZE.w / 2, -SIZE.d / 2, 0]}
          left={() => (
            <>
              <rect
                fill="var(--iso-screen)"
                height={1.75}
                rx={0.15}
                width={2.25}
                x={0.75}
                y={1}
              />
              {[0, 1, 2].map((i) => (
                <rect
                  fill="var(--iso-screen-ink)"
                  height={0.22}
                  key={i}
                  opacity={0.5}
                  rx={0.11}
                  width={i === 2 ? 0.9 : 1.5}
                  x={1.1}
                  y={1.4 + i * 0.42}
                />
              ))}
            </>
          )}
          right={(_, h) => (
            <rect
              height={h * 0.55}
              style={{ fill: "var(--iso-accent-right)" }}
              width={TAPE}
              x={band}
              y={0}
            />
          )}
          size={[SIZE.w, SIZE.d, SIZE.h]}
          top={(w) => (
            <rect
              height={TAPE}
              style={{ fill: "var(--iso-accent-top)" }}
              width={w}
              x={0}
              y={band}
            />
          )}
        />
      </Part>
    </IsoIcon>
  );
};
