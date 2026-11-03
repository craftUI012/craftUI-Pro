import { ISO_MONO, IsoIcon, Part, Slab } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// A terminal window floating flat: a neutral frame with window dots and a
// dark inset screen of monospace lines. Lines starting with "$" get a lit
// prompt; lines starting with "✓" are lit as success. Lines come from
// props. Budget: 5 lines of about 29 characters.
const AT: Vec3 = [-3.5, -2.5, 1];
const SIZE: Vec3 = [7, 5, 0.35];
const CASTS: IsoCast[] = [
  { box: [AT[0], AT[1], SIZE[0], SIZE[1], SIZE[2]], z: AT[2] },
];
const LINE = { first: 1.75, gap: 0.62, size: 0.32 };

const lineFill = (line: string) =>
  line.startsWith("✓") ? "var(--iso-glow)" : "var(--iso-screen)";

export const IsoTerminalPanel = ({
  lines = [
    "$ git push origin main",
    "→ Building acme-web",
    "→ Running 3 checks",
    "✓ Live in 24s",
  ],
  ...props
}: IsoIconProps & {
  /** Up to 5 lines of about 29 characters. */
  lines?: readonly string[];
}) => (
  <IsoIcon casts={CASTS} {...props}>
    <Part order={0}>
      <Slab
        at={AT}
        content={(w, d) => (
          <>
            {[0, 1, 2].map((i) => (
              <circle
                cx={0.5 + i * 0.38}
                cy={0.45}
                fill="var(--iso-text)"
                key={i}
                opacity={0.22}
                r={0.12}
              />
            ))}
            <rect
              fill="var(--iso-console)"
              height={d - 1.15}
              rx={0.3}
              width={w - 0.6}
              x={0.3}
              y={0.85}
            />
            {lines.slice(0, 5).map((line, i) => (
              <text
                fill={lineFill(line)}
                fontFamily={ISO_MONO}
                fontSize={LINE.size}
                key={`${i}-${line}`}
                opacity={line.startsWith("→") ? 0.7 : 1}
                x={0.65}
                y={LINE.first + i * LINE.gap}
              >
                {line.startsWith("$") ? (
                  <>
                    <tspan fill="var(--iso-glow)">$</tspan>
                    {line.slice(1)}
                  </>
                ) : (
                  line
                )}
              </text>
            ))}
          </>
        )}
        size={SIZE}
      />
    </Part>
  </IsoIcon>
);
