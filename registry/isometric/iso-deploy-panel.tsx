import { ISO_MONO, IsoIcon, Panel, Part } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// A deployment card standing upright: project name and a status pill, the
// live URL, three detail rows (label left, mono value right) and a finished
// progress bar. Standing reads most upright for a status card. Everything
// shown comes from props.
const AT: Vec3 = [-3.5, 0.5, 6.5];
const SIZE = [7, 5.5] as const;
const DEPTH = 0.4;
const CASTS: IsoCast[] = [
  { box: [AT[0], AT[1] - DEPTH, SIZE[0], DEPTH, SIZE[1]], z: AT[2] - SIZE[1] },
];
const ROW = { first: 2.75, gap: 0.68 };

export interface IsoDetailRow {
  label: string;
  value: string;
}

export const IsoDeployPanel = ({
  project = "acme-web",
  status = "Ready",
  url = "acme-web.app",
  rows = [
    { label: "Build", value: "24s" },
    { label: "Regions", value: "iad1 · fra1" },
    { label: "Checks", value: "3 passed" },
  ],
  ...props
}: IsoIconProps & {
  /** Up to about 14 characters. */
  project?: string;
  /** Up to 6 characters, shown in the pill. */
  status?: string;
  /** Up to about 26 characters. */
  url?: string;
  /** Up to 3 rows. */
  rows?: readonly IsoDetailRow[];
}) => (
  <IsoIcon casts={CASTS} {...props}>
    <Part order={0}>
      <Panel
        at={AT}
        content={(w, h) => (
          <>
            <rect
              fill="var(--iso-text)"
              height={0.75}
              rx={0.2}
              width={0.75}
              x={0.55}
              y={0.5}
            />
            <path
              d="M0.925 0.68 L1.15 1.08 L0.7 1.08 Z"
              fill="var(--iso-screen)"
            />
            <text
              fill="var(--iso-text)"
              fontSize={0.46}
              fontWeight={600}
              x={1.55}
              y={1.05}
            >
              {project}
            </text>
            <rect
              fill="var(--iso-glow)"
              height={0.62}
              rx={0.31}
              width={1.45}
              x={w - 2}
              y={0.56}
            />
            <circle cx={w - 1.72} cy={0.87} fill="var(--iso-screen)" r={0.09} />
            <text
              fill="var(--iso-screen)"
              fontSize={0.3}
              fontWeight={600}
              x={w - 1.55}
              y={0.98}
            >
              {status}
            </text>
            <text
              fill="var(--iso-text)"
              fontFamily={ISO_MONO}
              fontSize={0.32}
              opacity={0.55}
              x={0.55}
              y={1.85}
            >
              {url}
            </text>
            <rect
              fill="var(--iso-text)"
              height={0.03}
              opacity={0.14}
              width={w - 1.1}
              x={0.55}
              y={2.2}
            />
            {rows.slice(0, 3).map((row, i) => (
              <g key={row.label}>
                <text
                  fill="var(--iso-text)"
                  fontSize={0.32}
                  opacity={0.55}
                  x={0.55}
                  y={ROW.first + i * ROW.gap}
                >
                  {row.label}
                </text>
                <text
                  fill="var(--iso-text)"
                  fontFamily={ISO_MONO}
                  fontSize={0.32}
                  textAnchor="end"
                  x={w - 0.55}
                  y={ROW.first + i * ROW.gap}
                >
                  {row.value}
                </text>
              </g>
            ))}
            <rect
              fill="var(--iso-text)"
              height={0.2}
              opacity={0.12}
              rx={0.1}
              width={w - 1.1}
              x={0.55}
              y={h - 0.75}
            />
            <rect
              fill="var(--iso-glow)"
              height={0.2}
              rx={0.1}
              width={w - 1.1}
              x={0.55}
              y={h - 0.75}
            />
          </>
        )}
        depth={DEPTH}
        size={SIZE}
      />
    </Part>
  </IsoIcon>
);
