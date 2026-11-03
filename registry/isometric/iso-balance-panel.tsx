import { Face, FacePath, IsoIcon, Panel, Part, isoStroke } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// A product panel standing upright: a label, a large amount, a change pill
// and a sparkline with its area. It stands because charts need a vertical
// "up": on a flat panel the 30° fall of the u axis outweighs a rising line
// and growth reads as decline. Everything shown comes from props.
const AT: Vec3 = [-3.5, 0.5, 6.5];
const SIZE = [7, 5.5] as const;
const DEPTH = 0.4;
const CASTS: IsoCast[] = [
  { box: [AT[0], AT[1] - DEPTH, SIZE[0], DEPTH, SIZE[1]], z: AT[2] - SIZE[1] },
];
// Chart box in face units (u across, v down).
const CHART = { bottom: 4.95, height: 2.5, left: 0.55, right: 6.45 };

const chartPoints = (data: readonly number[]) => {
  const min = Math.min(...data);
  const span = Math.max(...data) - min || 1;
  const step = (CHART.right - CHART.left) / Math.max(1, data.length - 1);
  return data.map(
    (value, i) =>
      [
        Math.round((CHART.left + i * step) * 100) / 100,
        Math.round(
          (CHART.bottom - ((value - min) / span) * CHART.height) * 100
        ) / 100,
      ] as const
  );
};

export const IsoBalancePanel = ({
  label = "Savings",
  amount = "$12,480.20",
  delta = "+12.4%",
  data = [3, 4.2, 3.8, 5.1, 4.9, 6.4, 6.1, 7.8],
  ...props
}: IsoIconProps & {
  label?: string;
  amount?: string;
  /** Short change label in the pill. Leave empty to hide the pill. */
  delta?: string;
  /** Values for the sparkline, oldest first. */
  data?: readonly number[];
}) => {
  const pts = chartPoints(data);
  const line = pts
    .map(([u, v], i) => `${i === 0 ? "M" : "L"}${u} ${v}`)
    .join(" ");
  const [endU, endV] = pts.at(-1) ?? [CHART.right, CHART.bottom];
  return (
    <IsoIcon casts={CASTS} {...props}>
      <Part order={0}>
        <Panel
          at={AT}
          content={() => (
            <>
              <text
                fill="var(--iso-text)"
                fontSize={0.4}
                fontWeight={500}
                opacity={0.55}
                x={0.55}
                y={1}
              >
                {label}
              </text>
              <text
                fill="var(--iso-text)"
                fontSize={0.9}
                fontWeight={600}
                letterSpacing={-0.02}
                style={{ fontVariantNumeric: "tabular-nums" }}
                x={0.55}
                y={2.05}
              >
                {amount}
              </text>
              {delta ? (
                <>
                  <rect
                    fill="var(--iso-glow)"
                    height={0.72}
                    rx={0.36}
                    width={1.55}
                    x={4.9}
                    y={0.45}
                  />
                  <text
                    fill="var(--iso-screen)"
                    fontSize={0.34}
                    fontWeight={600}
                    textAnchor="middle"
                    x={5.675}
                    y={0.93}
                  >
                    {delta}
                  </text>
                </>
              ) : null}
              <path
                d={`${line} L${endU} ${CHART.bottom} L${CHART.left} ${CHART.bottom} Z`}
                fill="var(--iso-glow)"
                opacity={0.14}
              />
            </>
          )}
          depth={DEPTH}
          size={SIZE}
        />
      </Part>
      <Part order={1}>
        <FacePath
          at={AT}
          d={line}
          fill="none"
          plane="left"
          stroke="var(--iso-glow)"
          style={{ strokeWidth: isoStroke(1.6, 0.22) }}
        />
        <Face at={AT} plane="left">
          <circle cx={endU} cy={endV} fill="var(--iso-glow)" r={0.2} />
          <circle cx={endU} cy={endV} fill="var(--iso-screen)" r={0.08} />
        </Face>
      </Part>
    </IsoIcon>
  );
};
