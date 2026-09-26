"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TYPE, TYPE_ROLES, TYPE_SIZES } from "@/constants/typography";
import { cn } from "@/lib/utils";

const COLOR_GROUPS: { label: string; tokens: string[] }[] = [
  {
    label: "Brand",
    tokens: ["brand", "brand-foreground", "primary", "primary-foreground"],
  },
  {
    label: "Surface",
    tokens: [
      "background",
      "foreground",
      "card",
      "popover",
      "secondary",
      "muted",
      "muted-foreground",
      "accent",
    ],
  },
  {
    label: "Lines & state",
    tokens: ["border", "input", "ring", "destructive", "selection"],
  },
  {
    label: "Chart",
    tokens: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
  },
];

// Sample copy per role. Roles themselves are discovered from globals.css, so a
// new role still shows up here (with fallback copy) before it gets a sample.
const TYPE_SAMPLES: Record<string, { text: string; uppercase?: boolean }> = {
  "card-body": { text: "Market orders execute at the current price." },
  "card-caption": { text: "Apr 15, 2024" },
  "card-description": { text: "Last 6 months of activity" },
  "card-eyebrow": { text: "Auto-save plan", uppercase: true },
  "card-header": { text: "Contribution History" },
  "card-label": { text: "Amount to Transfer" },
  "card-metric": { text: "$420,000" },
  "card-metric-hero": { text: "$24,000" },
  "heading-display": { text: "Design Admin" },
  "heading-hero": { text: "Build apps that look designed." },
  "heading-panel": { text: "Design tokens" },
  "heading-section": { text: "Finance kit" },
  "page-lead": { text: "Every token, rebuilt on shadcn." },
};

const USAGE_SUFFIX = "-usage";

// Collect every `--{role}-usage` declared on :root, in source order. That
// makes styles/globals.css the single source of truth for the table.
const discoverTypeRoles = () => {
  const roles: string[] = [];

  const walk = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule && rule.selectorText.includes(":root")) {
        for (const name of rule.style) {
          const role =
            name.startsWith("--") && name.endsWith(USAGE_SUFFIX)
              ? name.slice(2, -USAGE_SUFFIX.length)
              : null;

          if (role && !roles.includes(role)) {
            roles.push(role);
          }
        }
      }

      if ("cssRules" in rule && rule.cssRules instanceof CSSRuleList) {
        walk(rule.cssRules);
      }
    }
  };

  for (const sheet of document.styleSheets) {
    try {
      walk(sheet.cssRules);
    } catch {
      // Cross-origin stylesheets can't be read; tokens live in our own CSS.
    }
  }

  return roles.length > 0 ? roles : [...TYPE_ROLES];
};

// A role is "wired" when Tailwind generated its class (registered in
// @theme inline) and it's listed in TYPE_ROLES for tailwind-merge.
const isClassGenerated = (role: string) => {
  const probe = document.createElement("span");
  const reference = document.createElement("span");
  probe.className = `text-${role}-sm`;
  reference.style.fontSize = `var(--${role}-sm)`;
  document.body.append(probe, reference);
  const generated =
    getComputedStyle(probe).fontSize === getComputedStyle(reference).fontSize;
  probe.remove();
  reference.remove();

  return generated;
};

const unquote = (value: string) => value.replaceAll(/^["']|["']$/g, "");

interface TypeRoleRow {
  role: string;
  usage: string;
  weight: string;
  sizes: Record<(typeof TYPE_SIZES)[number], string>;
  inTypeConstants: boolean;
  classGenerated: boolean;
}

// Tailwind's md / lg breakpoints, used to highlight the live column.
const BREAKPOINT_QUERIES = {
  lg: "(min-width: 64rem)",
  md: "(min-width: 48rem)",
} as const;

const useActiveSize = () => {
  const [size, setSize] = React.useState<(typeof TYPE_SIZES)[number]>("sm");

  React.useEffect(() => {
    const lg = window.matchMedia(BREAKPOINT_QUERIES.lg);
    const md = window.matchMedia(BREAKPOINT_QUERIES.md);
    const update = () => {
      if (lg.matches) {
        setSize("lg");
      } else if (md.matches) {
        setSize("md");
      } else {
        setSize("sm");
      }
    };
    update();
    lg.addEventListener("change", update);
    md.addEventListener("change", update);

    return () => {
      lg.removeEventListener("change", update);
      md.removeEventListener("change", update);
    };
  }, []);

  return size;
};

const SPACING_STEPS = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 10];

const RADII = [
  { className: "rounded-sm", token: "--radius-sm" },
  { className: "rounded-md", token: "--radius-md" },
  { className: "rounded-lg", token: "--radius-lg" },
  { className: "rounded-xl", token: "--radius-xl" },
  { className: "rounded-2xl", token: "--radius-2xl" },
  { className: "rounded-full", token: "--radius-full" },
];

const SHADOWS = [
  { className: "shadow-border", token: "--surface-border" },
  { className: "shadow-border-hover", token: "--surface-border-hover" },
  { className: "shadow-elevated", token: "--surface-elevated" },
];

// Browsers serialise resolved colors as lab()/oklab(); paint one pixel to get
// a readable hex (+ alpha) for the label, keeping the raw value in the title.
let colorCanvas: CanvasRenderingContext2D | null = null;

const toHex = (color: string) => {
  if (!color) {
    return "";
  }

  colorCanvas ??= document
    .createElement("canvas")
    .getContext("2d", { willReadFrequently: true });

  if (!colorCanvas) {
    return color;
  }

  const sample = (fill: string) => {
    colorCanvas?.clearRect(0, 0, 1, 1);

    if (colorCanvas) {
      colorCanvas.fillStyle = fill;
      colorCanvas.fillRect(0, 0, 1, 1);
    }

    return colorCanvas?.getImageData(0, 0, 1, 1).data ?? [0, 0, 0, 0];
  };

  // Read the alpha from the real color, but the channels from an opaque copy:
  // translucent pixels lose precision when read back (white 10% → #F5FFFF).
  const a = sample(color).at(-1) ?? 0;
  const [r, g, b] = sample(`rgb(from ${color} r g b / 1)`);
  const hex = [r, g, b]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return a === 255 ? `#${hex}` : `#${hex} · ${Math.round((a / 255) * 100)}%`;
};

const toRem = (px: string, root: number) => {
  const value = Number.parseFloat(px);

  if (Number.isNaN(value)) {
    return px;
  }

  return `${Number((value / root).toFixed(4))}rem`;
};

// Re-reads computed values whenever the theme class/style on <html> changes,
// so edits to globals.css (HMR) and light/dark switches show up live.
const useComputedSnapshot = <T,>(read: () => T, initial: T) => {
  const [snapshot, setSnapshot] = React.useState<T>(initial);
  const readRef = React.useRef(read);
  readRef.current = read;

  React.useEffect(() => {
    const update = () => setSnapshot(readRef.current());
    update();

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributeFilter: ["class", "style", "data-theme"],
      attributes: true,
    });
    observer.observe(document.body, {
      attributeFilter: ["class", "style"],
      attributes: true,
    });
    observer.observe(document.head, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return snapshot;
};

const SectionLabel = ({
  children,
  index,
}: {
  children: React.ReactNode;
  index: string;
}) => (
  <div className="flex items-baseline gap-2">
    <span
      className={cn(
        TYPE.cardCaption,
        "text-muted-foreground font-mono tabular-nums"
      )}
    >
      {index}
    </span>
    <h3 className={TYPE.cardLabel}>{children}</h3>
  </div>
);

const ColorTokens = () => {
  const ref = React.useRef<HTMLDivElement>(null);
  const values = useComputedSnapshot<
    Record<string, { hex: string; raw: string }>
  >(() => {
    if (!ref.current) {
      return {};
    }

    const styles = getComputedStyle(ref.current);

    return Object.fromEntries(
      COLOR_GROUPS.flatMap((group) => group.tokens).map((token) => {
        const raw = styles.getPropertyValue(`--${token}`).trim();

        return [token, { hex: toHex(raw), raw }];
      })
    );
  }, {});

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <SectionLabel index="01">Color</SectionLabel>
      <div className="flex flex-col gap-5">
        {COLOR_GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-2">
            <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
              {group.label}
            </span>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
              {group.tokens.map((token) => (
                <div key={token} className="flex min-w-0 flex-col gap-1.5">
                  <div
                    className="h-12 rounded-lg shadow-border"
                    style={{ background: `var(--${token})` }}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={cn(TYPE.cardCaption, "truncate font-mono")}
                    >
                      --{token}
                    </span>
                    <span
                      className={cn(
                        TYPE.cardCaption,
                        "text-muted-foreground truncate tabular-nums"
                      )}
                      title={values[token]?.raw}
                    >
                      {values[token]?.hex || "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TYPE_TABLE_COLUMNS =
  "grid grid-cols-[9rem_15rem_repeat(3,7.5rem)_1fr] gap-3";

const TypeTokens = () => {
  const active = useActiveSize();
  const rows = useComputedSnapshot<TypeRoleRow[]>(() => {
    const styles = getComputedStyle(document.documentElement);
    const read = (name: string) => styles.getPropertyValue(name).trim();

    return discoverTypeRoles().map((role) => ({
      classGenerated: isClassGenerated(role),
      inTypeConstants: (TYPE_ROLES as readonly string[]).includes(role),
      role,
      sizes: Object.fromEntries(
        TYPE_SIZES.map((size) => [
          size,
          `${read(`--${role}-${size}`)} / ${read(`--${role}-${size}-leading`)}`,
        ])
      ) as TypeRoleRow["sizes"],
      usage: unquote(read(`--${role}${USAGE_SUFFIX}`)),
      weight: read(`--${role}-weight`),
    }));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <SectionLabel index="02">Type scale</SectionLabel>
        <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
          Active: <span className="text-foreground font-mono">{active}</span> ·
          resize the window to switch
        </span>
      </div>
      <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
        Roles, values and use cases are read from styles/globals.css — add a
        role there (with its{" "}
        <code className="font-mono text-foreground">--role-usage</code>) and it
        appears here. Markup picks sizes per breakpoint:{" "}
        <code className="font-mono text-foreground break-all">
          text-card-header-sm md:text-card-header-md lg:text-card-header-lg
        </code>
      </p>
      <div className="overflow-x-auto">
        <div className="flex min-w-[60rem] flex-col">
          <div
            className={cn(
              TYPE.cardEyebrow,
              TYPE_TABLE_COLUMNS,
              "text-muted-foreground border-b pb-2 uppercase"
            )}
          >
            <span>Role</span>
            <span>Use case</span>
            {TYPE_SIZES.map((size) => (
              <span
                key={size}
                className={cn(size === active && "text-primary")}
              >
                {size === "sm" ? "sm (base)" : `${size}:`}
              </span>
            ))}
            <span>Sample (live)</span>
          </div>
          {rows.map((row) => {
            const sample = TYPE_SAMPLES[row.role];
            const wired = row.inTypeConstants && row.classGenerated;

            return (
              <div
                key={row.role}
                className={cn(
                  TYPE_TABLE_COLUMNS,
                  "items-baseline border-b py-2.5 last:border-b-0"
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className={cn(TYPE.cardCaption, "font-mono")}>
                    {row.role}
                  </span>
                  <span
                    className={cn(TYPE.cardCaption, "text-muted-foreground")}
                  >
                    weight {row.weight || "—"}
                  </span>
                  {!wired && (
                    <Badge variant="destructive" className="mt-1 w-fit">
                      {row.classGenerated ? "Add to TYPE" : "Add to @theme"}
                    </Badge>
                  )}
                </div>
                <p
                  className={cn(
                    TYPE.cardCaption,
                    "text-muted-foreground text-pretty"
                  )}
                >
                  {row.usage || "No --usage token yet"}
                </p>
                {TYPE_SIZES.map((size) => (
                  <span
                    key={size}
                    className={cn(
                      TYPE.cardCaption,
                      "tabular-nums",
                      size === active
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {row.sizes[size]}
                  </span>
                ))}
                <p
                  className={cn(
                    "truncate",
                    wired &&
                      `text-${row.role}-sm md:text-${row.role}-md lg:text-${row.role}-lg`,
                    sample?.uppercase && "uppercase"
                  )}
                  // Unwired roles have no classes yet — preview straight from
                  // the tokens so the value is still visible.
                  style={
                    wired
                      ? undefined
                      : {
                          fontSize: `var(--${row.role}-${active})`,
                          fontWeight: `var(--${row.role}-weight)`,
                          letterSpacing: `var(--${row.role}-${active}-tracking)`,
                          lineHeight: `var(--${row.role}-${active}-leading)`,
                        }
                  }
                >
                  {sample?.text ?? "The quick brown fox"}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const SpacingTokens = () => {
  const values = useComputedSnapshot<string>(
    () =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--spacing")
        .trim(),
    ""
  );
  const spacingRem = Number.parseFloat(values) || 0.25;

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel index="03">Spacing</SectionLabel>
      <p className={cn(TYPE.cardCaption, "text-muted-foreground text-pretty")}>
        --spacing is <span className="text-foreground">{values || "—"}</span>.
        Steps shown as a percentage of the 1rem base.
      </p>
      <div className="flex flex-col gap-2">
        {SPACING_STEPS.map((step) => (
          <div
            key={step}
            className={cn(
              TYPE.cardCaption,
              "grid grid-cols-[3rem_4rem_1fr] items-center gap-3"
            )}
          >
            <span className="font-mono">{step}</span>
            <span className="text-muted-foreground tabular-nums">
              {Number((step * spacingRem * 100).toFixed(2))}%
            </span>
            <div
              className="bg-primary h-2 rounded-xs"
              style={{ width: `calc(var(--spacing) * ${step})` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const RadiusTokens = () => {
  const refs = React.useRef<(HTMLDivElement | null)[]>([]);
  const values = useComputedSnapshot<string[]>(() => {
    const root = Number.parseFloat(
      getComputedStyle(document.documentElement).fontSize
    );

    return refs.current.map((el) =>
      el ? toRem(getComputedStyle(el).borderTopLeftRadius, root) : ""
    );
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <SectionLabel index="04">Radius</SectionLabel>
      <div className="grid grid-cols-3 gap-3">
        {RADII.map((radius, index) => (
          <div key={radius.token} className="flex flex-col gap-1.5">
            <div
              ref={(el) => {
                refs.current[index] = el;
              }}
              className={cn("bg-card h-14 shadow-border", radius.className)}
            />
            <span className={cn(TYPE.cardCaption, "font-mono")}>
              {radius.token}
            </span>
            <span
              className={cn(
                TYPE.cardCaption,
                "text-muted-foreground tabular-nums"
              )}
            >
              {values[index] && Number.parseFloat(values[index]) > 100
                ? "full"
                : values[index] || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ShadowTokens = () => (
  <div className="flex flex-col gap-4">
    <SectionLabel index="05">Edges</SectionLabel>
    <p className={cn(TYPE.cardCaption, "text-muted-foreground text-pretty")}>
      Borders on cards, outline buttons and popovers are box-shadows. Dividers
      and form fields keep real borders.
    </p>
    <div className="grid grid-cols-3 gap-3">
      {SHADOWS.map((shadow) => (
        <div key={shadow.token} className="flex flex-col gap-1.5">
          <div className={cn("bg-card h-14 rounded-lg", shadow.className)} />
          <span className={cn(TYPE.cardCaption, "font-mono")}>
            {shadow.className}
          </span>
          <span
            className={cn(TYPE.cardCaption, "text-muted-foreground font-mono")}
          >
            {shadow.token}
          </span>
        </div>
      ))}
    </div>
  </div>
);

export const TokenPanel = () => (
  <Card className="gap-0 py-0">
    <CardContent className="flex flex-col gap-8 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h2 className={cn(TYPE.headingPanel, "text-balance")}>
            Design tokens
          </h2>
          <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
            Read live from styles/globals.css. Edit a token or switch the theme
            and every value below and every card on this page updates.
          </p>
        </div>
        <Badge variant="outline">globals.css</Badge>
      </div>
      <ColorTokens />
      <TypeTokens />
      <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-3">
        <SpacingTokens />
        <RadiusTokens />
        <ShadowTokens />
      </div>
    </CardContent>
  </Card>
);
