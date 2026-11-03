import { IsoIcon, Part, Slab } from "./iso-core";
import type { IsoCast, IsoIconProps, Vec3 } from "./iso-core";

// A verification-code card floating flat: heading, where the code was sent,
// six digit boxes (the next empty box carries a lit caret) and a resend
// timer. Digits come from props; fewer than six leaves boxes empty.
const AT: Vec3 = [-3.5, -2, 1];
const SIZE: Vec3 = [7, 4, 0.3];
const CASTS: IsoCast[] = [
  { box: [AT[0], AT[1], SIZE[0], SIZE[1], SIZE[2]], z: AT[2] },
];
const BOX = { gap: 0.17, h: 1.05, top: 1.85, w: 0.85 };

export const IsoOtpCard = ({
  heading = "Verification code",
  description = "Sent to jane@acme.com",
  code = "48192",
  note = "Resend in 0:24",
  ...props
}: IsoIconProps & {
  /** Up to about 20 characters. */
  heading?: string;
  /** Up to about 34 characters. */
  description?: string;
  /** Up to 6 digits entered so far. */
  code?: string;
  note?: string;
}) => (
  <IsoIcon casts={CASTS} {...props}>
    <Part order={0}>
      <Slab
        at={AT}
        content={() => (
          <>
            <text
              fill="var(--iso-text)"
              fontSize={0.4}
              fontWeight={600}
              x={0.55}
              y={0.95}
            >
              {heading}
            </text>
            <text
              fill="var(--iso-text)"
              fontSize={0.28}
              opacity={0.55}
              x={0.55}
              y={1.45}
            >
              {description}
            </text>
            {Array.from({ length: 6 }, (_, i) => {
              const x = 0.55 + i * (BOX.w + BOX.gap);
              const digit = code[i];
              const caret = i === code.length;
              return (
                <g key={i}>
                  <rect
                    fill="var(--iso-screen)"
                    height={BOX.h}
                    rx={0.18}
                    stroke={caret ? "var(--iso-glow)" : "var(--iso-text)"}
                    strokeOpacity={caret ? 1 : 0.16}
                    strokeWidth={0.05}
                    width={BOX.w}
                    x={x}
                    y={BOX.top}
                  />
                  {digit ? (
                    <text
                      fill="var(--iso-screen-ink)"
                      fontSize={0.5}
                      fontWeight={600}
                      style={{ fontVariantNumeric: "tabular-nums" }}
                      textAnchor="middle"
                      x={x + BOX.w / 2}
                      y={BOX.top + 0.7}
                    >
                      {digit}
                    </text>
                  ) : null}
                  {caret ? (
                    <rect
                      fill="var(--iso-glow)"
                      height={0.5}
                      width={0.05}
                      x={x + BOX.w / 2 - 0.025}
                      y={BOX.top + 0.28}
                    />
                  ) : null}
                </g>
              );
            })}
            <text
              fill="var(--iso-text)"
              fontSize={0.28}
              opacity={0.55}
              x={0.55}
              y={3.45}
            >
              {note}
            </text>
          </>
        )}
        size={SIZE}
      />
    </Part>
  </IsoIcon>
);
