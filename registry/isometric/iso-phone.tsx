import { Box, IsoIcon, Part } from "./iso-core";
import type { IsoIconProps } from "./iso-core";

// A phone lying flat (slab keyline) showing a checkout: two cart lines with
// thumbnails, a total and a pay button. Top of the screen is the back edge.
const SIZE = { d: 7, h: 0.5, w: 4 };

const CartLine = ({ y, bright }: { y: number; bright: boolean }) => (
  <>
    <rect
      fill={bright ? "var(--iso-glow)" : "var(--iso-screen-ink)"}
      height={1.2}
      opacity={bright ? 0.9 : 0.25}
      rx={0.2}
      width={1.2}
      x={0.6}
      y={y}
    />
    <rect
      fill="var(--iso-screen-ink)"
      height={0.2}
      opacity={0.55}
      rx={0.1}
      width={1.3}
      x={2.1}
      y={y + 0.12}
    />
    <rect
      fill="var(--iso-screen-ink)"
      height={0.2}
      opacity={0.3}
      rx={0.1}
      width={0.9}
      x={2.1}
      y={y + 0.5}
    />
    <rect
      fill="var(--iso-screen-ink)"
      height={0.24}
      opacity={0.65}
      rx={0.12}
      width={0.7}
      x={2.1}
      y={y + 0.92}
    />
  </>
);

export const IsoPhone = (props: IsoIconProps) => (
  <IsoIcon {...props}>
    <Part order={0}>
      <Box
        at={[-SIZE.w / 2, -SIZE.d / 2, 0]}
        size={[SIZE.w, SIZE.d, SIZE.h]}
        top={(w, d) => (
          <>
            <rect
              fill="var(--iso-screen)"
              height={d - 0.9}
              rx={0.35}
              width={w - 0.6}
              x={0.3}
              y={0.6}
            />
            <rect
              fill="var(--iso-screen-ink)"
              height={0.14}
              opacity={0.4}
              rx={0.07}
              width={0.9}
              x={w / 2 - 0.45}
              y={0.25}
            />
            <CartLine bright y={1} />
            <CartLine bright={false} y={2.6} />
            <rect
              fill="var(--iso-screen-ink)"
              height={0.05}
              opacity={0.3}
              width={2.8}
              x={0.6}
              y={4.25}
            />
            <rect
              fill="var(--iso-screen-ink)"
              height={0.22}
              opacity={0.45}
              rx={0.11}
              width={1}
              x={0.6}
              y={4.55}
            />
            <rect
              fill="var(--iso-screen-ink)"
              height={0.28}
              opacity={0.75}
              rx={0.14}
              width={0.9}
              x={2.5}
              y={4.52}
            />
            <rect
              fill="var(--iso-glow)"
              height={0.8}
              rx={0.3}
              width={2.8}
              x={0.6}
              y={5.3}
            />
            <rect
              fill="var(--iso-screen)"
              height={0.16}
              opacity={0.9}
              rx={0.08}
              width={0.9}
              x={1.55}
              y={5.62}
            />
          </>
        )}
      />
    </Part>
  </IsoIcon>
);
