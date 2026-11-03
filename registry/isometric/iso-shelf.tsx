import { Box, IsoIcon, Part } from "./iso-core";
import type { IsoIconProps, IsoPalette, Vec3 } from "./iso-core";

// A warehouse rack: four uprights, three shelves with bin labels, and
// stock of mixed sizes. Uprights and shelves are neutral; stock takes the
// main and accent colors. Parts are listed far to near (math §6).
const POST = 0.5;
const POST_H = 7.5;
const SHELF_Z = [0.5, 3, 5.5];

const Post = ({ x, y }: { x: number; y: number }) => (
  <Box at={[x, y, 0]} palette="surface" size={[POST, POST, POST_H]} />
);

const Shelf = ({ z }: { z: number }) => (
  <Box
    at={[-3, -1, z]}
    left={(w, h) =>
      [0, 1, 2].map((i) => (
        <rect
          fill="var(--iso-screen)"
          height={h - 0.2}
          key={i}
          rx={0.05}
          width={0.6}
          x={0.6 + i * (w / 3)}
          y={0.1}
        />
      ))
    }
    palette="surface"
    size={[6, 2, 0.5]}
  />
);

const Stock = ({
  at,
  size,
  palette,
}: {
  at: Vec3;
  size: Vec3;
  palette: IsoPalette;
}) => (
  <Box
    at={at}
    palette={palette}
    size={size}
    top={(w, d) => (
      <rect
        fill="var(--iso-detail)"
        height={0.3}
        opacity={0.3}
        width={w}
        x={0}
        y={d / 2 - 0.15}
      />
    )}
  />
);

export const IsoShelf = (props: IsoIconProps) => (
  <IsoIcon footprint={4} {...props}>
    <Part order={0}>
      <Post x={-3.5} y={-1.5} />
      <Post x={3} y={-1.5} />
    </Part>
    <Part order={1}>
      <Shelf z={SHELF_Z[0]} />
      <Stock at={[-2.5, -0.75, 1]} palette="main" size={[2, 1.5, 1.5]} />
      <Stock at={[0, -0.75, 1]} palette="accent" size={[1.5, 1.5, 1]} />
      <Stock at={[1.75, -0.5, 1]} palette="main" size={[1, 1, 1]} />
    </Part>
    <Part order={2}>
      <Shelf z={SHELF_Z[1]} />
      <Stock at={[-2.75, -0.75, 3.5]} palette="accent" size={[1.5, 1.5, 1.5]} />
      <Stock at={[-1, -0.75, 3.5]} palette="main" size={[2.5, 1.5, 1]} />
    </Part>
    <Part order={3}>
      <Shelf z={SHELF_Z[2]} />
      <Stock at={[0.5, -0.75, 6]} palette="main" size={[2, 1.5, 1]} />
    </Part>
    <Part order={4}>
      <Post x={-3.5} y={1} />
      <Post x={3} y={1} />
    </Part>
  </IsoIcon>
);
