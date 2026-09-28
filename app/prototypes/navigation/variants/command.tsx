"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { LogoMark } from "@/components/logo";
import { ModeSwitcher } from "@/components/mode-switcher";
import { Kbd } from "@/components/ui/kbd";
import { TYPE } from "@/constants/typography";
import { useIsMac } from "@/hooks/use-is-mac";
import { cn } from "@/lib/utils";

import { JumpList, useCommandK, useJumpResults } from "./shared";
import type { NavVariantProps } from "./shared";

// COMMAND: axis = interaction model. Search is the navigation. A floating
// capsule is centred and detached from the page. The library switch is a
// segmented control with a sliding thumb. Focusing search widens the capsule
// and opens a jump-to list; ↑ ↓ Enter works without touching the mouse. The
// grid below filters live at the same time.
export const CommandNav = ({
  active,
  children,
  libraries,
  onActiveChange,
  onQueryChange,
  query,
  searchItems,
}: NavVariantProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const isMac = useIsMac();
  const jump = useJumpResults(searchItems, query);
  const activeIndex = Math.max(
    0,
    libraries.findIndex((library) => library.id === active)
  );
  const placeholder = libraries[activeIndex]?.searchPlaceholder ?? "Search…";

  useCommandK(useCallback(() => inputRef.current?.focus(), []));

  return (
    <>
      <div className="pointer-events-none sticky top-3 z-50 flex justify-center px-4">
        <header
          className={cn(
            "bg-background/85 shadow-floating pointer-events-auto relative flex w-full max-w-3xl items-center gap-2 rounded-2xl p-1.5 backdrop-blur-md",
            "animate-in fade-in slide-in-from-top-2 fill-mode-both ease-out-strong duration-300 motion-reduce:animate-none"
          )}
        >
          <Link
            href="/"
            className="hover:bg-accent focus-visible:ring-ring/50 flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-150 outline-none focus-visible:ring-[3px]"
          >
            <LogoMark className="size-5" />
            <span className="sr-only">craftUI Pro</span>
          </Link>

          {/* Segmented library switch. The thumb slides with a transform; its
              width is fixed by the equal-width grid. */}
          <div
            role="group"
            aria-label="Library"
            className={cn(
              "bg-muted relative hidden shrink-0 grid-cols-3 rounded-xl p-0.5 sm:grid",
              open && "max-md:hidden"
            )}
          >
            <span
              aria-hidden
              style={{ transform: `translateX(${activeIndex * 100}%)` }}
              className="bg-background shadow-border absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-[0.625rem] transition-transform duration-250 ease-out-strong motion-reduce:transition-none"
            />
            {libraries.map((library) => (
              <button
                key={library.id}
                type="button"
                aria-pressed={library.id === active}
                onClick={() => onActiveChange(library.id)}
                className={cn(
                  TYPE.cardLabel,
                  "focus-visible:ring-ring/50 relative z-10 flex h-8 items-center justify-center gap-1.5 rounded-[0.625rem] px-3 transition-colors duration-150 outline-none focus-visible:ring-[3px]",
                  library.id === active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {library.label}
                <span className="text-muted-foreground tabular-nums">
                  {library.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative flex-1">
            <label
              className={cn(
                "flex h-9 items-center gap-2 rounded-xl px-3 transition-colors duration-150",
                open ? "bg-muted" : "hover:bg-muted/60"
              )}
            >
              <SearchIcon
                aria-hidden
                className="text-muted-foreground size-4 shrink-0"
              />
              <span className="sr-only">{placeholder}</span>
              <input
                ref={inputRef}
                type="search"
                role="combobox"
                aria-expanded={open && query.trim().length > 0}
                aria-controls="command-jump"
                value={query}
                placeholder={placeholder}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    onQueryChange("");
                    event.currentTarget.blur();
                    return;
                  }
                  jump.onKeyDown(event);
                }}
                className={cn(
                  TYPE.cardLabel,
                  "placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
                )}
              />
              <span
                aria-hidden
                className={cn("hidden gap-1 sm:flex", open && "sm:hidden")}
              >
                <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
                <Kbd className="aspect-square">K</Kbd>
              </span>
            </label>

            {open && query.trim() && (
              // mousedown keeps focus in the input so a click can land on a row.
              <div
                onMouseDown={(event) => event.preventDefault()}
                className="bg-popover text-popover-foreground shadow-elevated animate-in fade-in zoom-in-[0.98] slide-in-from-top-1 absolute inset-x-0 top-[calc(100%+0.5rem)] origin-top rounded-xl duration-150 ease-out-strong motion-reduce:animate-none"
              >
                <JumpList
                  id="command-jump"
                  query={query}
                  results={jump.results}
                  highlight={jump.highlight}
                  onHighlight={jump.setHighlight}
                />
              </div>
            )}
          </div>

          <ModeSwitcher />
        </header>
      </div>

      {/* Phones: the segmented switch moves under the capsule. */}
      <div className="mt-3 flex justify-center px-4 sm:hidden">
        <div className="bg-muted grid w-full grid-cols-3 rounded-xl p-0.5">
          {libraries.map((library) => (
            <button
              key={library.id}
              type="button"
              aria-pressed={library.id === active}
              onClick={() => onActiveChange(library.id)}
              className={cn(
                TYPE.cardLabel,
                "h-8 rounded-[0.625rem] transition-colors duration-150",
                library.id === active
                  ? "bg-background text-foreground shadow-border"
                  : "text-muted-foreground"
              )}
            >
              {library.label}
            </button>
          ))}
        </div>
      </div>

      {children}
    </>
  );
};
