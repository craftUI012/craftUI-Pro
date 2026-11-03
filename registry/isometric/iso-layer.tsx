import {
  CLEAR_GLASS,
  ISO_MONO,
  IsoIcon,
  Part,
  Slab,
  isoStroke,
  project,
} from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// One layer of an exploded technology stack: a clear glass plate with a
// mono label and content for its kind (edge network, functions, or the
// app). `stem` draws dashed guides down from its corners, so stacked layers
// read as one system. Stack them in a scene with IsoSceneItem `z`.
const AT: Vec3 = [-3.5, -3.5, 0];
const SIZE: Vec3 = [7, 7, 0.3];
const INSET = 0.35;

export type IsoLayerKind = "edge" | "functions" | "app";

const LABELS: Record<IsoLayerKind, string> = {
  app: "Your app",
  edge: "Edge network",
  functions: "Functions",
};

const EdgeContent = () => {
  const lit = new Set([6, 8, 12, 16, 18]);
  return (
    <>
      {Array.from({ length: 25 }, (_, i) => {
        const x = 1.3 + (i % 5) * 1.1;
        const y = 1.6 + Math.floor(i / 5) * 1.1;
        return lit.has(i) ? (
          <g key={i}>
            <circle
              cx={x}
              cy={y}
              fill="var(--iso-glow)"
              opacity={0.25}
              r={0.32}
            />
            <circle cx={x} cy={y} fill="var(--iso-glow)" r={0.14} />
          </g>
        ) : (
          <circle
            cx={x}
            cy={y}
            fill="var(--iso-text)"
            key={i}
            opacity={0.22}
            r={0.1}
          />
        );
      })}
    </>
  );
};

const FunctionsContent = ({ routes }: { routes: readonly string[] }) => (
  <>
    {routes.slice(0, 3).map((route, i) => (
      <g key={route}>
        <rect
          fill="var(--iso-screen)"
          height={1.15}
          rx={0.25}
          width={5.8}
          x={0.6}
          y={1.45 + i * 1.6}
        />
        <text
          fill="var(--iso-screen-ink)"
          fontFamily={ISO_MONO}
          fontSize={0.36}
          x={0.95}
          y={2.15 + i * 1.6}
        >
          {`ƒ ${route}`}
        </text>
        <circle cx={5.95} cy={2.03 + i * 1.6} fill="var(--iso-glow)" r={0.13} />
      </g>
    ))}
  </>
);

const AppContent = () => (
  <>
    <rect
      fill="var(--iso-screen)"
      height={5.3}
      rx={0.3}
      width={5.8}
      x={0.6}
      y={0.6}
    />
    <rect
      fill="var(--iso-screen-ink)"
      height={0.2}
      opacity={0.5}
      rx={0.1}
      width={1.2}
      x={0.95}
      y={0.95}
    />
    <rect
      fill="var(--iso-glow)"
      height={1.7}
      opacity={0.9}
      rx={0.2}
      width={5.1}
      x={0.95}
      y={1.5}
    />
    {[0, 1, 2].map((i) => (
      <rect
        fill="var(--iso-screen-ink)"
        height={0.18}
        key={i}
        opacity={0.35}
        rx={0.09}
        width={i === 2 ? 2.2 : 4}
        x={0.95}
        y={3.6 + i * 0.42}
      />
    ))}
    <rect
      fill="var(--iso-screen-ink)"
      height={0.5}
      rx={0.25}
      width={1.5}
      x={0.95}
      y={5}
    />
  </>
);

export const IsoLayer = ({
  kind = "app",
  label = LABELS[kind],
  routes = ["/api/checkout", "/api/auth", "/api/search"],
  stem = 0,
  ...props
}: IsoIconProps & {
  kind?: IsoLayerKind;
  /** Mono label on the plate, up to about 18 characters. */
  label?: string;
  /** Function routes on a "functions" layer, up to 3. */
  routes?: readonly string[];
  /** Length of the dashed corner guides below the plate, in world units. */
  stem?: number;
}) => {
  const casts: IsoCast[] = [{ box: [AT[0], AT[1], SIZE[0], SIZE[1], SIZE[2]] }];
  const corners: [number, number][] = [
    [AT[0] + INSET, AT[1] + INSET],
    [AT[0] + SIZE[0] - INSET, AT[1] + INSET],
    [AT[0] + SIZE[0] - INSET, AT[1] + SIZE[1] - INSET],
    [AT[0] + INSET, AT[1] + SIZE[1] - INSET],
  ];
  return (
    <IsoIcon casts={casts} {...props}>
      {stem > 0 ? (
        <g
          fill="none"
          strokeDasharray="0.35 0.35"
          style={{
            stroke: "var(--iso-contour)",
            strokeWidth: isoStroke(0.8, 0.1),
          }}
        >
          {corners.map(([x, y]) => (
            <path
              d={`M${project([x, y, 0]).join(",")} L${project([x, y, -stem]).join(",")}`}
              key={`${x},${y}`}
            />
          ))}
        </g>
      ) : null}
      <Part order={0}>
        <Slab
          at={AT}
          content={() => (
            <>
              <text
                fill="var(--iso-text)"
                fontFamily={ISO_MONO}
                fontSize={0.34}
                opacity={0.6}
                x={0.6}
                y={6.6}
              >
                {label}
              </text>
              {kind === "edge" ? <EdgeContent /> : null}
              {kind === "functions" ? (
                <FunctionsContent routes={routes} />
              ) : null}
              {kind === "app" ? <AppContent /> : null}
            </>
          )}
          frontStyle={CLEAR_GLASS}
          radius={0.6}
          size={SIZE}
        />
      </Part>
    </IsoIcon>
  );
};
