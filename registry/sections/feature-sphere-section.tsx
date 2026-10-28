"use client";

import { useId, useRef, useState } from "react";
import type {
  ComponentProps,
  CSSProperties,
  KeyboardEvent,
  ReactNode,
} from "react";

import { cn } from "@/lib/utils";

import { ImageSphere } from "./image-sphere";
import type {
  ImageSphereGroup,
  ImageSphereItem,
  ImageSphereProps,
} from "./image-sphere";

/* ─────────────────────────────────────────────────────────────────────────
 * Feature index sphere. An editorial index of what you do, set large,
 * beside a live sphere of your images. One feature is open at a time: its
 * line comes forward, its description unfolds, and its images fly out of
 * the sphere into a pile while the rest of the sphere goes out of focus.
 *
 * CHOOSING A FEATURE (click or tap a line, or an image on the sphere)
 *
 *     0ms   the old line dims and thins; its description folds away
 *     0ms   the new line lights and thickens; its description unfolds
 *     0ms   the old pile flies home, the new feature's images set off
 *   ~900ms  the new pile has landed
 *
 * Every line and its description share one left edge. The sphere is the
 * image-sphere block (shipped alongside), driven through its `group` prop.
 * With reduced motion the index changes without easing.
 * ───────────────────────────────────────────────────────────────────────── */

/** The index's motion: one ease for every change, slow enough to read. */
const INDEX = {
  duration: 600,
  ease: "cubic-bezier(0.22, 1, 0.36, 1)",
} as const;

const TRANSITION = {
  "--index-duration": `${INDEX.duration}ms`,
  "--index-ease": INDEX.ease,
} as CSSProperties;

export interface FeatureImage {
  src: string;
  alt: string;
}

export interface SphereFeature {
  id: string;
  label: string;
  description: ReactNode;
  href?: string;
  /** This feature's images: they form its pile. */
  images: FeatureImage[];
}

export interface FeatureSphereSectionProps extends Omit<
  ComponentProps<"section">,
  "children" | "title"
> {
  /** The section's heading, for screen readers (the index is the visible title). */
  title?: string;
  features?: SphereFeature[];
  /** Images that belong to no feature: they fill out the sphere. */
  extraImages?: FeatureImage[];
  /** Text on each feature's link. */
  linkLabel?: string;
  /** The feature open at first, by id. Defaults to the first. */
  defaultFeature?: string;
  onFeatureChange?: (feature: string) => void;
  /** 1 when this is the page's main heading; 2 when the page has its own h1. */
  headingLevel?: 1 | 2;
  /** Which side the sphere sits on, on wide screens. Defaults to "right". */
  sphereSide?: "left" | "right";
  /**
   * Any of the image sphere's own options: `count`, `turnDuration`,
   * `pileSize`, `pileCurve`, `autoRotate`, `hint`, `className`, `aria-label`
   * and so on. The section sets its images, groups and open group itself.
   */
  sphere?: Omit<
    ImageSphereProps,
    "items" | "groups" | "group" | "defaultGroup" | "onGroupChange"
  >;
}

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=360&q=70`;

const photos = (list: [id: string, alt: string][]) =>
  list.map(([id, alt]): FeatureImage => ({ alt, src: unsplash(id) }));

const DEFAULT_FEATURES: SphereFeature[] = [
  {
    description:
      "Buildings and interiors, photographed and modelled before the first stone is laid.",
    href: "#",
    id: "architecture",
    images: photos([
      ["1486406146926-c627a92ad1ab", "Glass towers seen from street level"],
      ["1487958449943-2429e8be8625", "White angular building against the sky"],
      ["1449157291145-7efd050a4d0e", "Skyscrapers converging overhead"],
      ["1479839672679-a46483c0e7c8", "Stacked white apartment blocks"],
      ["1600585154340-be6161a56a0c", "Modern house and lawn at twilight"],
      ["1600607687939-ce8a6c25118c", "Bright open-plan living room"],
      ["1518005020951-eccb494ad742", "Curving blue and white facade"],
      ["1477959858617-67f85cf4f1df", "City skyline beside a lake"],
      ["1480714378408-67cf0d13bc1b", "Downtown towers at sunset"],
    ]),
    label: "Architecture",
  },
  {
    description:
      "Cabins, liveries and the quiet hours between departure and arrival.",
    href: "#",
    id: "aviation",
    images: photos([
      ["1436491865332-7a61a109cc05", "Aircraft wing above the clouds"],
      ["1529074963764-98f45c47344b", "Airliner in a blue sky"],
      ["1474302770737-173ee21bab63", "Private jet on the tarmac at sunset"],
      ["1569154941061-e231b4725ef1", "Airliner parked at the gate"],
      ["1556388158-158ea5ccacbd", "Plane coming in to land"],
      ["1488085061387-422e29b40080", "Wing at sunset through a cabin window"],
      ["1544016768-982d1554f0b9", "Airliner climbing overhead"],
      ["1517479149777-5f3b1511d5ad", "Wingtip over pink clouds"],
    ]),
    label: "Aviation",
  },
  {
    description: "Wind, sun and the grid, told as the landscapes they change.",
    href: "#",
    id: "energy",
    images: photos([
      ["1509391366360-2e959784a276", "Solar panels in a green field"],
      ["1466611653911-95081537e5b7", "Wind turbines at sunrise"],
      ["1532601224476-15c79f2f7a51", "Wind turbines on rolling hills"],
      ["1497440001374-f26997328c1b", "Solar panels on grass"],
      ["1473341304170-971dccb5ac1e", "Power lines at sunset"],
      ["1508514177221-188b1cf16e9d", "Rows of solar panels under a blue sky"],
      ["1548337138-e87d889cc369", "Offshore wind farm"],
      ["1497435334941-8c899ee9e8e9", "Solar farm from above"],
    ]),
    label: "Energy",
  },
  {
    description:
      "Labs, clinics and research, made legible to the people they serve.",
    href: "#",
    id: "healthcare",
    images: photos([
      ["1532094349884-543bc11b234d", "Glassware on a lab bench"],
      ["1576086213369-97a306d36557", "Cells under a fluorescence microscope"],
      ["1579154204601-01588f351e67", "Empty hospital laboratory"],
      ["1581093450021-4a7360e9a6b5", "Scientists at work in a lab"],
      ["1530026405186-ed1f139313f8", "Anatomical model of a heart"],
      ["1559757175-5700dde675bc", "Model of a brain and a neuron"],
      ["1582719471384-894fbb16e074", "Researcher at a microscope"],
      ["1631549916768-4119b2e5f926", "Blister packs of pills"],
    ]),
    label: "Healthcare",
  },
  {
    description:
      "Hardware and the code behind it, shown at the scale it's used.",
    href: "#",
    id: "technology",
    images: photos([
      ["1518770660439-4636190af475", "Close-up of a circuit board"],
      ["1550751827-4bd374c3f58b", "Glowing circuit traces"],
      ["1451187580459-43490279c0fa", "Earth at night from orbit"],
      ["1488590528505-98d2b5aba04b", "Code on a laptop screen"],
      ["1531297484001-80022131f5a1", "Laptop glowing in the dark"],
      ["1550745165-9bc0b252726f", "Retro computers in neon light"],
      ["1517694712202-14dd9538aa97", "Laptop with code on a desk"],
      ["1558494949-ef010cbdcc31", "Server rack cabling"],
    ]),
    label: "Technology",
  },
];

const DEFAULT_EXTRAS: FeatureImage[] = photos([
  ["1523275335684-37898b6baf30", "White smartwatch"],
  ["1505740420928-5e560c06d30e", "Headphones on yellow"],
  ["1542291026-7eec264c27ff", "Red running shoe"],
  ["1526170375885-4d8ecf77b99f", "Instant camera"],
  ["1572635196237-14b3f281503f", "Black sunglasses"],
  ["1560343090-f0409e92791a", "Teal leather shoe"],
  ["1586717791821-3f44a563fa4c", "Sketching on a tablet"],
  ["1561070791-2526d30994b5", "Colour swatches and charts"],
  ["1581291518857-4e27b48ff24e", "Sketching wireframes on paper"],
  ["1559028012-481c04fa702d", "Design tool on a large monitor"],
]);

const pad = (n: number) => String(n).padStart(2, "0");

const Heading = ({
  children,
  id,
  level,
}: {
  children: ReactNode;
  id: string;
  level: 1 | 2;
}) =>
  level === 1 ? (
    <h1 className="sr-only" id={id}>
      {children}
    </h1>
  ) : (
    <h2 className="sr-only" id={id}>
      {children}
    </h2>
  );

/** A feature's name is a heading one level under the section's. */
const FeatureHeading = ({
  children,
  level,
}: {
  children: ReactNode;
  level: 2 | 3;
}) => (level === 2 ? <h2>{children}</h2> : <h3>{children}</h3>);

/**
 * One line of the index: number, name, and when active, its story. An
 * accordion where one panel is always open: the open line's button is
 * aria-disabled (it can't close), and closed panels are inert, so their
 * text and link are neither read nor focusable while folded away.
 */
const IndexLine = ({
  active,
  feature,
  headingLevel,
  index,
  linkLabel,
  onSelect,
  buttonRef,
}: {
  active: boolean;
  feature: SphereFeature;
  headingLevel: 2 | 3;
  index: number;
  linkLabel: string;
  onSelect: () => void;
  buttonRef: (node: HTMLButtonElement | null) => void;
}) => {
  const panelId = useId();
  return (
    <li className="border-border/60 relative border-t first:border-t-0">
      {/* The count, pinned to the row's top-right corner. It repeats the
          list's own order, so it's hidden from screen readers. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-2.5 right-0 font-mono text-[0.6875rem] tracking-[0.08em] tabular-nums transition-colors duration-[var(--index-duration)] motion-reduce:transition-none lg:top-3.5",
          active ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {pad(index + 1)}
      </span>
      <FeatureHeading level={headingLevel}>
        <button
          ref={buttonRef}
          aria-controls={panelId}
          aria-disabled={active || undefined}
          aria-expanded={active}
          className="group/line focus-visible:outline-foreground flex w-full items-baseline py-1.5 pr-8 text-left outline-offset-4 focus-visible:outline-2 lg:py-2"
          onClick={onSelect}
          type="button"
        >
          <span
            className={cn(
              "text-[1.75rem] leading-[1.05] tracking-[-0.035em] [overflow-wrap:anywhere] transition-[color,font-weight] duration-[var(--index-duration)] ease-[var(--index-ease)] motion-reduce:transition-none sm:text-5xl lg:text-6xl xl:text-7xl",
              // Dimmed, but at 3:1 or more for large text in both themes.
              active
                ? "text-foreground font-semibold"
                : "text-muted-foreground/80 group-hover/line:text-muted-foreground font-light"
            )}
          >
            {feature.label}
          </span>
        </button>
      </FeatureHeading>

      {/* Unfolds under the active line, on the same left edge as the name. */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-[var(--index-duration)] ease-[var(--index-ease)] motion-reduce:transition-none",
          active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
        id={panelId}
        inert={!active}
      >
        {/* Padded inside the clip, so the link's focus ring isn't cut off. */}
        <div className="-mx-1 overflow-hidden px-1">
          <div className="flex flex-col gap-3 pt-1 pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-6 lg:pb-5">
            <p className="text-muted-foreground max-w-[22rem] text-sm leading-relaxed text-pretty sm:text-[0.9375rem]">
              {feature.description}
            </p>
            {feature.href ? (
              <a
                className="text-foreground focus-visible:outline-foreground inline-flex min-h-6 shrink-0 items-center gap-1.5 font-mono text-[0.6875rem] tracking-[0.08em] uppercase underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
                href={feature.href}
              >
                {linkLabel}
                <span className="sr-only">: {feature.label}</span>
                <span aria-hidden>→</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
};

export const FeatureSphereSection = ({
  title = "What we do",
  features = DEFAULT_FEATURES,
  extraImages = DEFAULT_EXTRAS,
  linkLabel = "View work",
  defaultFeature,
  onFeatureChange,
  headingLevel = 2,
  sphereSide = "right",
  sphere,
  className,
  style,
  ...props
}: FeatureSphereSectionProps) => {
  const titleId = useId();
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const [active, setActive] = useState(() =>
    Math.max(
      features.findIndex((f) => f.id === defaultFeature),
      0
    )
  );

  const select = (index: number) => {
    if (index < 0 || index === active) {
      return;
    }
    setActive(index);
    onFeatureChange?.(features[index].id);
  };

  // Tab moves through the index like any list of buttons; the arrow keys
  // also step between features, and Home and End jump to the ends (the
  // accordion pattern's optional keys).
  const onIndexKeyDown = (event: KeyboardEvent<HTMLOListElement>) => {
    const from = buttons.current.indexOf(event.target as HTMLButtonElement);
    if (from === -1) {
      return;
    }
    const last = features.length - 1;
    const to = {
      ArrowDown: from === last ? 0 : from + 1,
      ArrowUp: from === 0 ? last : from - 1,
      End: last,
      Home: 0,
    }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      buttons.current[to]?.focus();
    }
  };

  const sphereLeft = sphereSide === "left";

  // The sphere's items and groups, from the features.
  const groups: ImageSphereGroup[] = features.map((f) => ({
    id: f.id,
    label: f.label,
  }));
  const items: ImageSphereItem[] = [
    ...features.flatMap((f) =>
      f.images.map((image) => ({ ...image, group: f.id }))
    ),
    ...extraImages,
  ];

  return (
    // No fixed height: the index grows with its text (zoomed or enlarged
    // text is never clipped); the sphere has its own height.
    <section
      aria-labelledby={titleId}
      className={cn(
        "bg-background text-foreground grid lg:min-h-[48rem]",
        sphereLeft
          ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
          : "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]",
        className
      )}
      style={{ ...TRANSITION, ...style }}
      {...props}
    >
      <Heading id={titleId} level={headingLevel}>
        {title}
      </Heading>

      {/* The index. */}
      <div
        className={cn(
          "order-2 flex flex-col justify-center px-5 pt-2 pb-6 sm:px-8 lg:py-12",
          sphereLeft
            ? "lg:order-2 lg:pr-12 lg:pl-4 xl:pr-16"
            : "lg:order-1 lg:pr-4 lg:pl-12 xl:pl-16"
        )}
      >
        <ol onKeyDown={onIndexKeyDown}>
          {features.map((feature, k) => (
            <IndexLine
              key={feature.id}
              active={k === active}
              feature={feature}
              headingLevel={headingLevel === 1 ? 2 : 3}
              index={k}
              linkLabel={linkLabel}
              onSelect={() => select(k)}
              buttonRef={(node) => {
                buttons.current[k] = node;
              }}
            />
          ))}
        </ol>
      </div>

      {/* The sphere. */}
      <div
        className={cn(
          "relative order-1 h-[21rem] min-h-0 sm:h-[28rem] lg:h-auto",
          sphereLeft ? "lg:order-1" : "lg:order-2"
        )}
      >
        <ImageSphere
          aria-label="Images for each feature"
          hint={null}
          {...sphere}
          className={cn(
            "aspect-auto h-full sm:aspect-auto lg:aspect-auto",
            sphere?.className
          )}
          group={features[active]?.id ?? null}
          groups={groups}
          items={items}
          onGroupChange={(id) => {
            if (id) {
              select(features.findIndex((f) => f.id === id));
            }
          }}
        />
      </div>
    </section>
  );
};

export default FeatureSphereSection;
