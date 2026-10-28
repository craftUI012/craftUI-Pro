import { ArrowRight } from "lucide-react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

import {
  AirtableMark,
  AsanaMark,
  AtlassianMark,
  CloudflareMark,
  FigmaMark,
  GitLabMark,
  InstagramMark,
  LinkedInMark,
  SlackMark,
  SupabaseMark,
  WebflowMark,
  XMark,
  YouTubeMark,
} from "./hero-section-02-logos";
import { LAYOUT, NARROW, WIDE } from "./hero-section-02-shared";
import type {
  ShowreelCategory,
  ShowreelReel,
  ShowreelViews,
} from "./hero-section-02-shared";
import { ShowreelWheel } from "./hero-section-02-wheel";

export type {
  ShowreelCategory,
  ShowreelReel,
  ShowreelViews,
} from "./hero-section-02-shared";

/* ─────────────────────────────────────────────────────────────────────────
 * Showreel hero. A server component: the copy, actions and client marks
 * render as plain HTML, and only the wheel (hero-section-02-wheel.tsx) and
 * its caption hydrate.
 *
 * Layout is CSS only, so the server's HTML is already in its final place:
 *
 *   --reel-s      the wheel's scale, stepped by screen width (two of its
 *                 steps, 72rem and 90rem, sit between Tailwind's named
 *                 breakpoints, so they're written min-[…])
 *   lg            which wheel shows: WIDE beside the copy, or NARROW lying
 *                 across the top (both have 16:9 frames on screen)
 *
 * The copy column starts where the wheel's geometry says (LAYOUT, in design
 * units, times --reel-s), so the spokes band the copy instead of running
 * through it. Sizes follow the screen width (Tailwind's sm / md / lg / xl
 * breakpoints), like the library's other sections.
 * ───────────────────────────────────────────────────────────────────────── */

/* Keyframes the utilities can't express, rendered as a <style> inside the
 * section (nothing goes in globals.css), and all of it off for reduced
 * motion. */
const CSS = `
@keyframes showreel-spin-in { from { opacity: 0; transform: rotate(-14deg); } }
@keyframes showreel-rise { from { opacity: 0; transform: translateY(12px); filter: blur(4px); } }
@keyframes showreel-marquee { to { transform: translateX(-50%); } }
.showreel-drum { animation: showreel-spin-in 1.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
.showreel-rise { animation: showreel-rise 0.9s cubic-bezier(0.16, 1, 0.3, 1) both; animation-delay: calc(var(--i, 0) * 100ms + 250ms); }
.showreel-marquee { animation: showreel-marquee 36s linear infinite; }
.showreel-logos:hover .showreel-marquee { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) {
  .showreel-drum, .showreel-rise, .showreel-marquee { animation: none; }
}
`;

export interface ShowreelAction {
  /** Where the button goes: a page, an anchor ("#contact") or a mailto: link. */
  href: string;
  /** The button's text, e.g. "Book a call". */
  label: string;
}

export interface ShowreelLogo {
  /** The client's name, shown in the scrolling client row and read by screen readers. */
  name: string;
  /** The client's mark, shown before the name at 20px. */
  logo?: ReactNode;
}

export interface ShowreelHeroProps extends Omit<
  ComponentProps<"section">,
  "title"
> {
  /** Small label above the title. */
  eyebrow?: ReactNode;
  /** The hero's main line. */
  title?: ReactNode;
  /** A second line, in the muted colour. */
  titleMuted?: ReactNode;
  /** A sentence or two under the title. */
  description?: ReactNode;
  /** The main button. Pass null to hide it. */
  primaryAction?: ShowreelAction | null;
  /** The second, quieter button. Pass null to hide it. */
  secondaryAction?: ShowreelAction | null;
  /** Label before the scrolling row of client logos. */
  logosLabel?: string;
  /** Scroll by in a loop under the actions. Pass [] to hide the row. */
  logos?: ShowreelLogo[];
  /** Your work: one frame on the wheel each, with its description. */
  reels?: ShowreelReel[];
  /** Names for the reels' `category` ids, shown above each description. */
  categories?: ShowreelCategory[];
  /** Which reel faces the viewer at first. */
  initialIndex?: number;
  /** Advances while the section is on screen and nobody's using it. */
  autoplay?: boolean;
  /** Milliseconds between autoplay steps. */
  autoplayInterval?: number;
  /** 1 when this is the page's hero; 2 when the page has its own h1. */
  headingLevel?: 1 | 2;
}

/* ── Focus ────────────────────────────────────────────────────────────────
 * Four stacked backdrop blurs, 1 → 8px. Each is masked by an eased ramp that
 * starts further from the crest than the one before, so the crest frame and
 * its caption stay sharp and the blur builds smoothly outward instead of
 * stepping. Distances are design units past the edge of the crest's own
 * band (half a frame), scaled by --reel-s like the wheel. */
const BLUR_LAYERS = [
  { blur: 1, from: 0, to: 70 },
  { blur: 2, from: 40, to: 150 },
  { blur: 4, from: 110, to: 260 },
  { blur: 8, from: 200, to: 400 },
];

/** Sine ease-in-out, sampled at nine points: enough that no stop shows. */
const EASE = Array.from({ length: 9 }, (_, i) => i / 8);
const ease = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

const focusMask = (
  direction: "to bottom" | "to right",
  band: number,
  from: number,
  to: number
) => {
  const start = band + from;
  const end = band + to;
  // Opacity at each eased step, d design units from the crest line.
  const stops = EASE.map((t) => ({
    alpha: ease(t).toFixed(3),
    d: start + (end - start) * t,
  }));
  const before = stops
    .toReversed()
    .map(
      ({ alpha, d }) =>
        `rgb(0 0 0 / ${alpha}) calc(50% - ${d}px * var(--reel-s))`
    );
  const after = stops.map(
    ({ alpha, d }) => `rgb(0 0 0 / ${alpha}) calc(50% + ${d}px * var(--reel-s))`
  );
  return `linear-gradient(${direction}, #000 0%, ${before.join(", ")}, ${after.join(", ")}, #000 100%)`;
};

const FocusBlur = ({
  band,
  className,
  direction,
}: {
  band: number;
  className: string;
  direction: "to bottom" | "to right";
}) => (
  <div
    aria-hidden
    className={cn("pointer-events-none absolute z-[25]", className)}
  >
    {BLUR_LAYERS.map((layer) => {
      const mask = focusMask(direction, band, layer.from, layer.to);
      return (
        <div
          key={layer.blur}
          className="absolute inset-0"
          style={{
            WebkitBackdropFilter: `blur(${layer.blur}px)`,
            WebkitMaskImage: mask,
            backdropFilter: `blur(${layer.blur}px)`,
            maskImage: mask,
          }}
        />
      );
    })}
  </div>
);

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=480&q=75`;

const PLATFORMS = {
  instagram: { icon: <InstagramMark />, platform: "Instagram" },
  linkedin: { icon: <LinkedInMark />, platform: "LinkedIn" },
  x: { icon: <XMark />, platform: "X" },
  youtube: { icon: <YouTubeMark />, platform: "YouTube" },
};

type Platform = keyof typeof PLATFORMS;

/** `views(["youtube", "1.2M"], ["x", "88K"])`: biggest first reads best. */
const views = (...counts: [Platform, string][]): ShowreelViews[] =>
  counts.map(([platform, value]) => ({ ...PLATFORMS[platform], value }));

const DEFAULT_CATEGORIES: ShowreelCategory[] = [
  { id: "launch", label: "Launch film" },
  { id: "feature", label: "Feature video" },
  { id: "demo", label: "Product demo" },
  { id: "teaser", label: "Teaser" },
];

const DEFAULT_REELS: ShowreelReel[] = [
  {
    alt: "Analytics dashboard with line and bar charts on a dark screen",
    category: "launch",
    description:
      "The main launch film for an analytics platform's 2.0 release.",
    src: unsplash("1551288049-bebda4e38f71"),
    views: views(["youtube", "1.2M"], ["x", "520K"], ["linkedin", "410K"]),
  },
  {
    alt: "Laptop on a glass desk showing a finance dashboard",
    category: "launch",
    description:
      "A launch film for a finance dashboard, with a cut for each channel.",
    src: unsplash("1460925895917-afdab827c52f"),
    views: views(["linkedin", "1.1M"], ["youtube", "860K"], ["x", "190K"]),
  },
  {
    alt: "Retro consoles and keyboards lit in pink and blue",
    category: "launch",
    description: "The launch trailer for an indie game studio's first title.",
    src: unsplash("1550745165-9bc0b252726f"),
    views: views(["youtube", "2.4M"], ["instagram", "640K"], ["x", "310K"]),
  },
  {
    alt: "Design tool open on a large monitor with a website layout",
    category: "feature",
    description: "A feature video introducing AI layouts in a design tool.",
    src: unsplash("1559028012-481c04fa702d"),
    views: views(["youtube", "340K"], ["linkedin", "96K"], ["x", "72K"]),
  },
  {
    alt: "Code editor on a laptop screen in a dark room",
    category: "feature",
    description: "A feature video showing deploys straight from the terminal.",
    src: unsplash("1555066931-4365d14bab8c"),
    views: views(["youtube", "210K"], ["x", "150K"], ["linkedin", "48K"]),
  },
  {
    alt: "Hand holding a phone in front of an open laptop",
    category: "feature",
    description: "A feature video for a new mobile app, filmed on the phone.",
    src: unsplash("1563986768609-322da13575f3"),
    views: views(["instagram", "1.8M"], ["youtube", "420K"], ["x", "96K"]),
  },
  {
    alt: "Hand sketching app wireframes on paper",
    category: "demo",
    description:
      "A product demo that walks new users through their first project.",
    src: unsplash("1581291518857-4e27b48ff24e"),
    views: views(["youtube", "120K"], ["linkedin", "35K"]),
  },
  {
    alt: "Team working on laptops around a wooden table",
    category: "demo",
    description: "A product demo of a team workspace, made for sales calls.",
    src: unsplash("1522071820081-009f0129c71c"),
    views: views(["linkedin", "140K"], ["youtube", "88K"]),
  },
  {
    alt: "Half-open laptop glowing in the dark",
    category: "demo",
    description:
      "A product demo of a writing tool, cut into short help videos.",
    src: unsplash("1531297484001-80022131f5a1"),
    views: views(["youtube", "64K"], ["x", "22K"]),
  },
  {
    alt: "Clapperboard held up against a desert sky",
    category: "teaser",
    description: "A short teaser released the week before launch.",
    src: unsplash("1485846234645-a62644f84728"),
    views: views(["youtube", "410K"], ["instagram", "260K"]),
  },
  {
    alt: "Camera body and two lenses on a dark surface",
    category: "teaser",
    description: "Three teasers that built a waitlist ahead of launch day.",
    src: unsplash("1516035069371-29a1b244cc32"),
    views: views(["instagram", "120K"], ["youtube", "88K"]),
  },
  {
    alt: "Video editing timeline on a monitor",
    category: "teaser",
    description: "A countdown teaser cut from the main launch film.",
    src: unsplash("1574717024653-61fd2cf4d44d"),
    views: views(["youtube", "120K"], ["x", "54K"], ["linkedin", "31K"]),
  },
];

const DEFAULT_LOGOS: ShowreelLogo[] = [
  { logo: <FigmaMark />, name: "Figma" },
  { logo: <SlackMark />, name: "Slack" },
  { logo: <SupabaseMark />, name: "Supabase" },
  { logo: <CloudflareMark />, name: "Cloudflare" },
  { logo: <AtlassianMark />, name: "Atlassian" },
  { logo: <AirtableMark />, name: "Airtable" },
  { logo: <AsanaMark />, name: "Asana" },
  { logo: <GitLabMark />, name: "GitLab" },
  { logo: <WebflowMark />, name: "Webflow" },
];

/** The marks, twice over, travelling exactly -50% so the loop has no seam. */
const LogoMarquee = ({
  label,
  logos,
}: {
  label: string;
  logos: ShowreelLogo[];
}) => (
  <div
    className="showreel-rise mt-10 flex w-full flex-col items-center lg:items-start"
    style={{ "--i": 6 } as CSSProperties}
  >
    <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
      {label}
    </p>
    <div
      aria-hidden
      className="showreel-logos relative mt-4 w-full overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_8%,#000_92%,transparent)]"
    >
      <div className="showreel-marquee flex w-max items-center">
        {[0, 1].map((copy) =>
          logos.map((logo) => (
            <span
              key={`${copy}-${logo.name}`}
              className="text-muted-foreground flex items-center gap-2 pr-10 text-[15px] font-semibold tracking-tight whitespace-nowrap [&_svg]:size-5 [&_svg]:shrink-0"
            >
              {logo.logo}
              {logo.name}
            </span>
          ))
        )}
      </div>
    </div>
    <p className="sr-only">
      {label}: {logos.map((logo) => logo.name).join(", ")}.
    </p>
  </div>
);

/* Plain links styled with the theme's tokens rather than <Button asChild>:
 * they're server-rendered, and need no client code to be links. */
/* Both actions: 44px tall on phones and 48px from @lg (over the 40px hit
 * area either way), and a 0.96 press so a click feels physical.
 * Transitions name their properties. */
const ACTION =
  "focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-medium sm:h-12 sm:text-[15px] whitespace-nowrap outline-none transition-[translate,scale,background-color,color,box-shadow,filter] duration-200 ease-out focus-visible:ring-[3px] active:translate-y-0 active:scale-[0.96] motion-reduce:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0";

/* The primary action, lit from above: a soft white sheen over the brand
 * colour, a hairline edge a shade darker than the fill, a white highlight
 * on the top inner edge and a faint shade on the bottom one. No drop shadow
 * or glow: it sits flat on the page. Hover brightens and lifts it; press
 * sets it down into its own shadow. */
const PRIMARY_ACTION = cn(
  // The arrow side gets 2px less padding, so the label doesn't look pushed
  // left by the icon's empty space.
  "group bg-primary text-primary-foreground pr-3.5 pl-4 sm:pr-5.5 sm:pl-6 [text-shadow:0_1px_0_rgb(0_0_0/0.18)]",
  "bg-linear-to-b from-white/20 to-white/0",
  "shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_72%,black),inset_0_1px_0_0_rgb(255_255_255/0.35),inset_0_-1px_0_0_rgb(0_0_0/0.16)]",
  "hover:-translate-y-px hover:brightness-110",
  "hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_72%,black),inset_0_1px_0_0_rgb(255_255_255/0.4),inset_0_-1px_0_0_rgb(0_0_0/0.16)]",
  "active:brightness-95 active:shadow-[0_0_0_1px_color-mix(in_oklab,var(--primary)_72%,black),inset_0_1px_3px_0_rgb(0_0_0/0.25)]"
);

/* The secondary action is edged with a shadow, not a border: a 1px ring,
 * a little lift and some ambient depth on light pages, a single white ring
 * on dark ones, where depth shadows don't show. Shadows sit on any
 * background; a solid border only suits the one it was picked for. */
const SECONDARY_ACTION = cn(
  "bg-background hover:bg-accent hover:text-accent-foreground px-4 sm:px-5",
  "shadow-[0_0_0_1px_rgba(0,0,0,0.08),0_1px_2px_-1px_rgba(0,0,0,0.08),0_2px_4px_0_rgba(0,0,0,0.04)]",
  "hover:shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_1px_2px_-1px_rgba(0,0,0,0.1),0_2px_4px_0_rgba(0,0,0,0.06)]",
  "dark:bg-input/30 dark:hover:bg-input/50 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.16)]"
);

/** The primary action carries the brand colour; the secondary stays quiet. */
const Actions = ({
  primary,
  secondary,
}: {
  primary?: ShowreelAction | null;
  secondary?: ShowreelAction | null;
}) =>
  primary || secondary ? (
    <div
      className="showreel-rise mt-8 flex flex-wrap items-center justify-center gap-2 sm:mt-9 sm:gap-3 lg:justify-start"
      style={{ "--i": 5 } as CSSProperties}
    >
      {primary ? (
        <a className={cn(ACTION, PRIMARY_ACTION)} href={primary.href}>
          {primary.label}
          <ArrowRight className="transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </a>
      ) : null}
      {secondary ? (
        <a className={cn(ACTION, SECONDARY_ACTION)} href={secondary.href}>
          {secondary.label}
        </a>
      ) : null}
    </div>
  ) : null;

export const ShowreelHero = ({
  autoplay = true,
  autoplayInterval = 5000,
  categories = DEFAULT_CATEGORIES,
  className,
  description = "We script, film and edit launch videos for software products, from the main film to short cuts for every channel.",
  eyebrow,
  headingLevel = 1,
  initialIndex = 0,
  logos = DEFAULT_LOGOS,
  logosLabel = "Trusted by",
  primaryAction = { href: "#contact", label: "Book a call" },
  reels = DEFAULT_REELS,
  secondaryAction = { href: "#process", label: "See how we work" },
  style,
  title = "Product launch videos",
  titleMuted = "that show what you built.",
  ...props
}: ShowreelHeroProps) => {
  const Heading = headingLevel === 2 ? "h2" : "h1";

  return (
    <section
      className={cn(
        // antialiased here, not only at the app root: a project that installs
        // just this block gets the same crisp text on macOS.
        "bg-background text-foreground relative isolate w-full overflow-clip antialiased",
        className
      )}
      data-slot="showreel-hero"
      style={
        {
          "--reel-caption-w": `${LAYOUT.captionWidth}px`,
          "--reel-copy-x": `${LAYOUT.copyX}px`,
          "--reel-narrow-step": `${NARROW.config.tangential}px`,
          "--reel-rim": `${LAYOUT.narrowRim}px`,
          ...style,
        } as CSSProperties
      }
      {...props}
    >
      <style>{CSS}</style>

      <div
        className={cn(
          // Narrow: the wheel above (mirrored), caption and copy below it.
          "relative flex flex-col pt-[calc(var(--reel-rim)*var(--reel-s)+7rem)] pb-14 sm:pb-16",
          "[--reel-s:0.8] md:[--reel-s:0.86]",
          // Wide: the wheel on the left edge, the copy beside it.
          "lg:min-h-[44rem] lg:flex-row lg:items-center lg:py-20 xl:min-h-[48rem]",
          "lg:[--reel-s:0.74] min-[72rem]:[--reel-s:0.82] xl:[--reel-s:0.9] min-[90rem]:[--reel-s:1]"
        )}
      >
        <ShowreelWheel
          autoplay={autoplay}
          autoplayInterval={autoplayInterval}
          categories={categories}
          initialIndex={initialIndex}
          label="Showreel"
          reels={reels}
        />
        {/* Wide: over the wheel and its captions, stopping short of the
            copy. Narrow: over the strip, running sideways. */}
        <FocusBlur
          band={WIDE.config.tangential / 2}
          className="inset-y-0 left-0 hidden w-[calc(var(--reel-copy-x)*var(--reel-s)-2rem)] lg:block"
          direction="to bottom"
        />
        <FocusBlur
          band={NARROW.config.tangential / 2}
          className="inset-x-0 top-0 h-[calc(var(--reel-rim)*var(--reel-s)+7rem)] lg:hidden"
          direction="to right"
        />

        {/* min-w-0: the looping logo track is thousands of pixels wide, and
            without it that width would hold the column open past the edge. */}
        <div className="relative z-30 flex min-w-0 flex-1 justify-center px-6 pt-8 sm:pt-10 lg:justify-start lg:pt-0 lg:pr-12 lg:pl-0 lg:ml-[calc(var(--reel-copy-x)*var(--reel-s))]">
          <div className="flex w-full max-w-xl flex-col items-center text-center lg:max-w-[34rem] lg:items-start lg:text-left">
            {eyebrow ? (
              <p
                className="showreel-rise text-primary text-xs font-medium tracking-[0.16em] uppercase"
                style={{ "--i": 2 } as CSSProperties}
              >
                {eyebrow}
              </p>
            ) : null}

            {/* One sentence, the muted half inline, so text-balance can split
                it into two even lines. The size follows the column (about
                1/11.6 of its width, the full width on narrow stages and the
                space beside the wheel on wide ones), which keeps the default
                title to two lines at every size. */}
            <Heading
              className={cn(
                "showreel-rise text-[clamp(1.625rem,7.4vw,3rem)] leading-[1.08] font-semibold tracking-[-0.025em] text-balance lg:text-[clamp(1.75rem,2.9vw,2.875rem)]",
                eyebrow ? "mt-5" : null
              )}
              style={{ "--i": 3 } as CSSProperties}
            >
              {title}
              {titleMuted ? (
                <>
                  {" "}
                  <span className="text-muted-foreground">{titleMuted}</span>
                </>
              ) : null}
            </Heading>

            {description ? (
              <p
                className="showreel-rise text-muted-foreground mt-5 max-w-[30rem] text-[15px] leading-relaxed text-pretty sm:mt-6 sm:text-base"
                style={{ "--i": 4 } as CSSProperties}
              >
                {description}
              </p>
            ) : null}

            <Actions primary={primaryAction} secondary={secondaryAction} />

            {logos.length > 0 ? (
              <LogoMarquee label={logosLabel} logos={logos} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ShowreelHero;
