"use client";

import { SearchIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { LogoMark } from "@/components/logo";
import { ModeSwitcher } from "@/components/mode-switcher";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { SiteSettings } from "@/components/site-settings";
import { SponsorLink } from "@/components/sponsor-link";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

import { SITE_LINKS, useCommandK } from "./shared";
import type { NavVariantProps } from "./shared";

const LEADS: Record<LibraryId, string> = {
  blocks:
    "Whole sections, from pricing tables to dashboards, ready to drop in.",
  components: "The primitives, each shipped with the tokens it's built from.",
  templates: "Complete sites with every page designed, not just the landing.",
};

// An underlined search field, editorial style: no box, just a rule that
// darkens on focus.
const RuleSearch = ({
  className,
  inputRef,
  onQueryChange,
  placeholder,
  query,
}: {
  className?: string;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  placeholder: string;
  query: string;
}) => (
  <label
    className={cn(
      "border-border focus-within:border-foreground flex h-8 items-center gap-2 border-b transition-colors duration-150",
      className
    )}
  >
    <SearchIcon aria-hidden className="text-muted-foreground size-4 shrink-0" />
    <span className="sr-only">{placeholder}</span>
    <input
      ref={inputRef}
      type="search"
      value={query}
      placeholder={placeholder}
      onChange={(event) => onQueryChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onQueryChange("");
          event.currentTarget.blur();
        }
      }}
      className={cn(
        TYPE.cardLabel,
        "placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
      )}
    />
  </label>
);

// MASTHEAD: axis = personality (typographic). The libraries are the headline:
// set at display size across the top like a magazine masthead, each with its
// count as a superscript and a one-line lead under the active one. It isn't
// sticky. Once it scrolls away, a slim bar slides down (transform only,
// 250ms ease-out-strong) with the same tabs at text size, so the switch is
// never out of reach.
export const MastheadNav = ({
  active,
  children,
  libraries,
  onActiveChange,
  onQueryChange,
  query,
}: NavVariantProps) => {
  const mastheadRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const compactInputRef = useRef<HTMLInputElement>(null);
  const [condensed, setCondensed] = useState(false);
  const placeholder =
    libraries.find((library) => library.id === active)?.searchPlaceholder ??
    "Search…";

  useEffect(() => {
    const el = mastheadRef.current;
    if (!el) {
      return;
    }
    const observer = new IntersectionObserver(([entry]) =>
      setCondensed(!entry?.isIntersecting)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useCommandK(
    useCallback(() => {
      (condensed ? compactInputRef : inputRef).current?.focus();
    }, [condensed])
  );

  return (
    <>
      {/* Condensed bar, shown after the masthead scrolls away. */}
      <div
        inert={!condensed}
        className={cn(
          "bg-background/90 border-border/60 fixed inset-x-0 top-0 z-50 border-b backdrop-blur transition-transform duration-250 ease-out-strong motion-reduce:transition-none",
          condensed ? "translate-y-0" : "-translate-y-full"
        )}
      >
        <div className="container flex h-12 items-center gap-6">
          <LogoMark className="size-5 shrink-0" />
          <div className="flex items-center gap-4">
            {libraries.map((library) => (
              <button
                key={library.id}
                type="button"
                aria-pressed={library.id === active}
                onClick={() => onActiveChange(library.id)}
                className={cn(
                  TYPE.cardLabel,
                  "transition-colors duration-150",
                  library.id === active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {library.label}
              </button>
            ))}
          </div>
          <RuleSearch
            className="ml-auto hidden w-56 sm:flex"
            inputRef={compactInputRef}
            placeholder={placeholder}
            query={query}
            onQueryChange={onQueryChange}
          />
        </div>
      </div>

      <header className="container">
        <div className="flex h-12 items-center gap-6">
          <Link
            href="/"
            className={cn(
              TYPE.cardEyebrow,
              "text-brand-text flex items-center gap-2"
            )}
          >
            <LogoMark className="size-4" />
            craftUI Pro
          </Link>
          <nav aria-label="Site" className="hidden items-center gap-5 md:flex">
            {SITE_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  TYPE.cardCaption,
                  "text-muted-foreground hover:text-foreground transition-colors duration-150"
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <SponsorLink />
            <ModeSwitcher />
            <SiteSettings />
          </div>
        </div>

        <div
          ref={mastheadRef}
          className="border-border/60 animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-out-strong flex flex-col gap-5 border-b pt-10 pb-8 duration-300 md:pt-14 motion-reduce:animate-none"
        >
          <div
            role="group"
            aria-label="Library"
            className="flex flex-wrap items-baseline gap-x-8 gap-y-2"
          >
            {libraries.map((library) => (
              <button
                key={library.id}
                type="button"
                aria-pressed={library.id === active}
                onClick={() => onActiveChange(library.id)}
                className={cn(
                  TYPE.headingDisplay,
                  "focus-visible:ring-ring/50 rounded-sm text-left transition-colors duration-200 ease-out-strong outline-none focus-visible:ring-[3px] motion-reduce:transition-none",
                  library.id === active
                    ? "text-foreground"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
              >
                {library.label}
                <sup
                  className={cn(
                    TYPE.cardCaption,
                    "text-muted-foreground ml-1 align-super tabular-nums"
                  )}
                >
                  {library.count}
                </sup>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <p
              // Keyed so the lead fades in fresh when the library changes.
              key={active}
              className={cn(
                TYPE.pageLead,
                "text-muted-foreground animate-in fade-in max-w-xl duration-200 motion-reduce:animate-none"
              )}
            >
              {LEADS[active]}
            </p>
            <RuleSearch
              className="w-full md:w-72"
              inputRef={inputRef}
              placeholder={placeholder}
              query={query}
              onQueryChange={onQueryChange}
            />
          </div>
        </div>
      </header>

      {children}
    </>
  );
};
