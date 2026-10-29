/* oxlint-disable nextjs/no-img-element -- a registry section can't assume next/image is set up for the user's image host */
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { useId } from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ── Colour ────────────────────────────────────────────────────────────────
 * A fixed light palette, set on the section's root so a className or style
 * can swap it: a cool canvas, white surfaces, near-black ink. The icon
 * plates carry the only colour, one tone each. */
const PALETTE = {
  "--fs4-canvas": "#FAFAFC",
  "--fs4-ink": "#0F1222",
  "--fs4-ink-muted": "#565B6E",
  "--fs4-ink-soft": "rgb(15 18 34 / 0.6)",
  "--fs4-surface": "#FFFFFF",
} as CSSProperties;

/* Surfaces have no border: a 1px shadow ring plus two soft lift layers. The
 * transparent border is what forced-colours mode paints instead. */
const RING_LIFT =
  "border border-transparent shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.06),0_2px_4px_0_rgb(0_0_0/0.04)]";

/* ── Icon plates ───────────────────────────────────────────────────────────
 * A single-tone plate: a top-to-bottom gradient, a faint guilloché
 * engraving, a 1px edge in the tone's dark and a 2px inner highlight. */
const TONES = {
  blue: "from-[#8FA8F7] to-[#4F78F0] [--fs4-edge:rgb(30_46_134/0.38)]",
  orange: "from-[#F1C485] to-[#E3A043] [--fs4-edge:rgb(138_61_18/0.38)]",
  violet: "from-[#A99CF5] to-[#7A68EE] [--fs4-edge:rgb(46_42_143/0.38)]",
} as const;

/* The engraving: two bands of three braided strands, each a circle with a
 * sine wave along it, the strands a third of a wave apart. */
const strand = (
  radius: number,
  amplitude: number,
  waves: number,
  phase: number
) => {
  const points: string[] = [];
  for (let step = 0; step <= 360; step += 2) {
    const angle = (step * Math.PI) / 180;
    const r = radius + amplitude * Math.sin(waves * angle + phase);
    points.push(
      `${(52 + r * Math.cos(angle)).toFixed(2)} ${(52 + r * Math.sin(angle)).toFixed(2)}`
    );
  }
  return `M${points.join("L")}Z`;
};

const GUILLOCHE = [
  { amplitude: 3.5, radius: 29, waves: 18 },
  { amplitude: 3.5, radius: 42, waves: 24 },
].flatMap((band) =>
  [0, 1, 2].map((index) =>
    strand(band.radius, band.amplitude, band.waves, (index * 2 * Math.PI) / 3)
  )
);

const Guilloche = () => (
  <svg
    aria-hidden="true"
    className="pointer-events-none absolute -inset-px size-[calc(100%+2px)]"
    fill="none"
    height="104"
    viewBox="0 0 104 104"
    width="104"
  >
    {GUILLOCHE.map((d) => (
      <path
        d={d}
        key={d}
        stroke="white"
        strokeOpacity="0.16"
        strokeWidth="0.4"
      />
    ))}
  </svg>
);

const IconPlate = ({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone: keyof typeof TONES;
}) => (
  <span
    className={cn(
      "relative grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-linear-to-b text-white shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_1px_2px_-1px_rgb(0_0_0/0.06),0_2px_4px_0_rgb(0_0_0/0.04)]",
      TONES[tone],
      className
    )}
  >
    <Guilloche />
    <span className="relative w-[44%] [&>svg]:h-auto [&>svg]:w-full">
      {children}
    </span>
    <span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_var(--fs4-edge),inset_0_0_0_3px_rgb(255_255_255/0.45)]"
    />
  </span>
);

/* ── Glyphs ────────────────────────────────────────────────────────────────
 * White line glyphs for the plates, drawn in currentColor. */

interface GlyphProps {
  className?: string;
}

/** A fingerprint inside a scan frame: biometric unlock. */
export const FeatureFingerprintGlyph = ({ className }: GlyphProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="45.5"
    viewBox="0 0 45.5 45.5"
    width="45.5"
  >
    <path
      d="M5.6875 14.2188V9.95312C5.6875 7.53594 7.53594 5.6875 9.95312 5.6875H14.2188M31.2812 5.6875H35.5469C37.9641 5.6875 39.8125 7.53594 39.8125 9.95312V14.2188M39.8125 31.2812V35.5469C39.8125 37.9641 37.9641 39.8125 35.5469 39.8125H31.2812M14.2188 39.8125H9.95312C7.53594 39.8125 5.6875 37.9641 5.6875 35.5469V31.2812"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M15.6406 29.8594V23.4609C15.6406 19.4797 18.7687 16.3516 22.75 16.3516C26.7312 16.3516 29.8594 19.4797 29.8594 23.4609V25.5938"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M19.3375 32.7031V23.4609C19.3375 21.6125 20.9016 20.0484 22.75 20.0484C24.5984 20.0484 26.1625 21.6125 26.1625 23.4609V30.5703"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M22.75 23.4609V33.4141"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
  </svg>
);

/** A person beside a key: signing with a passkey. */
export const FeaturePasskeyGlyph = ({ className }: GlyphProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="45.5"
    viewBox="0 0 45.5 45.5"
    width="45.5"
  >
    <path
      d="M22.75 14.2188C22.75 17.7525 19.8853 20.6172 16.3516 20.6172C12.8178 20.6172 9.95312 17.7525 9.95312 14.2188C9.95312 10.685 12.8178 7.82031 16.3516 7.82031C19.8853 7.82031 22.75 10.685 22.75 14.2188Z"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M6.39844 37.6797C6.39844 31.85 11.2328 27.0156 17.0625 27.0156H19.1953"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M37.1109 22.0391C37.1109 24.8661 34.8192 27.1578 31.9922 27.1578C29.1652 27.1578 26.8734 24.8661 26.8734 22.0391C26.8734 19.2121 29.1652 16.9203 31.9922 16.9203C34.8192 16.9203 37.1109 19.2121 37.1109 22.0391Z"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M31.9922 27.1578V32.7031M31.9922 32.7031V36.9687M31.9922 32.7031H35.5469M31.9922 36.9687V39.1016M31.9922 36.9687H34.9781"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
  </svg>
);

/** A wallet with a coin in its pocket: a smart contract wallet. */
export const FeatureWalletGlyph = ({ className }: GlyphProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="47.67"
    viewBox="0 0 47.6667 47.6667"
    width="47.67"
  >
    <path
      d="M11.1719 14.151L30.5365 8.34167C32.7708 7.74583 35.0052 9.38438 35.0052 11.7677V14.151"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M12.6615 14.151H35.0052C38.2959 14.151 40.9635 16.8187 40.9635 20.1094V33.5156C40.9635 36.8063 38.2959 39.474 35.0052 39.474H12.6615C9.37076 39.474 6.70312 36.8063 6.70312 33.5156V20.1094C6.70312 16.8187 9.37076 14.151 12.6615 14.151Z"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M40.9635 21.599H33.9625C31.7281 21.599 29.7917 23.5354 29.7917 25.7698V26.3656C29.7917 28.6 31.7281 30.5365 33.9625 30.5365H40.9635"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M34.8562 23.5354L37.2396 24.876V27.5573L34.8562 28.8979L32.4729 27.5573V24.876L34.8562 23.5354Z"
      fill="currentColor"
    />
  </svg>
);

/** A key inside a circular arrow: recovering an account. */
export const FeatureRecoveryGlyph = ({ className }: GlyphProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="38.5"
    viewBox="0 0 38.5 38.5"
    width="38.5"
  >
    <path
      d="M31.8828 19.25C31.8828 26.2281 26.2281 31.8828 19.25 31.8828C12.2719 31.8828 6.61719 26.2281 6.61719 19.25C6.61719 12.2719 12.2719 6.61719 19.25 6.61719C23.1 6.61719 26.4688 8.30156 28.7547 10.9484"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M29.4766 5.29375V11.55H23.2203"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M18.6484 19.25C18.6484 21.0441 17.1941 22.4984 15.4 22.4984C13.6059 22.4984 12.1516 21.0441 12.1516 19.25C12.1516 17.4559 13.6059 16.0016 15.4 16.0016C17.1941 16.0016 18.6484 17.4559 18.6484 19.25Z"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M18.6484 19.25H22.8594M22.8594 19.25H25.2656V21.2953M22.8594 19.25V22.1375"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
  </svg>
);

/** A hardware key with a lock on it: cold storage. */
export const FeatureHardwareKeyGlyph = ({ className }: GlyphProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="38.5"
    viewBox="0 0 38.5 38.5"
    width="38.5"
  >
    <path
      d="M15.6406 4.21094H22.8594C25.5172 4.21094 27.6719 6.36557 27.6719 9.02344V19.8516C27.6719 22.5094 25.5172 24.6641 22.8594 24.6641H15.6406C12.9828 24.6641 10.8281 22.5094 10.8281 19.8516V9.02344C10.8281 6.36557 12.9828 4.21094 15.6406 4.21094Z"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M16.9641 24.6641H21.5359C22.5991 24.6641 23.4609 25.5259 23.4609 26.5891V29.3562C23.4609 30.4194 22.5991 31.2812 21.5359 31.2812H16.9641C15.9009 31.2812 15.0391 30.4194 15.0391 29.3562V26.5891C15.0391 25.5259 15.9009 24.6641 16.9641 24.6641Z"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M16.3625 14.4375V12.7531C16.3625 11.1891 17.6859 9.86562 19.25 9.86562C20.8141 9.86562 22.1375 11.1891 22.1375 12.7531V14.4375"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke="currentColor"
    />
    <path
      d="M21.6563 14.4375H16.8437C15.9135 14.4375 15.1594 15.1916 15.1594 16.1219V18.7688C15.1594 19.699 15.9135 20.4531 16.8437 20.4531H21.6563C22.5865 20.4531 23.3406 19.699 23.3406 18.7688V16.1219C23.3406 15.1916 22.5865 14.4375 21.6563 14.4375Z"
      fill="currentColor"
    />
  </svg>
);

/* ── The phone ─────────────────────────────────────────────────────────────
 * A realistic phone in one SVG, so it scales with the panel: a titanium
 * frame and side buttons, a black bezel, the Dynamic Island, and a wallet's
 * setup screen with two ways to sign, the first one selected. */

const TITANIUM = [
  ["0", "#A39F98"],
  ["0.06", "#E8E5E0"],
  ["0.16", "#B7B3AC"],
  ["0.5", "#D2CFC9"],
  ["0.84", "#B3AFA8"],
  ["0.94", "#ECE9E4"],
  ["1", "#9C9891"],
] as const;

const SIDE_BUTTONS = [
  { height: 33.12, x: -2.76, y: 174.8 },
  { height: 58.88, x: -2.76, y: 241.04 },
  { height: 58.88, x: -2.76, y: 314.64 },
  { height: 95.68, x: 434.24, y: 268.64 },
  { height: 53.36, x: 434.24, y: 563.04 },
];

/* The screen's copy, line by line (an SVG doesn't wrap text). */
const SETUP_OPTIONS = [
  {
    body: [
      "Sign transactions with a biometrically secured",
      "passkey stored in your iCloud Keychain, which you",
      "can recover if you lose access.",
    ],
    height: 185.84,
    selected: true,
    title: "Passkey + Face ID",
    y: 251.16,
  },
  {
    body: [
      "Sign transactions with your hardware wallet over",
      "Bluetooth. More secure, but not recoverable if you",
      "lose the device or its private key.",
    ],
    height: 182.16,
    selected: false,
    title: "Hardware wallet",
    y: 448.04,
  },
];

/** A phone showing a wallet's setup screen: choose to sign with a passkey and Face ID, or a hardware wallet. */
export const FeatureWalletPhone = ({ className }: GlyphProps) => {
  const id = useId().replaceAll(":", "");
  const ids = {
    button: `fs4-button-${id}`,
    glare: `fs4-glare-${id}`,
    screen: `fs4-screen-${id}`,
    screenClip: `fs4-screen-clip-${id}`,
    titanium: `fs4-titanium-${id}`,
  };
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="902"
      viewBox="-4 0 446 902"
      width="446"
    >
      <defs>
        <linearGradient id={ids.titanium} x1="0" x2="1" y1="0" y2="0">
          {TITANIUM.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        <linearGradient id={ids.button} x1="0" x2="0" y1="0" y2="1">
          {TITANIUM.map(([offset, color]) => (
            <stop key={offset} offset={offset} stopColor={color} />
          ))}
        </linearGradient>
        <linearGradient id={ids.screen} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor="#ECEEF3" />
          <stop offset="0.35" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#F6F6F8" />
        </linearGradient>
        <linearGradient id={ids.glare} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0.07" stopColor="#FFFFFF" stopOpacity="0.1" />
          <stop offset="0.5" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <clipPath id={ids.screenClip}>
          <rect height="875.84" rx="54" width="410.32" />
        </clipPath>
      </defs>

      {/* side buttons, then the frame and bezel */}
      {SIDE_BUTTONS.map((button) => (
        <rect
          fill={`url(#${ids.button})`}
          height={button.height}
          key={button.y}
          rx="2"
          width="4.6"
          x={button.x}
          y={button.y}
        />
      ))}
      <rect
        fill={`url(#${ids.titanium})`}
        height="901.6"
        rx="68"
        stroke="rgb(0 0 0 / 0.28)"
        strokeWidth="0.92"
        width="436.08"
      />
      <rect
        height="899.76"
        rx="67"
        stroke="rgb(255 255 255 / 0.55)"
        strokeWidth="0.92"
        width="434.24"
        x="0.92"
        y="0.92"
      />
      <rect
        fill="#0A0A0B"
        height="894.24"
        rx="64"
        width="428.72"
        x="3.68"
        y="3.68"
      />

      {/* the screen */}
      <g className="font-sans" transform="translate(12.88 12.88)">
        <g clipPath={`url(#${ids.screenClip})`}>
          <rect fill={`url(#${ids.screen})`} height="875.84" width="410.32" />
          <text
            fill="#111111"
            fontSize="16.56"
            fontWeight="600"
            x="47.84"
            y="30"
          >
            9:41
          </text>
          <g transform="translate(283.36 20.24)">
            <path
              d="M1.84 8.28H0.92C0.411898 8.28 0 8.6919 0 9.2V11.04C0 11.5481 0.411898 11.96 0.92 11.96H1.84C2.3481 11.96 2.76 11.5481 2.76 11.04V9.2C2.76 8.6919 2.3481 8.28 1.84 8.28Z"
              fill="#111111"
            />
            <path
              d="M6.44 5.98H5.52C5.0119 5.98 4.6 6.3919 4.6 6.9V11.04C4.6 11.5481 5.0119 11.96 5.52 11.96H6.44C6.9481 11.96 7.36 11.5481 7.36 11.04V6.9C7.36 6.3919 6.9481 5.98 6.44 5.98Z"
              fill="#111111"
            />
            <path
              d="M11.04 3.68H10.12C9.6119 3.68 9.2 4.0919 9.2 4.6V11.04C9.2 11.5481 9.6119 11.96 10.12 11.96H11.04C11.5481 11.96 11.96 11.5481 11.96 11.04V4.6C11.96 4.0919 11.5481 3.68 11.04 3.68Z"
              fill="#111111"
            />
            <path
              d="M15.64 1.38H14.72C14.2119 1.38 13.8 1.7919 13.8 2.3V11.04C13.8 11.5481 14.2119 11.96 14.72 11.96H15.64C16.1481 11.96 16.56 11.5481 16.56 11.04V2.3C16.56 1.7919 16.1481 1.38 15.64 1.38Z"
              fill="#111111"
            />
            <path
              d="M25.76 4.14C27.6334 2.39391 30.0991 1.423 32.66 1.423C35.2209 1.423 37.6866 2.39391 39.56 4.14M28.06 6.716C28.6596 6.10402 29.3753 5.61784 30.1652 5.28593C30.9551 4.95402 31.8032 4.78306 32.66 4.78306C33.5168 4.78306 34.3649 4.95402 35.1548 5.28593C35.9447 5.61784 36.6604 6.10402 37.26 6.716M30.544 9.2C30.8031 8.89067 31.1268 8.64189 31.4924 8.4712C31.858 8.30051 32.2565 8.21205 32.66 8.21205C33.0635 8.21205 33.462 8.30051 33.8276 8.4712C34.1932 8.64189 34.5169 8.89067 34.776 9.2"
              strokeWidth="1.656"
              strokeLinecap="round"
              stroke="#111111"
            />
            <path
              d="M32.66 12.236C33.3205 12.236 33.856 11.7005 33.856 11.04C33.856 10.3795 33.3205 9.844 32.66 9.844C31.9995 9.844 31.464 10.3795 31.464 11.04C31.464 11.7005 31.9995 12.236 32.66 12.236Z"
              fill="#111111"
            />
            <path
              d="M71.3 1.84H54.74C52.9616 1.84 51.52 3.28164 51.52 5.06V8.74C51.52 10.5184 52.9616 11.96 54.74 11.96H71.3C73.0784 11.96 74.52 10.5184 74.52 8.74V5.06C74.52 3.28164 73.0784 1.84 71.3 1.84Z"
              fill="#111111"
            />
            <path
              opacity="0.5"
              d="M77.372 5.796C77.372 5.38952 77.0425 5.06 76.636 5.06C76.2295 5.06 75.9 5.38952 75.9 5.796V8.004C75.9 8.41048 76.2295 8.74 76.636 8.74C77.0425 8.74 77.372 8.41048 77.372 8.004V5.796Z"
              fill="#111111"
            />
          </g>
          <rect
            fill="#000000"
            height="33.12"
            rx="16.56"
            width="112.24"
            x="149.04"
            y="10.12"
          />
          <g transform="translate(44.16 81.88)">
            <path
              d="M8.28 1.84L2.76 8.28L8.28 14.72"
              strokeWidth="1.84"
              strokeLinecap="round"
              strokeLinejoin="round"
              stroke="#111111"
            />
          </g>
          <text
            fill="#111111"
            fontSize="20.24"
            fontWeight="600"
            letterSpacing="-0.02em"
            x="45.08"
            y="152"
          >
            Set up your wallet
          </text>
          <g fill="#6B6B6B" fontSize="14.72" letterSpacing="-0.01em">
            <text x="45.08" y="184">
              Choose how you want to approve transactions
            </text>
            <text x="45.08" y="203.3">
              in Kestrel.
            </text>
          </g>
          {SETUP_OPTIONS.map((option) => (
            <g key={option.title} transform={`translate(26.68 ${option.y})`}>
              {option.selected && (
                <rect
                  height={option.height + 5}
                  rx="20.5"
                  stroke="rgb(79 120 240 / 0.12)"
                  strokeWidth="5"
                  width="361.96"
                  x="-2.5"
                  y="-2.5"
                />
              )}
              <rect
                fill="#FFFFFF"
                height={option.height}
                rx="18"
                stroke={option.selected ? "#4F78F0" : "rgb(0 0 0 / 0.06)"}
                strokeWidth={option.selected ? 1.5 : 1}
                width="356.96"
              />
              <g transform="translate(18.4 18.4)">
                {option.selected ? (
                  <>
                    <path
                      d="M1.84 11.04V5.52C1.84 4.544 2.22771 3.60798 2.91785 2.91785C3.60798 2.22771 4.544 1.84 5.52 1.84H11.04M29.44 1.84H34.96C35.936 1.84 36.872 2.22771 37.5621 2.91785C38.2523 3.60798 38.64 4.544 38.64 5.52V11.04M38.64 29.44V34.96C38.64 35.936 38.2523 36.872 37.5621 37.5621C36.872 38.2523 35.936 38.64 34.96 38.64H29.44M11.04 38.64H5.52C4.544 38.64 3.60798 38.2523 2.91785 37.5621C2.22771 36.872 1.84 35.936 1.84 34.96V29.44"
                      strokeWidth="2.208"
                      strokeLinecap="round"
                      stroke="#4F78F0"
                    />
                    <path
                      d="M12.88 13.8V17.48M27.6 13.8V17.48M20.24 13.8V22.08H18.4M13.34 27.14C17.02 30.084 23.46 30.084 27.14 27.14"
                      strokeWidth="2.208"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      stroke="#4F78F0"
                    />
                  </>
                ) : (
                  <>
                    <path
                      d="M2.76 27.6L23 6.9C23.5128 6.38539 24.1222 5.97707 24.7932 5.69847C25.4641 5.41986 26.1835 5.27645 26.91 5.27645C27.6365 5.27645 28.3559 5.41986 29.0268 5.69847C29.6978 5.97707 30.3072 6.38539 30.82 6.9L32.66 8.74C33.1746 9.25283 33.5829 9.8622 33.8615 10.5332C34.1401 11.2041 34.2836 11.9235 34.2836 12.65C34.2836 13.3765 34.1401 14.0959 33.8615 14.7668C33.5829 15.4378 33.1746 16.0472 32.66 16.56L13.8 36.8H2.76V27.6Z"
                      strokeWidth="2.208"
                      strokeLinejoin="round"
                      stroke="#7A68EE"
                    />
                    <path
                      d="M2.76 27.6H21.62V36.8"
                      strokeWidth="2.208"
                      strokeLinejoin="round"
                      stroke="#7A68EE"
                    />
                    <path
                      d="M10.304 32.2C10.304 33.3178 9.39783 34.224 8.28 34.224C7.16218 34.224 6.256 33.3178 6.256 32.2C6.256 31.0822 7.16218 30.176 8.28 30.176C9.39783 30.176 10.304 31.0822 10.304 32.2Z"
                      strokeWidth="1.656"
                      stroke="#7A68EE"
                    />
                    <path
                      d="M16.744 32.2C16.744 33.3178 15.8378 34.224 14.72 34.224C13.6022 34.224 12.696 33.3178 12.696 32.2C12.696 31.0822 13.6022 30.176 14.72 30.176C15.8378 30.176 16.744 31.0822 16.744 32.2Z"
                      strokeWidth="1.656"
                      stroke="#7A68EE"
                    />
                    <path
                      d="M29.9 11.96C29.9 13.2303 28.8703 14.26 27.6 14.26C26.3297 14.26 25.3 13.2303 25.3 11.96C25.3 10.6897 26.3297 9.66 27.6 9.66C28.8703 9.66 29.9 10.6897 29.9 11.96Z"
                      strokeWidth="1.656"
                      stroke="#7A68EE"
                    />
                  </>
                )}
              </g>
              <text
                fill="#111111"
                fontSize="14.4"
                fontWeight="600"
                letterSpacing="-0.02em"
                x="18.4"
                y="90"
              >
                {option.title}
              </text>
              <g fill="#6B6B6B" fontSize="12.88" letterSpacing="-0.01em">
                {option.body.map((line, index) => (
                  <text key={line} x="18.4" y={120.5 + index * 19.32}>
                    {line}
                  </text>
                ))}
              </g>
            </g>
          ))}
          <rect fill={`url(#${ids.glare})`} height="394.13" width="410.32" />
        </g>
      </g>
    </svg>
  );
};

/* ── Content ───────────────────────────────────────────────────────────── */

export interface FeatureSection04Item {
  /** Unique id: the list keys on it. */
  id: string;
  /** The feature's title, a few words: "Biometric authentication". */
  title: string;
  /** One or two short sentences under the title. */
  description: string;
  /** The glyph on the feature's plate, drawn in white (`currentColor`). Use `FeatureFingerprintGlyph`, `FeaturePasskeyGlyph`, `FeatureWalletGlyph`, `FeatureRecoveryGlyph` or `FeatureHardwareKeyGlyph` from this file, or any square line icon. */
  icon: ReactNode;
  /** The plate's colour: "orange", "blue" or "violet". */
  tone: keyof typeof TONES;
  /** The tile's height in its column: "tall" and "medium" stack the plate above the text, "short" sets it beside the text. Defaults to "medium". */
  size?: "tall" | "medium" | "short";
}

const FEATURES: FeatureSection04Item[] = [
  {
    description: "Face ID or Touch ID unlocks your wallet. Only you can sign.",
    icon: <FeatureFingerprintGlyph />,
    id: "biometrics",
    size: "tall",
    title: "Biometric authentication",
    tone: "orange",
  },
  {
    description: "Approve every transaction with a passkey.",
    icon: <FeaturePasskeyGlyph />,
    id: "passkeys",
    title: "Passkey-based signing",
    tone: "blue",
  },
  {
    description: "Lost your phone? Restore from your iCloud Keychain.",
    icon: <FeatureRecoveryGlyph />,
    id: "recovery",
    size: "short",
    title: "Account recovery",
    tone: "blue",
  },
  {
    description: "A smart contract wallet with programmable security.",
    icon: <FeatureWalletGlyph />,
    id: "smart-wallets",
    title: "Onchain smart wallets",
    tone: "violet",
  },
  {
    description:
      "Pair a hardware wallet over Bluetooth for cold\u2011storage security.",
    icon: <FeatureHardwareKeyGlyph />,
    id: "hardware",
    size: "short",
    title: "Hardware support",
    tone: "violet",
  },
];

/* Each size's share of its column's height on tablets and desktops, in
 * Figma's proportions (short 180, medium 280, tall 387). */
const TILE_GROW = {
  medium: "md:flex-[1.57_1_0%]",
  short: "md:flex-[1_1_0%]",
  tall: "md:flex-[2.15_1_0%]",
} as const;

const DEFAULT_IMAGE =
  "https://pub-52b0d9cec7c64f638ba3f33a29718fa6.r2.dev/section-assets/feature-section-04/misty-dawn.3ca91d11.webp";

const DEFAULT_HEADING = (
  <>
    Secure{" "}
    <span className="whitespace-nowrap text-[1.15em] text-(--fs4-ink-soft) tracking-[-0.04em]">
      by design.
    </span>
  </>
);

export interface FeatureSection04Props extends Omit<
  ComponentProps<"section">,
  "title"
> {
  /** The headline. Wrap the words to mute in a `<span>` with a muted colour, as the default does with "by design.". Defaults to "Secure by design." */
  heading?: ReactNode;
  /** The paragraph under the headline: the promise the features back up, in one or two sentences. */
  intro?: ReactNode;
  /** The photo behind the device, shown blurred: a calm landscape works best; 1200px wide is plenty. Defaults to a misty dawn. */
  image?: string;
  /** What stands in the panel, over the photo. Defaults to `FeatureWalletPhone`, a phone on a wallet's setup screen. */
  visual?: ReactNode;
  /** The features: the first two fill the left column, the rest the right (one column on phones). Five read best, as in the default. */
  features?: FeatureSection04Item[];
  /** The headline's level: 1 when this is the page's main heading, 2 or 3 to fit under the page's own. The feature titles take the next level. Defaults to 2. */
  headingLevel?: 1 | 2 | 3;
}

const FeatureSection04 = ({
  className,
  heading = DEFAULT_HEADING,
  intro = "Your funds are completely under your control and secured by your biometrics. No one else can touch them, not even us.",
  image = DEFAULT_IMAGE,
  visual = <FeatureWalletPhone />,
  features = FEATURES,
  headingLevel = 2,
  style,
  ...props
}: FeatureSection04Props) => {
  const HeadingTag = `h${headingLevel}` as const;
  const TitleTag = `h${headingLevel + 1}` as "h2" | "h3" | "h4";
  const columns = [features.slice(0, 2), features.slice(2)];

  const tile = (feature: FeatureSection04Item) => {
    const size = feature.size ?? "medium";
    const inline = size === "short";
    return (
      <li className={TILE_GROW[size]} key={feature.id}>
        <Card
          className={cn(
            "h-full gap-0 bg-(--fs4-surface) py-0 text-(--fs4-ink)",
            RING_LIFT,
            inline
              ? "flex-row items-center gap-6 rounded-[2rem] py-7 pr-5 pl-7"
              : "min-h-60 justify-between gap-10 rounded-[2.5rem] p-6"
          )}
        >
          {!inline && (
            <IconPlate
              className="size-20 min-[110rem]:size-[6.5rem]"
              tone={feature.tone}
            >
              {feature.icon}
            </IconPlate>
          )}
          <div className="min-w-0 flex-1">
            <TitleTag className="text-[1.375rem] leading-[1.2] font-medium tracking-[-0.015em] text-pretty sm:text-[1.5rem] xl:text-[1.625rem] min-[110rem]:text-[2rem]">
              {feature.title}
            </TitleTag>
            <p className="mt-3 text-base leading-normal text-pretty text-(--fs4-ink-muted) xl:text-[1.0625rem] min-[110rem]:mt-3.5 min-[110rem]:text-xl">
              {feature.description}
            </p>
          </div>
          {inline && (
            <IconPlate
              className="size-14 sm:size-16 min-[110rem]:size-[5.5rem]"
              tone={feature.tone}
            >
              {feature.icon}
            </IconPlate>
          )}
        </Card>
      </li>
    );
  };

  return (
    <section
      data-slot="feature-section-04"
      className={cn("w-full bg-(--fs4-canvas) text-(--fs4-ink)", className)}
      style={{ ...PALETTE, ...style }}
      {...props}
    >
      <div className="mx-auto grid max-w-[125rem] gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[7fr_10fr] lg:gap-x-14 lg:gap-y-12 lg:px-10 lg:py-24 xl:px-16 min-[110rem]:px-30 min-[110rem]:py-30">
        {/* headline and intro: first on phones, top right from lg */}
        <div className="lg:col-start-2 lg:pt-7.5">
          <HeadingTag className="text-[2.75rem] leading-[1.1] font-normal tracking-[-0.04em] sm:text-6xl lg:text-[3.5rem] xl:text-[4.25rem] min-[110rem]:text-[5rem]">
            {heading}
          </HeadingTag>
          <p className="mt-5 max-w-[60.5rem] text-lg leading-[1.4] tracking-[-0.005em] text-pretty text-(--fs4-ink-muted) sm:text-xl lg:text-[1.375rem] xl:text-[1.625rem] min-[110rem]:text-[2rem] min-[110rem]:leading-[1.25]">
            {intro}
          </p>
        </div>

        {/* the panel: the photo, a veil, and the device over them, pinned to
            the bottom and running off it as in the design. Portrait on
            phones, square on tablets, the column's height from lg. */}
        <div
          className={cn(
            "relative aspect-[700/1009] overflow-hidden rounded-[1.75rem] sm:aspect-square sm:rounded-[2.5rem] lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:aspect-auto",
            RING_LIFT
          )}
        >
          <img
            alt=""
            className="absolute -inset-15 size-[calc(100%+7.5rem)] max-w-none object-cover blur-[8px]"
            src={image}
          />
          <div className="absolute inset-0 bg-linear-to-b from-white/12 to-[rgb(15_18_33/0.16)]" />
          <div className="absolute bottom-0 left-1/2 w-[62.3%] -translate-x-1/2 translate-y-[9.2%] drop-shadow-[0_22px_44px_rgb(0_0_0/0.14)] sm:w-[44%] lg:w-[62.3%] [&>svg]:h-auto [&>svg]:w-full">
            {visual}
          </div>
        </div>

        {/* the features: two columns from md, each tile's height in proportion */}
        <div className="grid gap-5 md:grid-cols-2 lg:col-start-2">
          {columns.map((column, index) => (
            <ul
              className="flex flex-col gap-5"
              key={index === 0 ? "left" : "right"}
            >
              {column.map(tile)}
            </ul>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeatureSection04;
