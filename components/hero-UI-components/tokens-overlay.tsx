"use client";

import { Check, Copy, X } from "lucide-react";
import { m } from "motion/react";
import * as React from "react";

import type { StripComponent } from "@/components/hero-UI-components/components-data";
import { Button } from "@/components/ui/button";
import { TYPE } from "@/constants/typography";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { CssTokenSource } from "@/lib/css-vars";
import { varReferences } from "@/lib/css-vars";
import { cn } from "@/lib/utils";

type Token = StripComponent["tokens"][number];

const isDark = () => document.documentElement.classList.contains("dark");

interface Line {
  name: string;
  // Pulled in because another line points at it through var().
  referenced: boolean;
  value: string;
}

interface Block {
  selector: string;
  lines: Line[];
}

// The component's tokens grouped the way globals.css has them: everything
// under :root, and in dark mode the overrides under .dark (tokens dark mode
// doesn't override, like --radius, stay under :root). Tokens they point at
// through var() follow, so every value can be traced to a literal.
const toBlocks = (
  tokens: readonly Token[],
  source: CssTokenSource,
  dark: boolean
): Block[] => {
  const root: Block = { lines: [], selector: ":root" };
  const darkBlock: Block = { lines: [], selector: ".dark" };
  const own = new Set<string>(tokens.map((token) => token.name));
  const queue = [...own];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const name = queue.shift();

    if (!name || seen.has(name)) {
      continue;
    }

    seen.add(name);
    const darkValue = dark ? source.dark[name] : undefined;
    const value = darkValue ?? source.root[name];

    if (!value) {
      continue;
    }

    (darkValue ? darkBlock : root).lines.push({
      name,
      referenced: !own.has(name),
      value,
    });
    queue.push(...varReferences(value));
  }

  return [root, darkBlock].filter((block) => block.lines.length > 0);
};

// Literal colors get a swatch too (e.g. --brand, pulled in by reference).
const LITERAL_COLOR = /^(?:oklch|oklab|lab|lch|rgb|hsl|color)\(|^#/;

// Long multi-part values (layered shadows) put each part on its own line
// under the name, the way globals.css is formatted.
const LONG_VALUE = 36;

const splitValue = (value: string) => {
  if (value.length <= LONG_VALUE) {
    return [value];
  }

  const parts: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
    } else if (char === "," && depth === 0) {
      parts.push(`${value.slice(start, index + 1).trim()}`);
      start = index + 1;
    }
  }

  parts.push(value.slice(start).trim());

  return parts;
};

const toCss = (blocks: Block[]) =>
  blocks
    .map(
      (block) =>
        `${block.selector} {${block.lines
          .map((line, index) => {
            const parts = splitValue(line.value);
            const value =
              parts.length > 1
                ? parts.map((part) => `\n    ${part}`).join("")
                : ` ${parts[0]}`;

            const note =
              line.referenced && !block.lines[index - 1]?.referenced
                ? "\n  /* referenced by var() */"
                : "";

            return `${note}\n  --${line.name}:${value};`;
          })
          .join("")}\n}`
    )
    .join("\n\n");

// Re-read when the theme switches while the overlay is open.
const useThemeVersion = () => {
  const [version, setVersion] = React.useState(0);

  React.useEffect(() => {
    const observer = new MutationObserver(() => setVersion((v) => v + 1));
    observer.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    });

    return () => observer.disconnect();
  }, []);

  return version;
};

// Stops presses inside the overlay (selecting or scrolling the code) from
// dragging the whole row. Native listener: Motion's drag listens natively.
const useStopDrag = () => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;

    if (!node) {
      return;
    }

    const stop = (event: PointerEvent) => event.stopPropagation();
    node.addEventListener("pointerdown", stop);

    return () => node.removeEventListener("pointerdown", stop);
  }, []);

  return ref;
};

// Covers the open tile with the component's tokens written the way they are
// in globals.css, for developers who want the actual values. Escape or the
// close button returns to the features panel.
export const TokensOverlay = ({
  item,
  onClose,
  source,
}: {
  item: StripComponent;
  onClose: () => void;
  source: CssTokenSource;
}) => {
  const ref = useStopDrag();
  const closeRef = React.useRef<HTMLButtonElement>(null);
  const themeVersion = useThemeVersion();
  const { copyToClipboard, isCopied } = useCopyToClipboard();

  const blocks = React.useMemo(
    () => toBlocks(item.tokens, source, isDark()),
    // themeVersion: regroup after a theme switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [item.tokens, source, themeVersion]
  );
  const colorTokens = new Set<string>(
    item.tokens.filter((token) => "color" in token).map((token) => token.name)
  );

  React.useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <m.div
      ref={ref}
      role="dialog"
      aria-label={`${item.name} tokens`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          // Close only the overlay, not the tile under it.
          event.stopPropagation();
          onClose();
        }
      }}
      className="bg-popover text-popover-foreground absolute inset-0 z-10 flex flex-col"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        <span
          className={cn(TYPE.cardCaption, "text-muted-foreground font-mono")}
        >
          globals.css
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={isCopied ? "Copied" : `Copy ${item.name} tokens`}
            onClick={() => copyToClipboard(toCss(blocks))}
            className="size-7"
          >
            {isCopied ? <Check /> : <Copy />}
          </Button>
          <Button
            ref={closeRef}
            variant="ghost"
            size="icon-sm"
            aria-label={`Close ${item.name} tokens`}
            onClick={onClose}
            className="size-7"
          >
            <X />
          </Button>
        </div>
      </div>
      <pre
        className={cn(
          TYPE.cardCaption,
          "min-h-0 flex-1 overflow-auto px-4 pb-4 font-mono whitespace-pre-wrap select-text"
        )}
      >
        <code className="flex flex-col gap-3">
          {blocks.map((block) => (
            <span key={block.selector} className="block">
              <span className="text-muted-foreground">
                {block.selector} {"{"}
              </span>
              {block.lines.map((line, index) => {
                const parts = splitValue(line.value);
                const firstReferenced =
                  line.referenced && !block.lines[index - 1]?.referenced;

                return (
                  <span key={line.name} className="block pl-4">
                    {firstReferenced && (
                      <span className="text-muted-foreground/70 block italic">
                        {"/* referenced by var() */"}
                      </span>
                    )}
                    {(colorTokens.has(line.name) ||
                      LITERAL_COLOR.test(line.value)) && (
                      <span
                        aria-hidden
                        className="mr-1.5 inline-block size-2.5 translate-y-px rounded-sm shadow-border"
                        style={{ background: `var(--${line.name})` }}
                      />
                    )}
                    <span>--{line.name}</span>
                    <span className="text-muted-foreground">: </span>
                    {parts.map((part, partIndex) => (
                      <span
                        key={part}
                        className={cn(
                          "text-muted-foreground",
                          parts.length > 1 && "block pl-4"
                        )}
                      >
                        {part}
                        {partIndex === parts.length - 1 && ";"}
                      </span>
                    ))}
                  </span>
                );
              })}
              <span className="text-muted-foreground">{"}"}</span>
            </span>
          ))}
        </code>
      </pre>
    </m.div>
  );
};
