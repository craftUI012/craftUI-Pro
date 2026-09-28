"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";

import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// PROTOTYPE ONLY: nothing outside app/prototypes may import from here.

export interface NavLibrary {
  id: LibraryId;
  label: string;
  count: number;
  searchPlaceholder: string;
}

export interface NavSearchItem {
  id: string;
  name: string;
  tagline: string;
  href: string;
  library: LibraryId;
  libraryLabel: string;
}

// Every variant gets the same state and data, and decides where the page
// content (`children`) sits: under a bar, beside a rail, above a dock.
export interface NavVariantProps {
  active: LibraryId;
  children: React.ReactNode;
  libraries: NavLibrary[];
  onActiveChange: (id: LibraryId) => void;
  onQueryChange: (query: string) => void;
  query: string;
  searchItems: NavSearchItem[];
}

export const SITE_LINKS = [
  { href: "/docs", label: "Docs" },
  { href: "/docs/installation", label: "Get started" },
  { href: "/pricing", label: "Pricing" },
] as const;

// ⌘K / Ctrl+K anywhere, or "/" when not typing.
export const useCommandK = (onTrigger: () => void) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA";
      const commandK =
        event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey);
      if (commandK || (event.key === "/" && !typing)) {
        event.preventDefault();
        onTrigger();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onTrigger]);
};

// Up to `limit` matches across every library, for the jump-to lists. Also
// returns keyboard highlight state and a handler for ↑ ↓ Enter.
export const useJumpResults = (
  items: NavSearchItem[],
  query: string,
  limit = 6
) => {
  const router = useRouter();
  const [highlight, setHighlight] = useState(0);
  const q = query.trim().toLowerCase();

  const results = useMemo(
    () =>
      q
        ? items
            .filter((item) =>
              `${item.name} ${item.tagline}`.toLowerCase().includes(q)
            )
            .slice(0, limit)
        : [],
    [items, q, limit]
  );

  // New query → start at the top again.
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setHighlight(0);
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (results.length === 0) {
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => (h + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[highlight];
      if (hit) {
        router.push(hit.href);
      }
    }
  };

  return { highlight, onKeyDown, results, setHighlight };
};

// The jump-to list shared by Command and Dock. The highlighted row follows the
// keyboard or the pointer; the colour change is the only motion.
export const JumpList = ({
  highlight,
  id,
  onHighlight,
  onPick,
  query,
  results,
}: {
  highlight: number;
  id: string;
  onHighlight: (index: number) => void;
  onPick?: () => void;
  query: string;
  results: NavSearchItem[];
}) => {
  if (!query.trim()) {
    return null;
  }
  if (results.length === 0) {
    return (
      <p
        className={cn(
          TYPE.cardDescription,
          "text-muted-foreground px-3 py-6 text-center"
        )}
      >
        No components, blocks or templates match “{query.trim()}”.
      </p>
    );
  }
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Jump to"
      className="flex flex-col p-1.5"
    >
      {results.map((item, index) => (
        <li
          key={`${item.library}-${item.id}`}
          role="option"
          aria-selected={index === highlight}
        >
          <Link
            href={item.href}
            onClick={onPick}
            onPointerMove={() => onHighlight(index)}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 transition-colors duration-150 ease-out outline-none",
              index === highlight
                ? "bg-accent text-accent-foreground"
                : "text-foreground"
            )}
          >
            <span
              className={cn(
                TYPE.cardCaption,
                "bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md"
              )}
            >
              {item.name.slice(0, 1)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={TYPE.cardLabel}>{item.name}</span>
              <span
                className={cn(
                  TYPE.cardCaption,
                  "text-muted-foreground truncate"
                )}
              >
                {item.tagline}
              </span>
            </span>
            <span
              className={cn(TYPE.cardCaption, "text-muted-foreground shrink-0")}
            >
              {item.libraryLabel}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
};
