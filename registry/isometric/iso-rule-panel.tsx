import { GLASS, IsoIcon, Part, Slab } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// A frosted automation panel floating flat: an icon chip, a heading, a
// one-line description and a list of rules with on/off toggles. Rules come
// from props. It lies flat (text and toggles read well on a top face); the
// balance panel stands, because charts need a vertical "up".
const AT: Vec3 = [-3.5, -2.75, 1];
const SIZE: Vec3 = [7, 5.5, 0.35];
const CASTS: IsoCast[] = [
  { box: [AT[0], AT[1], SIZE[0], SIZE[1], SIZE[2]], z: AT[2] },
];
const ROW = { gap: 1.25, top: 2.75 };

export interface IsoRule {
  label: string;
  on: boolean;
}

export const IsoRulePanel = ({
  heading = "Auto-save",
  description = "Runs on every payment",
  rules = [
    { label: "Round up purchases", on: true },
    { label: "Save 10% of income", on: true },
  ],
  ...props
}: IsoIconProps & {
  /** Panel heading. (`title` stays the accessible name, as on every icon.) */
  heading?: string;
  description?: string;
  /** Up to two rules fit. */
  rules?: readonly IsoRule[];
}) => (
  <IsoIcon casts={CASTS} {...props}>
    <Part order={0}>
      <Slab
        at={AT}
        content={(w) => (
          <>
            <rect
              fill="var(--iso-glow)"
              height={0.8}
              rx={0.22}
              width={0.8}
              x={0.55}
              y={0.55}
            />
            <circle cx={0.95} cy={0.95} fill="var(--iso-screen)" r={0.16} />
            <text
              fill="var(--iso-text)"
              fontSize={0.5}
              fontWeight={600}
              x={1.65}
              y={1.13}
            >
              {heading}
            </text>
            <text
              fill="var(--iso-text)"
              fontSize={0.34}
              opacity={0.55}
              x={0.55}
              y={2}
            >
              {description}
            </text>
            <rect
              fill="var(--iso-text)"
              height={0.03}
              opacity={0.14}
              width={w - 1.1}
              x={0.55}
              y={2.4}
            />
            {rules.slice(0, 2).map((rule, i) => {
              const y = ROW.top + i * ROW.gap;
              return (
                <g key={rule.label}>
                  <text
                    fill="var(--iso-text)"
                    fontSize={0.38}
                    fontWeight={500}
                    x={0.55}
                    y={y + 0.66}
                  >
                    {rule.label}
                  </text>
                  <rect
                    fill={rule.on ? "var(--iso-glow)" : "var(--iso-text)"}
                    height={0.7}
                    opacity={rule.on ? 1 : 0.18}
                    rx={0.35}
                    width={1.3}
                    x={w - 1.85}
                    y={y + 0.2}
                  />
                  <circle
                    cx={rule.on ? w - 0.9 : w - 1.5}
                    cy={y + 0.55}
                    fill="var(--iso-screen)"
                    r={0.27}
                  />
                </g>
              );
            })}
          </>
        )}
        frontStyle={GLASS}
        size={SIZE}
      />
    </Part>
  </IsoIcon>
);
