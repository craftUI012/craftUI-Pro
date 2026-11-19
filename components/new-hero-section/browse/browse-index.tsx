"use client";

import type * as React from "react";

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
//
// A category parent (Blocks' Settings & account) heads a column of its
// children. Its heading is a filter too: picking it shows every child's
// items, with the same dot and slide as a value, at the eyebrow's size.

const PickDot = ({ selected }: { selected: boolean }) => (
  <span
    aria-hidden
    className={cn(
      "bg-brand-text absolute top-1/2 left-0 size-1.5 -translate-y-1/2 rounded-full transition-[scale,opacity] duration-200 ease-out-strong motion-reduce:transition-none",
      selected ? "scale-100 opacity-100" : "scale-0 opacity-0"
    )}
  />
);

const PickLabel = ({
  children,
  selected,
}: {
  children: React.ReactNode;
  selected: boolean;
}) => (
  <span
    className={cn(
      "inline-block transition-transform duration-200 ease-out-strong motion-reduce:transition-none",
      selected ? "translate-x-3.5" : "translate-x-0"
    )}
  >
    {children}
  </span>
);

const PICK_BUTTON =
  "focus-visible:ring-ring/50 relative rounded-sm text-left transition-colors duration-200 ease-out-strong outline-none focus-visible:ring-[3px] disabled:cursor-default motion-reduce:transition-none";

export const BrowseIndex = ({ groups }: { groups: IndexGroup[] }) => {
  const { selection, toggle } = useBrowseFilters();
  const isPicked = (group: IndexGroup, id: string) =>
    selection[group.id]?.includes(id) ?? false;

  return (
    <div className="grid grid-flow-row-dense grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
      {groups.map((group) => {
        const { parent } = group;
        const parentPicked = parent ? isPicked(group, parent.id) : false;
        return (
          <div
            key={group.key}
            role="group"
            aria-labelledby={`index-${group.key}`}
            className={cn(
              "flex flex-col gap-2.5",
              group.columns === 2 && "col-span-2"
            )}
          >
            <h2
              id={`index-${group.key}`}
              className={cn(
                TYPE.cardEyebrow,
                "text-muted-foreground uppercase"
              )}
            >
              {parent ? (
                <button
                  type="button"
                  aria-pressed={parentPicked}
                  disabled={parent.count === 0}
                  title={
                    parent.count === 0 ? "Coming soon" : `All ${parent.label}`
                  }
                  onClick={() => toggle(group.id, parent.id)}
                  className={cn(
                    PICK_BUTTON,
                    "uppercase disabled:text-muted-foreground/50",
                    parentPicked
                      ? "text-foreground"
                      : "enabled:hover:text-foreground"
                  )}
                >
                  <PickDot selected={parentPicked} />
                  <PickLabel selected={parentPicked}>{group.label}</PickLabel>
                </button>
              ) : (
                group.label
              )}
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
                const selected = isPicked(group, link.id);
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
                        PICK_BUTTON,
                        "text-foreground disabled:text-muted-foreground/50",
                        !selected && "enabled:hover:text-foreground/80"
                      )}
                    >
                      <PickDot selected={selected} />
                      <PickLabel selected={selected}>{link.label}</PickLabel>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
