import type { ComponentProps, CSSProperties, ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* ── Colour ────────────────────────────────────────────────────────────────
 * The section follows the host's shadcn theme, light or dark: background,
 * card, foreground and muted text are its own tokens. The drawings' surfaces
 * mix foreground into card, so they turn with the theme too. Each variable
 * reads the token first and falls back to shadcn's default, set on the
 * section's root rather than in globals.css. */
const DRAWING_VARS = {
  "--fs-face-top": "color-mix(in oklab, var(--fs-ink) 4%, var(--fs-paper))",
  "--fs-ink": "var(--foreground, oklch(0.145 0 0))",
  "--fs-paper": "var(--card, oklch(1 0 0))",
} as CSSProperties;

/* ── Drawings ──────────────────────────────────────────────────────────────
 * Each one is a small window from a developer's day (DevTools, the editor,
 * the analytics dashboard) on a 240 × 226 canvas. Each window runs past the
 * canvas's bottom edge and its last 16 units hold no content, so the card's
 * fade can dissolve the window there without dimming anything. Text is mono
 * and coloured like code; only what makes the claim is text, the rest are
 * plain shaded areas. */

interface DrawingProps {
  className?: string;
}

/* A miniature DevTools window: Network tab open, a file tree on the left
 * and the page's weight as a treemap on the right. Only what makes the point
 * carries text (the biggest tile, your file, the totals); the rest are plain
 * areas, each a shade of ink mixed into the card. Text is mono and coloured
 * like code: names as keywords, sizes as strings, your file as a function. */
const CODE_COLOURS = {
  keyword: "fill-pink-700 dark:fill-pink-400",
  name: "fill-violet-700 dark:fill-violet-400",
  tab: "fill-sky-700 dark:fill-sky-400",
  tabEdge: "stroke-sky-700 dark:stroke-sky-400",
  value: "fill-emerald-700 dark:fill-emerald-400",
  yours:
    "fill-emerald-600 stroke-emerald-600 dark:fill-emerald-400 dark:stroke-emerald-400",
};

const shade = (percent: number) => ({
  fill: `color-mix(in oklab, var(--fs-ink) ${percent}%, var(--fs-paper))`,
});

const DEVTOOLS_TABS = [
  { label: "Console", x: 12 },
  { label: "Sources", x: 58 },
  { active: true, label: "Network", x: 106 },
];

const TREEMAP_TILES = [
  { height: 66, shade: 13, width: 54, x: 176, y: 30 },
  { height: 80, shade: 10, width: 28, x: 176, y: 100 },
  { height: 42, shade: 16, width: 22, x: 208, y: 100 },
  { height: 14, shade: 12, width: 22, x: 208, y: 146 },
];

/** A disclosure triangle: pointing down when open, right when closed. */
const TreeArrow = ({
  open,
  x,
  y,
}: {
  open?: boolean;
  x: number;
  y: number;
}) => (
  <path
    d={open ? `M${x} ${y} h6 l-3 4 Z` : `M${x} ${y - 1} l4 3 l-4 3 Z`}
    fill="var(--fs-ink)"
    fillOpacity="0.6"
  />
);

const TREE_GLYPH = {
  cloud:
    "M3 7 h5.5 a2.5 2.5 0 0 0 0.3 -5 a3.5 3.5 0 0 0 -6.6 0.8 a2.2 2.2 0 0 0 0.8 4.2 Z",
  file: "M1 0 h4 l3 3 v6 h-7 Z",
  folder:
    "M0 1 a1 1 0 0 1 1 -1 h3 l1.5 1.5 h3.5 a1 1 0 0 1 1 1 v4.5 a1 1 0 0 1 -1 1 h-8 a1 1 0 0 1 -1 -1 Z",
};

const TreeGlyph = ({
  kind,
  x,
  y,
}: {
  kind: keyof typeof TREE_GLYPH;
  x: number;
  y: number;
}) => (
  <path
    d={TREE_GLYPH[kind]}
    stroke="var(--fs-ink)"
    strokeLinejoin="round"
    strokeOpacity="0.7"
    transform={`translate(${x} ${y})`}
  />
);

/** A DevTools window on the Network tab: your 0.9 KB file, a sliver of the page's 1.4 MB. */
export const FeatureBundleIcon = ({ className }: DrawingProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="226"
    viewBox="0 0 240 226"
    width="240"
  >
    {/* the window, filling the canvas: its corners and ring are the
        card's (the frame around the drawing), not the drawing's */}
    <rect fill="var(--fs-face-top)" height="226" width="240" />
    <g className="font-mono" fontSize="8.5" fontWeight="500">
      {/* tabs, Network active */}
      {DEVTOOLS_TABS.map((tab) => (
        <text
          className={tab.active ? CODE_COLOURS.tab : undefined}
          fill={tab.active ? undefined : "var(--fs-ink)"}
          fillOpacity={tab.active ? 1 : 0.6}
          key={tab.label}
          x={tab.x}
          y="16"
        >
          {tab.label}
        </text>
      ))}
      <rect className={CODE_COLOURS.tab} height="2" width="42" x="104" y="20" />
      {[8, 12, 16].map((cy) => (
        <circle
          cx="228"
          cy={cy}
          fill="var(--fs-ink)"
          fillOpacity="0.5"
          key={cy}
          r="0.9"
        />
      ))}
      <path d="M0 22 H240" stroke="var(--fs-ink)" strokeOpacity="0.12" />

      {/* file tree: localhost › _next › insights.js, then images and fonts */}
      <rect height="14" style={shade(9)} width="106" y="57" />
      <TreeArrow open x={8} y={33} />
      <TreeGlyph kind="cloud" x={17} y={30} />
      <text fill="var(--fs-ink)" x="31" y="38">
        localhost
      </text>
      <TreeArrow open x={16} y={47} />
      <TreeGlyph kind="folder" x={25} y={44} />
      <text fill="var(--fs-ink)" x="39" y="52">
        _next
      </text>
      <TreeGlyph kind="file" x={32} y={59} />
      <text className={CODE_COLOURS.name} fontWeight="600" x="43" y="66">
        insights.js
      </text>
      <TreeArrow x={17} y={76} />
      <TreeGlyph kind="folder" x={25} y={74} />
      <text fill="var(--fs-ink)" x="39" y="82">
        images
      </text>
      <TreeArrow x={17} y={90} />
      <TreeGlyph kind="folder" x={25} y={88} />
      <text fill="var(--fs-ink)" x="39" y="96">
        fonts
      </text>
      <path d="M106 22 V188" stroke="var(--fs-ink)" strokeOpacity="0.12" />

      {/* treemap: the biggest tile labelled, the rest plain, yours ringed */}
      <rect height="150" rx="3" style={shade(7)} width="58" x="114" y="30" />
      <text
        className={CODE_COLOURS.keyword}
        fontSize="10"
        fontWeight="600"
        x="120"
        y="46"
      >
        images
      </text>
      <text
        className={CODE_COLOURS.value}
        fontSize="9.5"
        fontWeight="600"
        x="120"
        y="59"
      >
        820 KB
      </text>
      {TREEMAP_TILES.map((tile) => (
        <rect
          height={tile.height}
          key={`${tile.x}-${tile.y}`}
          rx="3"
          style={shade(tile.shade)}
          width={tile.width}
          x={tile.x}
          y={tile.y}
        />
      ))}
      <circle
        className={CODE_COLOURS.yours}
        cx="219"
        cy="171"
        fillOpacity="0"
        r="7"
        strokeOpacity="0.5"
        strokeWidth="1.5"
      />
      <rect
        className={CODE_COLOURS.yours}
        height="6"
        rx="1.5"
        strokeWidth="0"
        width="6"
        x="216"
        y="168"
      />

      {/* status bar: the whole claim in one line */}
      <path d="M0 188 H240" stroke="var(--fs-ink)" strokeOpacity="0.12" />
      <g fontSize="9.5" fontWeight="600">
        <text className={CODE_COLOURS.name} x="12" y="201">
          insights.js
        </text>
        <text className={CODE_COLOURS.value} x="82" y="201">
          0.9 KB
        </text>
        <text
          fill="var(--fs-ink)"
          fillOpacity="0.55"
          fontWeight="500"
          textAnchor="end"
          x="228"
          y="201"
        >
          of 1.4 MB
        </text>
      </g>
    </g>
  </svg>
);

/* Two layers: behind, filling the canvas, the editor with layout.tsx open,
 * its code real and small and the one added line highlighted; on top, in
 * the bottom-right corner, the deployment it shipped, carrying the time it
 * took from edit to live, with a small clock. */
type CodeToken = [text: string, kind?: keyof typeof CODE_COLOURS];

/* layout.tsx, line by line: each line is its indent (in characters) and
 * its tokens, coloured like code (no kind is plain ink). */
const LAYOUT_CODE: { indent: number; tokens: CodeToken[] }[] = [
  {
    indent: 0,
    tokens: [
      ["import ", "keyword"],
      ["Script "],
      ["from ", "keyword"],
      ['"next/script"', "value"],
      [";"],
    ],
  },
  { indent: 0, tokens: [] },
  {
    indent: 0,
    tokens: [
      ["export default function ", "keyword"],
      ["Layout", "name"],
      ["({ children }) {"],
    ],
  },
  { indent: 2, tokens: [["return ", "keyword"], ["("]] },
  {
    indent: 4,
    tokens: [
      ["<"],
      ["html", "tab"],
      [" lang", "name"],
      ["="],
      ['"en"', "value"],
      [">"],
    ],
  },
  { indent: 6, tokens: [["<"], ["body", "tab"], [">"]] },
  { indent: 8, tokens: [["{children}"]] },
  {
    indent: 8,
    tokens: [
      ["<"],
      ["Script", "keyword"],
      [" src", "name"],
      ["="],
      ['"/insights.js"', "value"],
      [" />"],
    ],
  },
  { indent: 6, tokens: [["</"], ["body", "tab"], [">"]] },
  { indent: 4, tokens: [["</"], ["html", "tab"], [">"]] },
  { indent: 2, tokens: [[");"]] },
  { indent: 0, tokens: [["}"]] },
];

/** The added line, 1-based. */
const ADDED_LINE = 8;
const CODE_CHAR = 4.2;
const codeLineY = (line: number) => 38 + (line - 1) * 10.5;

/** The editor with layout.tsx open and `<Script src="/insights.js" />` just added; on top, the deployment it shipped: Deployed, in 4m 52s. */
export const FeatureDeployIcon = ({ className }: DrawingProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="226"
    viewBox="0 0 240 226"
    width="240"
  >
    <g className="font-mono">
      {/* the editor, filling the canvas: corners and ring from the card */}
      <rect fill="var(--fs-face-top)" height="226" width="240" />
      {/* tab bar: layout.tsx open, its top edge lit */}
      <path d="M94 0 H240 V22 H94 Z" style={shade(7)} />
      <path d="M94 0 V22 H240" stroke="var(--fs-ink)" strokeOpacity="0.12" />
      <path
        className={CODE_COLOURS.tabEdge}
        d="M0 0.75 H94"
        strokeWidth="1.5"
      />
      <rect
        className={CODE_COLOURS.tab}
        height="6"
        rx="1.5"
        width="6"
        x="12"
        y="9"
      />
      <text fill="var(--fs-ink)" fontSize="8.5" x="23" y="15">
        layout.tsx
      </text>
      <path
        d="M80 10 l5 5 M85 10 l-5 5"
        stroke="var(--fs-ink)"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />

      {/* the code: small and real, the added line highlighted */}
      <rect
        className="fill-emerald-500/15 dark:fill-emerald-400/15"
        height="10.5"
        width="240"
        x="0"
        y={codeLineY(ADDED_LINE) - 7.5}
      />
      <rect
        className={CODE_COLOURS.yours}
        height="10.5"
        strokeWidth="0"
        width="2"
        x="0"
        y={codeLineY(ADDED_LINE) - 7.5}
      />
      {LAYOUT_CODE.map((line, index) => {
        const number = index + 1;
        const added = number === ADDED_LINE;
        return (
          <g fontSize="7" key={number}>
            <text
              fill="var(--fs-ink)"
              fillOpacity={added ? 0.9 : 0.35}
              fontSize="6.5"
              textAnchor="end"
              x="20"
              y={codeLineY(number)}
            >
              {number}
            </text>
            <text
              fill="var(--fs-ink)"
              style={{ whiteSpace: "pre" }}
              x={28 + line.indent * CODE_CHAR}
              y={codeLineY(number)}
            >
              {line.tokens.map(([text, kind], tokenIndex) => (
                <tspan
                  className={kind ? CODE_COLOURS[kind] : undefined}
                  fillOpacity={kind ? 1 : 0.75}
                  key={tokenIndex}
                >
                  {text}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}

      {/* status bar: branch and cursor */}
      <path d="M0 194 H240" stroke="var(--fs-ink)" strokeOpacity="0.12" />
      <g fill="var(--fs-ink)" fillOpacity="0.55" fontSize="6.5">
        <text x="12" y="203.5">
          main
        </text>
        <text x="40" y="203.5">
          Ln 8, Col 9
        </text>
      </g>

      {/* the deployment on top, bottom right, with the time it took: a
          shadow ring (and lift in light mode) instead of a border */}
      <rect
        className="stroke-black/[0.06] [filter:drop-shadow(0_1px_2px_oklch(0_0_0/0.06))_drop-shadow(0_2px_4px_oklch(0_0_0/0.04))] dark:stroke-white/[0.08] dark:[filter:none]"
        fill="var(--fs-paper)"
        height="80"
        rx="9"
        width="124"
        x="108"
        y="118"
      />
      <circle
        className={CODE_COLOURS.yours}
        cx="120"
        cy="130"
        fillOpacity="0"
        r="5.5"
        strokeOpacity="0.35"
        strokeWidth="1.25"
      />
      <circle
        className={CODE_COLOURS.yours}
        cx="120"
        cy="130"
        r="2.75"
        strokeWidth="0"
      />
      <text
        className={CODE_COLOURS.value}
        fontSize="9"
        fontWeight="600"
        x="130"
        y="133.5"
      >
        Deployed
      </text>
      <path d="M108 142 H232" stroke="var(--fs-ink)" strokeOpacity="0.12" />
      <text fill="var(--fs-ink)" fontSize="8" fontWeight="600" x="118" y="156">
        insights-site
      </text>
      <text
        fill="var(--fs-ink)"
        fillOpacity="0.55"
        fontSize="7"
        x="118"
        y="167"
      >
        Production · main
      </text>
      <rect
        className="fill-emerald-500/15 dark:fill-emerald-400/15"
        height="14"
        rx="7"
        width="56"
        x="116"
        y="175"
      />
      <circle
        className={CODE_COLOURS.yours}
        cx="125"
        cy="182"
        fillOpacity="0"
        r="3.5"
        strokeWidth="1"
      />
      <path
        className={CODE_COLOURS.yours}
        d="M125 182 V179.6 M125 182 L126.3 180"
        strokeLinecap="round"
        strokeWidth="1"
      />
      <text
        className={CODE_COLOURS.value}
        fontSize="8"
        fontWeight="600"
        x="132"
        y="185"
      >
        4m 52s
      </text>
      <text
        fill="var(--fs-ink)"
        fillOpacity="0.55"
        fontSize="7"
        textAnchor="end"
        x="224"
        y="185"
      >
        just now
      </text>
    </g>
  </svg>
);

/* An analytics dashboard on the Journeys tab: one visitor (who they are,
 * where they came from) and their session as an ordered stream of events on
 * a dotted rail, ending in the sign-up. Each row is its time, its type and
 * what it was, coloured like code; each step's dot takes its detail's colour. */
const JOURNEY_TABS = [
  { label: "Sessions", x: 12 },
  { label: "Funnels", x: 66 },
  { active: true, label: "Journeys", x: 116 },
];

/* The dot's colour for each kind of detail, matching its text. */
const STEP_DOT = {
  name: "stroke-violet-600 dark:stroke-violet-400",
  tab: "stroke-sky-600 dark:stroke-sky-400",
  value: "stroke-emerald-600 dark:stroke-emerald-400",
} as const;

const JOURNEY_EVENTS: {
  detail: string;
  kind: keyof typeof STEP_DOT;
  time: string;
  type: string;
}[] = [
  { detail: "/", kind: "name", time: "10:02:14", type: "pageview" },
  { detail: "/pricing", kind: "name", time: "10:02:31", type: "pageview" },
  { detail: '"Start trial"', kind: "value", time: "10:02:47", type: "click" },
  { detail: "signup_started", kind: "tab", time: "10:03:05", type: "event" },
  { detail: "converted", kind: "value", time: "10:04:12", type: "sign-up" },
];

const JOURNEY_TOP = 74;
const JOURNEY_GAP = 30;
const eventY = (index: number) => JOURNEY_TOP + index * JOURNEY_GAP;

/* The referrer's mark: Google's G as four arcs and a bar, in its own colours
 * (they read on light and dark alike). Arcs run clockwise from 12 o'clock. */
const G_ARCS = [
  { colour: "#EA4335", from: 290, to: 410 },
  { colour: "#FBBC05", from: 235, to: 290 },
  { colour: "#34A853", from: 125, to: 235 },
  { colour: "#4285F4", from: 90, to: 125 },
];

const GoogleMark = ({ cx, cy }: { cx: number; cy: number }) => {
  const r = 4.2;
  const at = (degrees: number) => {
    const angle = (degrees * Math.PI) / 180;
    return `${cx + r * Math.sin(angle)} ${cy - r * Math.cos(angle)}`;
  };
  return (
    <g strokeWidth="2.2">
      {G_ARCS.map((arc) => (
        <path
          d={`M${at(arc.from)} A${r} ${r} 0 ${arc.to - arc.from > 180 ? 1 : 0} 1 ${at(arc.to)}`}
          key={arc.colour}
          stroke={arc.colour}
        />
      ))}
      <path d={`M${cx} ${cy} H${cx + r + 1.1}`} stroke="#4285F4" />
    </g>
  );
};

/** An analytics dashboard following one visitor from Google: pageview, pageview, click, event, sign-up, each timestamped, in order. */
export const FeatureJourneyIcon = ({ className }: DrawingProps) => {
  const last = JOURNEY_EVENTS.length - 1;
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      height="226"
      viewBox="0 0 240 226"
      width="240"
    >
      {/* the dashboard, filling the canvas: corners and ring from the card */}
      <rect fill="var(--fs-face-top)" height="226" width="240" />
      <g className="font-mono" fontSize="8.5" fontWeight="500">
        {/* tabs, Journeys active */}
        {JOURNEY_TABS.map((tab) => (
          <text
            className={tab.active ? CODE_COLOURS.tab : undefined}
            fill={tab.active ? undefined : "var(--fs-ink)"}
            fillOpacity={tab.active ? 1 : 0.6}
            key={tab.label}
            x={tab.x}
            y="16"
          >
            {tab.label}
          </text>
        ))}
        <rect
          className={CODE_COLOURS.tab}
          height="2"
          width="46"
          x="114"
          y="20"
        />
        {[8, 12, 16].map((cy) => (
          <circle
            cx="228"
            cy={cy}
            fill="var(--fs-ink)"
            fillOpacity="0.5"
            key={cy}
            r="0.9"
          />
        ))}
        <path d="M0 22 H240" stroke="var(--fs-ink)" strokeOpacity="0.12" />

        {/* the visitor: who, where from; and the referrer */}
        <text fill="var(--fs-ink)" fontWeight="600" x="12" y="37">
          visitor #4821
        </text>
        <text
          fill="var(--fs-ink)"
          fillOpacity="0.55"
          fontSize="7"
          x="12"
          y="48"
        >
          Berlin · Chrome on macOS
        </text>
        <GoogleMark cx={188} cy={39} />
        <text
          fill="var(--fs-ink)"
          fillOpacity="0.75"
          textAnchor="end"
          x="228"
          y="42"
        >
          Google
        </text>
        <path d="M0 56 H240" stroke="var(--fs-ink)" strokeOpacity="0.12" />

        {/* the events, in order, on a dotted rail; the sign-up highlighted */}
        <rect
          className="fill-emerald-500/15 dark:fill-emerald-400/15"
          height="18"
          width="240"
          x="0"
          y={eventY(last) - 12}
        />
        <path
          className="stroke-violet-400/60 dark:stroke-violet-300/40"
          d={`M16 ${eventY(0) - 3} V${eventY(last) - 3}`}
          strokeDasharray="0.5 4"
          strokeLinecap="round"
          strokeWidth="1.75"
        />
        {JOURNEY_EVENTS.map((event, index) => {
          const y = eventY(index);
          const converted = index === last;
          return (
            <g fontSize="8" key={event.time}>
              {converted ? (
                <>
                  <circle
                    className={CODE_COLOURS.yours}
                    cx="16"
                    cy={y - 3}
                    fillOpacity="0"
                    r="6"
                    strokeOpacity="0.4"
                    strokeWidth="1.25"
                  />
                  <circle
                    className={CODE_COLOURS.yours}
                    cx="16"
                    cy={y - 3}
                    r="3.25"
                    strokeWidth="0"
                  />
                </>
              ) : (
                <circle
                  className={STEP_DOT[event.kind]}
                  cx="16"
                  cy={y - 3}
                  fill="var(--fs-face-top)"
                  r="3"
                  strokeWidth="1.5"
                />
              )}
              <text
                fill="var(--fs-ink)"
                fillOpacity="0.55"
                fontSize="7.5"
                x="28"
                y={y}
              >
                {event.time}
              </text>
              <text
                className={CODE_COLOURS.keyword}
                fontWeight="600"
                x="72"
                y={y}
              >
                {event.type}
              </text>
              <text
                className={CODE_COLOURS[event.kind]}
                fontWeight={converted ? 600 : 500}
                x="124"
                y={y}
              >
                {event.detail}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
};

const ArrowIcon = ({ className }: DrawingProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill="none"
    height="16"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.75"
    viewBox="0 0 16 16"
    width="16"
  >
    <path d="M3 8 H13 M9 4 L13 8 L9 12" />
  </svg>
);

/* ── Content ───────────────────────────────────────────────────────────── */

export interface FeatureSection02Item {
  /** Unique id: the list keys on it. */
  id: string;
  /** The card's title. Lead with the number or the result when there is one: "Under 1KB", "Live in 5 minutes". */
  title: string;
  /** One or two short sentences under the title, about 80 characters at most, so every card's title lines up. */
  description: string;
  /** The drawing above the title. Use `FeatureBundleIcon`, `FeatureDeployIcon` or `FeatureJourneyIcon` from this file, or any SVG that shows the card's claim, drawn on a 240 × 226 canvas with its content in the top 210: the card scales it to its width and fades the bottom. */
  icon: ReactNode;
  /** Where the card leads, e.g. "/docs/install". The whole card becomes a link, with an arrow after the title. Leave it out for a plain card. */
  href?: string;
}

const FEATURES: FeatureSection02Item[] = [
  {
    description:
      "One tiny script. Page speed and Core Web Vitals stay exactly where they are.",
    icon: <FeatureBundleIcon />,
    id: "under-1kb",
    title: "Under 1KB",
  },
  {
    description:
      "Paste one script tag. No tag manager, no config files, no build step.",
    icon: <FeatureDeployIcon />,
    id: "live-in-5-minutes",
    title: "Live in 5 minutes",
  },
  {
    description:
      "Each pageview, click and event in sequence, from first visit to sign-up.",
    icon: <FeatureJourneyIcon />,
    id: "every-step-in-order",
    title: "Every step, in order",
  },
];

export interface FeatureSection02Props extends Omit<
  ComponentProps<"section">,
  "title"
> {
  /** The big line above the cards: the outcome the features add up to. Defaults to "See every visitor's journey without slowing your site down." */
  heading?: ReactNode;
  /** The cards, in order. Three fill a row on tablets and desktops; phones stack them. */
  features?: FeatureSection02Item[];
  /** The heading's level: 1 when this is the page's main heading, 2 or 3 to fit under the page's own. The card titles take the next level. Defaults to 2. */
  headingLevel?: 1 | 2 | 3;
}

const FeatureSection02 = ({
  className,
  heading = "See every visitor’s journey without slowing your site down.",
  features = FEATURES,
  headingLevel = 2,
  style,
  ...props
}: FeatureSection02Props) => {
  const HeadingTag = `h${headingLevel}` as const;
  const TitleTag = `h${headingLevel + 1}` as "h2" | "h3" | "h4";

  return (
    <section
      data-slot="feature-section-02"
      className={cn("w-full bg-background text-foreground", className)}
      style={{ ...DRAWING_VARS, ...style }}
      {...props}
    >
      <div className="mx-auto max-w-300 px-5 py-16 sm:px-8 sm:py-20 md:px-10 lg:px-12 lg:pt-32 lg:pb-24 xl:px-0 xl:pt-41 xl:pb-25">
        <HeadingTag className="max-w-250 text-4xl leading-[1.05] font-medium tracking-[-0.04em] text-pretty sm:text-5xl md:text-[3.5rem] lg:text-[4rem] lg:leading-none">
          {heading}
        </HeadingTag>

        <ul className="mt-10 grid gap-4 sm:mt-12 md:grid-cols-3 lg:mt-16 lg:gap-5">
          {features.map((feature) => (
            <li key={feature.id}>
              <Card
                className={cn(
                  "group/card relative h-full gap-0 overflow-hidden rounded-[calc(var(--radius,0.625rem)*2.4)] border border-transparent py-0 shadow-[0_0_0_1px_oklch(0_0_0/0.06),0_1px_2px_-1px_oklch(0_0_0/0.06),0_2px_4px_0_oklch(0_0_0/0.04)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.08)]",
                  feature.href &&
                    "transition-colors has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-2 has-[a:focus-visible]:outline-ring has-[a:hover]:bg-accent"
                )}
              >
                {/* The drawing keeps its 240 × 226 shape at the card's width,
                    with the same padding on every side; the card's height
                    follows, so all three match. Two nested surfaces, each
                    ringed by a shadow instead of a border:
                      window  the theme's radius-xl, its own corners and
                              ring (the drawing's SVG has none), so the
                              radius doesn't scale with the drawing
                      frame   radius-xl + its 6px padding: concentric with
                              the window at any theme radius; an inset ring,
                              since its fade (mask) clips anything outside
                    The frame fades out over its last 7%: the empty 16 units
                    under the drawing's content. The card itself keeps its
                    theme radius: text sits below, so its inset isn't even. */}
                <div className="relative p-4 md:p-3 lg:p-5">
                  <div className="rounded-[calc(var(--radius-xl)+0.375rem)] bg-muted/40 p-1.5 pb-0 shadow-[inset_0_0_0_1px_oklch(0_0_0/0.06)] [mask-image:linear-gradient(to_top,transparent,black_7%)] dark:shadow-[inset_0_0_0_1px_oklch(1_0_0/0.08)]">
                    <div className="aspect-[240/226] overflow-hidden rounded-xl shadow-[0_0_0_1px_oklch(0_0_0/0.06),0_1px_2px_-1px_oklch(0_0_0/0.06),0_2px_4px_0_oklch(0_0_0/0.04)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.08)] [&>svg]:size-full">
                      {feature.icon}
                    </div>
                  </div>
                </div>
                <CardContent className="relative px-6 pt-3 pb-6 sm:px-8 sm:pt-4 sm:pb-8 md:px-5 md:pt-3 md:pb-6 lg:px-10 lg:pt-5 lg:pb-7.5">
                  <CardTitle className="text-2xl leading-tight font-medium tracking-[-0.02em] sm:text-[1.75rem] md:text-xl lg:text-[2rem] lg:leading-normal">
                    <TitleTag>
                      {feature.href ? (
                        // The link stretches over the whole card (::after),
                        // so the card is one target but reads as a heading.
                        <a
                          className="inline-flex items-center gap-2 outline-none after:absolute after:inset-0"
                          href={feature.href}
                        >
                          {feature.title}
                          <ArrowIcon className="size-[0.75em] shrink-0 motion-safe:transition-transform group-has-[a:hover]/card:translate-x-0.5" />
                        </a>
                      ) : (
                        feature.title
                      )}
                    </TitleTag>
                  </CardTitle>
                  {/* Room for the longest description (two lines, three in
                      the narrow tablet cards), so every card's title sits
                      at the same height. */}
                  <CardDescription className="mt-1 min-h-[2lh] text-sm leading-normal contrast-more:text-foreground sm:text-base md:min-h-[3lh] md:text-sm lg:min-h-[2lh] lg:text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default FeatureSection02;
