import {
  CloudDownloadIcon,
  Facebook01Icon,
  HeadphonesIcon,
  InstagramIcon,
  NewTwitterIcon,
  Playlist01Icon,
  PodcastIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────
 * App footer. A dark rounded card that closes the page: on top, a red
 * download panel (headline, a line of copy, App Store and Google Play
 * badges) with a small system diagram on its right; below,
 * four link columns, a pinned post from the brand's account, a hairline,
 * and the copyright with social links. A server component; the only
 * motion is CSS.
 *
 * Colour is fixed, not the page theme: the footer stays dark in light and
 * dark mode (it reads as the page's floor) and the panel is red. `tone`
 * re-colours the panel; its gradient and the tiles derive from it.
 *
 * The diagram (the app as a hub, four feature nodes wired into it, beams
 * of light running the wires) is described where it's drawn, below.
 *
 * Per device (plain sm / md / lg breakpoints):
 *   phone    the panel stacks: copy and badges, then the diagram;
 *            links in two columns; the post below; bottom bar stacked
 *   tablet   copy beside the illustration; links in four columns, the
 *            post below them
 *   desktop  the same, roomier; links and the post in one row
 * ───────────────────────────────────────────────────────────────────────── */

/* ── Marks and icons (Hugeicons, plus the official store marks) ─────────── */

// The beat mark's bar heights, left to right (viewBox units, 24 tall).
const BARS = [8, 15, 21, 13, 6];

/** A tile or badge icon from Hugeicons, sized by its parent (the tiles
 * set it as a share of their width). */
/**
 * The default brand mark: five rounded equaliser bars, the shape of a beat
 * caught mid-bar. Tall in the middle, falling off unevenly to the sides so
 * it reads as sound, not a chart. Solid, in currentColor. Inside the hub
 * the bars pulse like a live equaliser (see .fs-hub in the CSS); anywhere
 * else it stays still.
 */
const BeatMark = ({ className }: { className?: string }) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    {BARS.map((h, i) => (
      <rect
        className="fs-bar"
        height={h}
        key={i * 4.6 + 1.3}
        rx={1.5}
        style={{ animationDelay: `${i * -0.23}s` }}
        width={3}
        x={i * 4.6 + 1.3}
        y={12 - h / 2}
      />
    ))}
  </svg>
);

const AppleMark = () => (
  <svg
    aria-hidden="true"
    className="size-[1.4rem] shrink-0"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M16.37 12.6c-.02-2.24 1.83-3.32 1.91-3.37-1.04-1.52-2.66-1.73-3.24-1.75-1.38-.14-2.69.81-3.39.81-.7 0-1.78-.79-2.92-.77-1.5.02-2.89.87-3.66 2.21-1.56 2.71-.4 6.72 1.12 8.92.74 1.08 1.63 2.29 2.79 2.24 1.12-.04 1.54-.72 2.89-.72s1.73.72 2.91.7c1.2-.02 1.96-1.1 2.7-2.18.85-1.25 1.2-2.46 1.22-2.52-.03-.01-2.33-.9-2.35-3.57ZM14.15 5.98c.62-.75 1.03-1.78.92-2.82-.89.04-1.97.59-2.6 1.34-.57.66-1.07 1.71-.94 2.73.99.08 2-.5 2.62-1.25Z" />
  </svg>
);

const PlayMark = () => (
  <svg
    aria-hidden="true"
    className="size-[1.35rem] shrink-0"
    viewBox="0 0 24 24"
  >
    <path
      d="M3.6 2.4 13.4 12l-9.8 9.6a1.2 1.2 0 0 1-.6-1.05V3.45c0-.44.24-.83.6-1.05Z"
      fill="#00D2FF"
    />
    <path
      d="m16.7 8.75-3.3 3.25-9.8-9.6c.38-.24.88-.27 1.3-.04l11.8 6.39Z"
      fill="#00F076"
    />
    <path
      d="m16.7 15.25-11.8 6.39c-.42.23-.92.2-1.3-.04l9.8-9.6 3.3 3.25Z"
      fill="#F3364A"
    />
    <path
      d="m20.3 10.95-3.6-2.2-3.3 3.25 3.3 3.25 3.6-2.2a1.22 1.22 0 0 0 0-2.1Z"
      fill="#FFCA28"
    />
  </svg>
);

/* ── The illustration ──────────────────────────────────────────────────── */

/*
 * A small system diagram, drawn the way product sites draw them: one hub
 * (the app), four feature nodes in one frosted material, and one connector
 * style. Everything sits in a 600 × 330 box; the connectors are an SVG in
 * that viewBox and the tiles are HTML placed on the same coordinates (as
 * percentages), so their shadows, icons and labels stay crisp.
 *
 *   hub        white app tile with the brand mark in the panel's colour,
 *              framed by two fine concentric outlines and a slow ripple
 *   nodes      Playlists and Podcasts on the left, Lossless and Offline on
 *              the right, mirrored; 56 units, glass on red, icons at one
 *              stroke weight, a label under each
 *   wires      out of each node's facing edge, along, one rounded corner,
 *              into the hub's side; port dots where a wire meets an edge;
 *              a bus from the panel's top edge into the hub
 *   beams      a light with a fading tail runs each wire into the hub, each
 *              on its own loop (three dash layers on pathLength 1, heads
 *              aligned)
 *   backdrop   a faint dot grid that fades out toward the edges
 */
const BOX = { h: 330, w: 600 };
const HUB = { size: 84, x: 300, y: 165 };
const NODE = 56;
// Corner radius of every wire's bend, and where wires run vertically.
const BEND = 14;
const LANE = 96;

interface DiagramNode {
  icon: typeof HeadphonesIcon;
  label: string;
  x: number;
  y: number;
}

const NODES: DiagramNode[] = [
  { icon: Playlist01Icon, label: "Playlists", x: 104, y: 88 },
  { icon: PodcastIcon, label: "Podcasts", x: 104, y: 242 },
  { icon: HeadphonesIcon, label: "Lossless", x: 496, y: 88 },
  { icon: CloudDownloadIcon, label: "Offline", x: 496, y: 242 },
];

/** A node's wire into the hub, and its two ends (for the port dots). */
const wireOf = (n: DiagramNode) => {
  const side = n.x < HUB.x ? 1 : -1;
  const down = n.y < HUB.y ? 1 : -1;
  const sx = n.x + (side * NODE) / 2;
  const mx = HUB.x - side * LANE;
  const ey = HUB.y - down * 14;
  const ex = HUB.x - (side * HUB.size) / 2;
  const r = BEND;
  return {
    d: `M${sx} ${n.y}H${mx - side * r}Q${mx} ${n.y} ${mx} ${n.y + down * r}V${ey - down * r}Q${mx} ${ey} ${mx + side * r} ${ey}H${ex}`,
    from: [sx, n.y] as const,
    to: [ex, ey] as const,
  };
};

const WIRES = NODES.map(wireOf);
// The bus: from the panel's top edge into the hub's top.
const BUS = `M${HUB.x} -2V${HUB.y - HUB.size / 2}`;

// The beam's three layers: head, then a longer, fainter tail.
const BEAM = [
  { len: 0.05, opacity: 1, width: 2 },
  { len: 0.13, opacity: 0.45, width: 1.5 },
  { len: 0.24, opacity: 0.18, width: 1 },
];
// Each wire's loop (seconds) and start, so the beams never march in step.
const BEAM_TIMES = [
  { delay: 0, dur: 3.4 },
  { delay: 1.7, dur: 3.8 },
  { delay: 0.9, dur: 3.6 },
  { delay: 2.4, dur: 4 },
  { delay: 0.4, dur: 3 },
];

// One keyframe per beam layer, with literal offsets: a var() inside a
// keyframe doesn't interpolate here (it jumps at the halfway point), so the
// numbers are written in. Each runs from its own length to that length
// minus 1.3, which keeps every layer's head at the same point.
const beamKeyframes = () =>
  BEAM.map(
    (b, i) =>
      `@keyframes fs-beam-${i} { from { stroke-dashoffset: ${b.len}; } to { stroke-dashoffset: ${b.len - 1.3}; } }`
  ).join("\n");

const css = () => `
${beamKeyframes()}
@keyframes fs-ripple { from { opacity: 0.55; scale: 1; } to { opacity: 0; scale: 1.32; } }
.fs-beam { animation-duration: var(--fs-d); animation-delay: var(--fs-delay); animation-timing-function: cubic-bezier(0.55, 0, 0.45, 1); animation-iteration-count: infinite; animation-fill-mode: both; }
.fs-ripple { animation: fs-ripple 2.8s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
@keyframes fs-bar { 0% { scale: 1 0.5; } 100% { scale: 1 1; } }
.fs-hub .fs-bar { transform-box: fill-box; transform-origin: center; animation: fs-bar 0.9s cubic-bezier(0.45, 0, 0.55, 1) infinite alternate; }
@media (prefers-reduced-motion: reduce) { .fs-beam { animation: none; opacity: 0; } .fs-ripple { animation: none; opacity: 0; } .fs-hub .fs-bar { animation: none; } }
`;

/** Where a tile sits: its centre and size in the box, as CSS percentages. */
const place = (cx: number, cy: number, size: number): CSSProperties => ({
  left: `${((cx - size / 2) / BOX.w) * 100}%`,
  top: `${((cy - size / 2) / BOX.h) * 100}%`,
  width: `${(size / BOX.w) * 100}%`,
});

/** The diagram: backdrop, wires, beams, ports, hub and nodes. */
const Diagram = ({ mark }: { mark: ReactNode }) => (
  <div aria-hidden="true" className="relative aspect-[600/330] w-full">
    {/* Backdrop: a dot grid that fades out toward the edges. */}
    <div className="absolute inset-0 bg-[radial-gradient(rgb(255_255_255/0.18)_0.0625rem,transparent_0.075rem)] [mask-image:radial-gradient(ellipse_60%_70%_at_50%_50%,black,transparent)] bg-size-[1.25rem_1.25rem]" />

    <svg
      className="absolute inset-0 size-full overflow-visible"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox={`0 0 ${BOX.w} ${BOX.h}`}
    >
      {/* The hub's frames. */}
      {[28, 58].map((pad, i) => (
        <rect
          height={HUB.size + pad}
          key={pad}
          rx={(HUB.size + pad) * 0.28}
          stroke={`rgb(255 255 255 / ${i === 0 ? 0.2 : 0.1})`}
          strokeWidth={1}
          width={HUB.size + pad}
          x={HUB.x - (HUB.size + pad) / 2}
          y={HUB.y - (HUB.size + pad) / 2}
        />
      ))}
      {/* Wires. */}
      <g stroke="rgb(255 255 255 / 0.28)" strokeWidth={1.25}>
        <path d={BUS} />
        {WIRES.map((w) => (
          <path d={w.d} key={w.d} />
        ))}
      </g>
      {/* Beams, each wire on its own loop. */}
      {[BUS, ...WIRES.map((w) => w.d)].map((d, i) => (
        <g key={d} stroke="white">
          {BEAM.map((b, layer) => (
            <path
              className="fs-beam"
              d={d}
              key={b.len}
              opacity={b.opacity}
              pathLength={1}
              strokeDasharray={`${b.len} 2`}
              strokeWidth={b.width}
              style={
                {
                  "--fs-d": `${BEAM_TIMES[i].dur}s`,
                  "--fs-delay": `${BEAM_TIMES[i].delay}s`,
                  animationName: `fs-beam-${layer}`,
                } as CSSProperties
              }
            />
          ))}
        </g>
      ))}
      {/* Ports where wires meet edges. */}
      <g fill="white">
        {[
          ...WIRES.flatMap((w) => [w.from, w.to]),
          [HUB.x, HUB.y - HUB.size / 2] as const,
        ].map(([x, y]) => (
          <circle cx={x} cy={y} key={`${x},${y}`} opacity={0.85} r={2.25} />
        ))}
      </g>
    </svg>

    {/* Nodes: one frosted material, one icon weight, a label under each. */}
    {NODES.map((n) => (
      <div
        className="absolute flex flex-col items-center"
        key={n.label}
        style={place(n.x, n.y, NODE)}
      >
        <span className="grid aspect-square w-full place-items-center rounded-[30%] bg-white/14 text-white shadow-[0_0.5rem_1rem_-0.375rem_rgb(50_0_0/0.55),inset_0_0_0_1px_rgb(255_255_255/0.24),inset_0_1px_0_0_rgb(255_255_255/0.4)] [&>svg]:size-[46%]">
          <HugeiconsIcon aria-hidden="true" icon={n.icon} strokeWidth={1.6} />
        </span>
        <span className="mt-[18%] text-[0.625rem] font-medium tracking-[-0.005em] whitespace-nowrap text-white/80 sm:text-[0.6875rem]">
          {n.label}
        </span>
      </div>
    ))}

    {/* Hub: the app, the one lit thing. */}
    <div className="absolute" style={place(HUB.x, HUB.y, HUB.size)}>
      <span className="fs-ripple absolute inset-0 rounded-[28%] shadow-[0_0_0_1px_rgb(255_255_255/0.6)]" />
      <span className="fs-hub relative grid aspect-square w-full place-items-center rounded-[28%] bg-white text-(--fs-tone) shadow-[0_0.875rem_1.75rem_-0.625rem_rgb(60_0_0/0.6),0_0_0_1px_rgb(255_255_255/0.5),inset_0_-2px_0_0_rgb(0_0_0/0.06)] [&>svg]:size-[58%]">
        {mark}
      </span>
    </div>
  </div>
);

// Social marks from Hugeicons; "x" is the X (formerly Twitter) mark.
const SOCIAL_ICONS = {
  facebook: Facebook01Icon,
  instagram: InstagramIcon,
  x: NewTwitterIcon,
} as const;

export type FooterSocialNetwork = keyof typeof SOCIAL_ICONS;

/* White store badges: the mark, a small line and the store's name; a fine
 * inner edge and a contact shadow; a 0.96 press. */
const BADGE =
  "inline-flex h-12 items-center gap-2 rounded-[0.75rem] bg-white px-3.5 text-[#111] shadow-[0_1px_2px_rgb(0_0_0/0.25),inset_0_0_0_1px_rgb(0_0_0/0.08)] transition-[scale,background-color] duration-150 ease-out outline-none hover:bg-white/90 focus-visible:ring-[3px] focus-visible:ring-white/60 active:scale-[0.96] motion-reduce:active:scale-100";

/* The two surfaces' depth, all inner shadows (they paint under the
 * contents, so copy and tiles sit above them):
 *   panel  a light top edge where light catches it, a faint inner ring, a
 *          soft blurred darkening all round the inside edge, and a deeper
 *          shade rising from the bottom: the red reads as a lit, slightly
 *          domed surface rather than a flat fill
 *   tray   a little lighter than the card, edged by a fine ring and a
 *          top highlight, with a soft blurred shadow inside its edges, so
 *          it sits recessed into the card */
const DEPTH = {
  "--fs-panel-depth":
    "inset 0 1px 0 0 rgb(255 255 255 / 0.3), inset 0 0 0 1px rgb(255 255 255 / 0.08), inset 0 0 2.5rem 0 rgb(60 0 0 / 0.22), inset 0 -2.5rem 4rem -2rem rgb(40 0 0 / 0.38)",
  "--fs-tray-depth":
    "inset 0 1px 0 0 rgb(255 255 255 / 0.07), inset 0 0 0 1px rgb(255 255 255 / 0.06), inset 0 0 2rem 0 rgb(0 0 0 / 0.4), inset 0 1.5rem 2.5rem -2rem rgb(0 0 0 / 0.45)",
};

/* ── Content ───────────────────────────────────────────────────────────── */

export interface FooterLink {
  /** The link's text, up to about 24 characters. */
  label: string;
  /** Where it goes. */
  href: string;
}

export interface FooterColumn {
  /** The column's heading, one or two words ("Platform"). */
  title: string;
  /** Its links, ideally 3 to 5. */
  links: FooterLink[];
}

export interface FooterPost {
  /** The account's display name ("Clova"). */
  name: string;
  /** The account's handle ("@clovaapp"). */
  handle: string;
  /** The post, up to about 110 characters. */
  text: string;
  /** Link to the post or the profile. */
  href: string;
}

export interface FooterSocial {
  /** Which network's mark to show. */
  network: FooterSocialNetwork;
  /** Where it goes. */
  href: string;
  /** Its accessible name ("Clova on Instagram"). */
  label: string;
}

const DEFAULT_COLUMNS: FooterColumn[] = [
  {
    links: [
      { href: "#pricing", label: "Plans & Pricing" },
      { href: "#ai-manager", label: "Personal AI Manager" },
      { href: "#business", label: "AI Business Music" },
      { href: "#album", label: "AI Data Artist Album" },
    ],
    title: "Platform",
  },
  {
    links: [
      { href: "#about", label: "About Us" },
      { href: "#careers", label: "Work With Us" },
      { href: "#blog", label: "Blog & News" },
    ],
    title: "Company",
  },
  {
    links: [
      { href: "#docs", label: "Documentation" },
      { href: "#demo", label: "Free Demo" },
      { href: "#press", label: "Press Conferences" },
    ],
    title: "Resources",
  },
  {
    links: [
      { href: "#terms", label: "Terms of Service" },
      { href: "#privacy", label: "Privacy Policy" },
      { href: "#cookies", label: "Cookies Policy" },
      { href: "#data", label: "Data Processing" },
    ],
    title: "Legal",
  },
];

const DEFAULT_SOCIALS: FooterSocial[] = [
  { href: "#instagram", label: "Clova on Instagram", network: "instagram" },
  { href: "#facebook", label: "Clova on Facebook", network: "facebook" },
  { href: "#x", label: "Clova on X", network: "x" },
];

/* ── Section ───────────────────────────────────────────────────────────── */

export interface FooterSectionProps {
  /** The brand's name, in the post and the copyright line ("Clova"). */
  brand?: string;
  /** The brand's mark (an SVG using currentColor), shown in the app tile, the post and the bottom bar. Default: five equaliser bars, which pulse in the app tile. */
  mark?: ReactNode;
  /** The headline's first line, in white ("Connect."). */
  heading?: ReactNode;
  /** Its second line, softer ("Don't Just Listen"). */
  subheading?: ReactNode;
  /** The line under the headline, up to about 140 characters. */
  description?: ReactNode;
  /** The App Store link, or null to hide the badge. */
  appStoreHref?: string | null;
  /** The Google Play link, or null to hide the badge. */
  googlePlayHref?: string | null;
  /** The link columns, up to 4. */
  columns?: FooterColumn[];
  /** The pinned post on the right, or null to hide it. */
  post?: FooterPost | null;
  /** The social links in the bottom bar. */
  socials?: FooterSocial[];
  /** The copyright line. Default "{brand}, {this year}." */
  copyright?: ReactNode;
  /** The panel's colour (any CSS colour). Default a warm red, #D9262C. */
  tone?: string;
  /** Classes for the outer section. */
  className?: string;
}

/**
 * App footer: a dark rounded card with a red download panel (headline,
 * copy, App Store and Google Play badges) and a diagram of the app as a hub
 * with four feature nodes, light running the wires into it; then four link columns, a pinned
 * post, and the copyright with social links. Stays dark in light and dark
 * mode; `tone` re-colours the panel.
 */
export const FooterSection = ({
  brand = "Clova",
  mark = <BeatMark />,
  heading = "Connect.",
  subheading = "Don't Just Listen",
  description = "Join millions of other music lovers! Download the app now and experience limitless music at your fingertips. Let's get started!",
  appStoreHref = "#app-store",
  googlePlayHref = "#google-play",
  columns = DEFAULT_COLUMNS,
  post = {
    handle: "@clovaapp",
    href: "#post",
    name: "Clova",
    text: "We've just announced a new feature that helps you get even more out of Clova!",
  },
  socials = DEFAULT_SOCIALS,
  copyright,
  tone = "#D9262C",
  className,
}: FooterSectionProps) => (
  <section
    className={cn("bg-background p-3 sm:p-4", className)}
    data-slot="footer-section"
    style={{ ...DEPTH, "--fs-tone": tone } as CSSProperties}
  >
    <style>{css()}</style>
    <footer className="mx-auto max-w-[90rem] overflow-hidden rounded-[1.5rem] bg-[#121212] p-2 text-white shadow-[0_0_0_1px_rgb(255_255_255/0.06)] sm:rounded-[2rem] sm:p-3 [color-scheme:dark]">
      {/* The download panel: copy on the left, the diagram on the
          right (below the copy on phones). */}
      <div className="relative grid overflow-hidden rounded-[1.125rem] bg-linear-to-br from-[color-mix(in_oklab,var(--fs-tone)_88%,white)] via-(--fs-tone) to-[color-mix(in_oklab,var(--fs-tone)_70%,black)] shadow-(--fs-panel-depth) sm:rounded-[1.5rem] md:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1.15fr]">
        <div className="relative z-10 flex flex-col justify-center px-6 pt-8 pb-2 sm:px-10 sm:pt-12 md:py-10 md:pr-2 md:pl-10 lg:py-12 lg:pr-4 lg:pl-14">
          <h2 className="text-[2.25rem] leading-[1.05] font-medium tracking-[-0.035em] sm:text-[3rem] lg:text-[3.5rem]">
            <span className="block">{heading}</span>
            <span className="block text-white/65">{subheading}</span>
          </h2>
          <p className="mt-4 max-w-[30rem] text-[0.9375rem] leading-relaxed text-white/85 sm:mt-5">
            {description}
          </p>
          {appStoreHref || googlePlayHref ? (
            <div className="mt-6 flex flex-wrap gap-3 sm:mt-7">
              {appStoreHref ? (
                <a
                  aria-label="Download on the App Store"
                  className={BADGE}
                  href={appStoreHref}
                >
                  <AppleMark />
                  <span className="flex flex-col text-left leading-none">
                    <span className="text-[0.625rem] font-medium">
                      Download on the
                    </span>
                    <span className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.02em]">
                      App Store
                    </span>
                  </span>
                </a>
              ) : null}
              {googlePlayHref ? (
                <a
                  aria-label="Get it on Google Play"
                  className={BADGE}
                  href={googlePlayHref}
                >
                  <PlayMark />
                  <span className="flex flex-col text-left leading-none">
                    <span className="text-[0.625rem] font-medium tracking-[0.04em] uppercase">
                      Get it on
                    </span>
                    <span className="mt-0.5 text-[1.0625rem] font-semibold tracking-[-0.02em]">
                      Google Play
                    </span>
                  </span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="relative self-center px-4 pb-6 sm:px-8 md:px-0 md:pr-4 md:pb-0 lg:pr-0">
          {/* The diagram is symmetric with nodes at its edges, so it shows
              whole at every size (no crop). */}
          <Diagram mark={mark} />
        </div>
      </div>

      {/* Links, the post and the bottom bar, in their own recessed tray. */}
      <div className="mt-2 rounded-[1.125rem] bg-linear-to-b from-white/[0.035] to-white/[0.012] px-4 pt-10 pb-4 shadow-(--fs-tray-depth) sm:mt-3 sm:rounded-[1.5rem] sm:px-8 sm:pt-12 lg:px-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-4 sm:gap-x-10 lg:gap-x-16">
            {columns.slice(0, 4).map((column) => (
              <nav aria-label={column.title} key={column.title}>
                <p className="text-[1.0625rem] font-medium tracking-[-0.01em] text-white">
                  {column.title}
                </p>
                <ul className="mt-4 flex flex-col gap-3">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        className="text-[0.875rem] text-white/55 transition-colors duration-150 ease-out hover:text-white focus-visible:rounded-sm focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                        href={link.href}
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
          {post ? (
            <a
              className="block w-full rounded-[1.125rem] bg-white/[0.04] p-4 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.09),inset_0_1px_0_0_rgb(255_255_255/0.06)] transition-colors duration-150 ease-out hover:bg-white/[0.07] sm:max-w-[21rem] lg:w-[19rem] lg:shrink-0"
              href={post.href}
            >
              <span className="flex items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-(--fs-tone) text-white shadow-[inset_0_1px_0_0_rgb(255_255_255/0.3)] [&>svg]:size-[58%]">
                  {mark}
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate text-[0.9375rem] font-medium">
                    {post.name}
                  </span>
                  <span className="block truncate text-[0.8125rem] text-white/45">
                    {post.handle}
                  </span>
                </span>
                <HugeiconsIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-white/80"
                  icon={SOCIAL_ICONS.x}
                  strokeWidth={1.8}
                />
              </span>
              <span className="mt-3 block text-[0.875rem] leading-relaxed text-white/75">
                {post.text}
              </span>
            </a>
          ) : null}
        </div>

        <div className="mt-12 flex flex-col-reverse gap-6 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-[0.875rem] font-medium text-white/85">
            <span className="text-white/80 [&>svg]:size-5">{mark}</span>
            {copyright ?? `${brand}, ${new Date().getFullYear()}.`}
          </p>
          {socials.length > 0 ? (
            <ul className="flex gap-2.5">
              {socials.map((s) => (
                <li key={s.network}>
                  <a
                    aria-label={s.label}
                    className="grid size-9 place-items-center rounded-full bg-white/5 text-white/80 shadow-[inset_0_0_0_1px_rgb(255_255_255/0.14)] transition-colors duration-150 ease-out hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
                    href={s.href}
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      className="size-4"
                      icon={SOCIAL_ICONS[s.network]}
                      strokeWidth={1.8}
                    />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </footer>
  </section>
);

export default FooterSection;
