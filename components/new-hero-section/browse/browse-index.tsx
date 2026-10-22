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
// Every value is foreground. Picked ones (any number per group: OR within a
// group, AND across groups) slide a little right as a brand dot scales in
// beside them; hovering an unpicked one dims it slightly. A value the library
// lists but has no items for yet (count 0) is dimmed and can't be picked.
// Only colour and transforms animate (200ms, ease-out-strong), and reduced
// motion keeps just the dot.
//
// Type (roles from /design-admin): group labels are card-eyebrow, an
// uppercase overline, so they read as labels and not as one more value.
// Values are heading-panel (16 → 20px · 600), the same tier as the feed's
// Latest / Most popular below: big enough to scan as an index, without
// twenty-odd section titles (heading-section) outshouting the grid.
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
            "flex flex-col gap-2.5",
            group.columns === 2 && "col-span-2"
          )}
        >
          <h2
            id={`index-${group.id}`}
            className={cn(TYPE.cardEyebrow, "text-muted-foreground uppercase")}
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
              const selected = selection[group.id]?.includes(link.id) ?? false;
              const empty = link.count === 0;
              return (
                <li key={link.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    disabled={empty}
                    title={empty ? "Coming soon" : undefined}
                    onClick={() => toggle(group.id, link.id)}
                    className={cn(
                      TYPE.headingPanel,
                      "focus-visible:ring-ring/50 text-foreground disabled:text-muted-foreground/50 relative rounded-sm text-left transition-colors duration-200 ease-out-strong outline-none focus-visible:ring-[3px] disabled:cursor-default motion-reduce:transition-none",
                      !selected && "enabled:hover:text-foreground/80"
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
                        selected ? "translate-x-3.5" : "translate-x-0"
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
