import { IsoIcon, Part, Slab } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// A signed-in user chip floating flat: avatar with initials and a live dot,
// name, email and a role badge. Copy comes from props.
const AT: Vec3 = [-3.25, -1.5, 1];
const SIZE: Vec3 = [6.5, 3, 0.3];
const CASTS: IsoCast[] = [
  { box: [AT[0], AT[1], SIZE[0], SIZE[1], SIZE[2]], z: AT[2] },
];

export const IsoSessionCard = ({
  name = "Jane Doe",
  email = "jane@acme.com",
  initials = "JD",
  role = "Admin",
  ...props
}: IsoIconProps & {
  /** Up to about 12 characters. */
  name?: string;
  /** Up to about 18 characters. */
  email?: string;
  /** 1–2 letters. */
  initials?: string;
  /** Up to 6 characters, shown in the badge. Empty hides it. */
  role?: string;
}) => (
  <IsoIcon casts={CASTS} {...props}>
    <Part order={0}>
      <Slab
        at={AT}
        content={(w) => (
          <>
            <circle cx={1.15} cy={1.5} fill="var(--iso-glow)" r={0.62} />
            <text
              fill="var(--iso-screen)"
              fontSize={0.36}
              fontWeight={600}
              textAnchor="middle"
              x={1.15}
              y={1.63}
            >
              {initials}
            </text>
            <circle
              cx={1.6}
              cy={1.95}
              fill="var(--iso-surface-top-c)"
              r={0.2}
            />
            <circle cx={1.6} cy={1.95} fill="var(--iso-glow)" r={0.12} />
            <text
              fill="var(--iso-text)"
              fontSize={0.42}
              fontWeight={600}
              x={2.1}
              y={1.4}
            >
              {name}
            </text>
            <text
              fill="var(--iso-text)"
              fontSize={0.3}
              opacity={0.55}
              x={2.1}
              y={1.9}
            >
              {email}
            </text>
            {role ? (
              <>
                <rect
                  fill="var(--iso-glow)"
                  height={0.55}
                  opacity={0.16}
                  rx={0.275}
                  width={1.25}
                  x={w - 1.75}
                  y={0.45}
                />
                <text
                  fill="var(--iso-glow)"
                  fontSize={0.28}
                  fontWeight={600}
                  textAnchor="middle"
                  x={w - 1.125}
                  y={0.82}
                >
                  {role}
                </text>
              </>
            ) : null}
          </>
        )}
        size={SIZE}
      />
    </Part>
  </IsoIcon>
);
