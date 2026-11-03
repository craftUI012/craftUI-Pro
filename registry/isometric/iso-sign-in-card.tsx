import { ISO_MONO, IsoIcon, Panel, Part } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// A sign-in component standing upright: app mark, heading, a welcome line,
// three social buttons, an "or" divider, a filled email field and the
// primary button. Copy comes from props.
const AT: Vec3 = [-3.5, 0.5, 7.5];
const SIZE = [7, 6.5] as const;
const DEPTH = 0.4;
const CASTS: IsoCast[] = [
  { box: [AT[0], AT[1] - DEPTH, SIZE[0], DEPTH, SIZE[1]], z: AT[2] - SIZE[1] },
];

export const IsoSignInCard = ({
  heading = "Sign in to Acme",
  description = "Welcome back! Please sign in",
  email = "jane@acme.com",
  action = "Continue",
  ...props
}: IsoIconProps & {
  /** Up to about 16 characters. */
  heading?: string;
  /** Up to about 30 characters. */
  description?: string;
  /** Up to about 22 characters. */
  email?: string;
  /** Button label, up to about 12 characters. */
  action?: string;
}) => (
  <IsoIcon casts={CASTS} {...props}>
    <Part order={0}>
      <Panel
        at={AT}
        content={(w) => (
          <>
            <rect
              fill="var(--iso-glow)"
              height={0.8}
              rx={0.24}
              width={0.8}
              x={0.55}
              y={0.55}
            />
            <circle cx={0.95} cy={0.95} fill="var(--iso-screen)" r={0.18} />
            <text
              fill="var(--iso-text)"
              fontSize={0.46}
              fontWeight={600}
              x={0.55}
              y={2.05}
            >
              {heading}
            </text>
            <text
              fill="var(--iso-text)"
              fontSize={0.3}
              opacity={0.55}
              x={0.55}
              y={2.55}
            >
              {description}
            </text>
            {[0, 1, 2].map((i) => (
              <g key={i}>
                <rect
                  fill="var(--iso-text)"
                  height={0.65}
                  opacity={0.07}
                  rx={0.18}
                  width={1.8}
                  x={0.55 + i * 2.05}
                  y={2.95}
                />
                <circle
                  cx={1.45 + i * 2.05}
                  cy={3.275}
                  fill="var(--iso-text)"
                  opacity={0.5}
                  r={0.14}
                />
              </g>
            ))}
            <rect
              fill="var(--iso-text)"
              height={0.03}
              opacity={0.14}
              width={2.6}
              x={0.55}
              y={4.02}
            />
            <rect
              fill="var(--iso-text)"
              height={0.03}
              opacity={0.14}
              width={2.6}
              x={w - 3.15}
              y={4.02}
            />
            <text
              fill="var(--iso-text)"
              fontSize={0.26}
              opacity={0.5}
              textAnchor="middle"
              x={w / 2}
              y={4.12}
            >
              or
            </text>
            <rect
              fill="var(--iso-screen)"
              height={0.65}
              rx={0.18}
              stroke="var(--iso-text)"
              strokeOpacity={0.16}
              strokeWidth={0.05}
              width={w - 1.1}
              x={0.55}
              y={4.35}
            />
            <text
              fill="var(--iso-screen-ink)"
              fontFamily={ISO_MONO}
              fontSize={0.3}
              x={0.8}
              y={4.78}
            >
              {email}
            </text>
            <rect
              fill="var(--iso-glow)"
              height={0.7}
              rx={0.18}
              width={w - 1.1}
              x={0.55}
              y={5.3}
            />
            <text
              fill="var(--iso-screen)"
              fontSize={0.34}
              fontWeight={600}
              textAnchor="middle"
              x={w / 2}
              y={5.77}
            >
              {action}
            </text>
          </>
        )}
        depth={DEPTH}
        size={SIZE}
      />
    </Part>
  </IsoIcon>
);
