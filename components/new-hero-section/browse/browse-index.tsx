"use client";

import { useBrowseFilters } from "@/components/new-hero-section/browse/browse-filters";
import type { IndexGroup } from "@/components/new-hero-section/data/home-types";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// The big index above the grid, now a filter. Four equal columns; a group with
// `columns: 2` spans two of them and splits its items in half. On phones the
// grid is two columns and packs densely, so the one-column groups share the
// first row.
//
// Every item rests in muted-foreground. The picked one (at most one per group)
// turns foreground and slides a little right as a brand dot scales in beside
// it. Only colour and transforms animate (200ms, ease-out-strong), and
// reduced motion keeps just the colour change.
//
// Labels match the rail's group labels (12px · 500: cardCaption +
// font-medium), so "Categories" and "Library" read as one row. Items are
// heading-section.
export const BrowseIndex = ({ groups }: { groups: IndexGroup[] }) => {
  const { selection, toggle } = useBrowseFilters();

  return (
    <div className="grid grid-flow-row-dense grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
      {groups.map((group) => (
        <div
          key={group.id}
          role="group"
          aria-labelledby={`index-${group.id}`}
          className={cn(
            "flex flex-col gap-3",
            group.columns === 2 && "col-span-2"
          )}
        >
          <h2
            id={`index-${group.id}`}
            className={cn(
              TYPE.cardCaption,
              "text-muted-foreground font-medium"
            )}
          >
            {group.label}
          </h2>
          <ul
            // Two columns fill top to bottom, then left to right.
            style={
              group.columns === 2
                ? {
                    gridTemplateRows: `repeat(${Math.ceil(group.links.length / 2)}, auto)`,
                  }
                : undefined
            }
            className={cn(
              "grid gap-x-8 gap-y-1",
              group.columns === 2 && "grid-flow-col grid-cols-2"
            )}
          >
            {group.links.map((link) => {
              const selected = selection[group.id] === link.id;
              return (
                <li key={link.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggle(group.id, link.id)}
                    className={cn(
                      TYPE.headingSection,
                      "focus-visible:ring-ring/50 relative rounded-sm text-left transition-colors duration-200 ease-out-strong outline-none focus-visible:ring-[3px] motion-reduce:transition-none",
                      selected
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground/80"
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "bg-brand-text absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full transition-[scale,opacity] duration-200 ease-out-strong motion-reduce:transition-none",
                        selected ? "scale-100 opacity-100" : "scale-0 opacity-0"
                      )}
                    />
                    <span
                      className={cn(
                        "inline-block transition-transform duration-200 ease-out-strong motion-reduce:transition-none",
                        selected ? "translate-x-4" : "translate-x-0"
                      )}
                    >
                      {link.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
};
