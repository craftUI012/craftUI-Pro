"use client";

import type * as React from "react";
import { useState } from "react";

import { useBrowseQuery } from "@/components/new-hero-section/browse/browse-context";
import {
  indexTag,
  useBrowseFilters,
} from "@/components/new-hero-section/browse/browse-filters";
import type { FeedId } from "@/components/new-hero-section/data/home-types";
import { Button } from "@/components/ui/button";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Each card after the first starts this much later, capped so a long grid
// never waits.
const CARD_STAGGER_MS = 30;
const MAX_STAGGER_STEPS = 6;

const emptyMessage = (
  query: string,
  filtered: boolean,
  total: number,
  noun: string
) => {
  if (total === 0) {
    return `No ${noun} yet. They're on the way.`;
  }
  if (!query) {
    return "Nothing matches these filters yet.";
  }
  return filtered
    ? `Nothing matches “${query}” with these filters.`
    : `Nothing matches “${query}”.`;
};

// Client island for the grid. The cards are server-rendered and passed in as
// slots keyed by item id. This component only picks the order (Latest / Most
// popular, worked out on the server) and hides cards that don't match the
// index selection or the top-bar search, so a change never re-fetches a card.
//
// When the result changes, the cards fade up 0.5rem in a short stagger
// (ease-out-strong, 300ms). First paint shows them without animation, so the
// first-row images aren't held back. Reduced motion skips it.
export const BrowseFeed = ({
  cards,
  feeds,
  itemLabel,
  orders,
  searchText,
  tags,
}: {
  cards: Record<string, React.ReactNode>;
  feeds: { id: FeedId; label: string }[];
  // Nouns for the count: "1 component", "6 components".
  itemLabel: { one: string; other: string };
  orders: Record<FeedId, string[]>;
  // Lower-cased name + tagline per item id, for the search filter.
  searchText: Record<string, string>;
  // Index tags per item id (see indexTag).
  tags: Record<string, string[]>;
}) => {
  const [feed, setFeed] = useState<FeedId>(feeds[0]?.id ?? "latest");
  const { clear, selection } = useBrowseFilters();
  const query = useBrowseQuery().trim().toLowerCase();

  const picked = Object.entries(selection).flatMap(([groupId, linkId]) =>
    linkId ? [indexTag(groupId, linkId)] : []
  );
  const ids = orders[feed].filter(
    (id) =>
      picked.every((tag) => tags[id]?.includes(tag)) &&
      (!query || searchText[id]?.includes(query))
  );

  // Changes whenever what's shown changes, and keys the cards so they replay
  // the entrance. Nothing animates until the first change after load; from
  // then on every change does, including going back to the first view.
  const viewKey = `${feed}|${picked.join(",")}|${query}`;
  const [firstViewKey] = useState(viewKey);
  const [animate, setAnimate] = useState(false);
  if (!animate && viewKey !== firstViewKey) {
    setAnimate(true);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-7">
          {feeds.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={tab.id === feed}
              onClick={() => setFeed(tab.id)}
              className={cn(
                TYPE.headingPanel,
                "focus-visible:ring-ring/50 relative rounded-sm pb-1.5 transition-colors duration-200 ease-out-strong outline-none focus-visible:ring-[3px] motion-reduce:transition-none",
                // Underline grows from the left instead of snapping in.
                "after:bg-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:origin-left after:rounded-full after:transition-transform after:duration-200 after:ease-out-strong motion-reduce:after:transition-none",
                tab.id === feed
                  ? "text-foreground after:scale-x-100"
                  : "text-muted-foreground hover:text-foreground/80 after:scale-x-0"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <p
            aria-live="polite"
            className={cn(TYPE.cardDescription, "text-muted-foreground")}
          >
            {ids.length} {ids.length === 1 ? itemLabel.one : itemLabel.other}
          </p>
          {picked.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              sound="click"
              onClick={clear}
              className="animate-in fade-in duration-200 motion-reduce:animate-none"
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {ids.length > 0 ? (
        <ul className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {ids.map((id, index) => (
            <li
              key={animate ? `${viewKey}:${id}` : id}
              style={
                animate
                  ? {
                      animationDelay: `${Math.min(index, MAX_STAGGER_STEPS) * CARD_STAGGER_MS}ms`,
                    }
                  : undefined
              }
              className={cn(
                animate &&
                  "animate-in fade-in slide-in-from-bottom-2 fill-mode-both ease-out-strong duration-300 motion-reduce:animate-none"
              )}
            >
              {cards[id]}
            </li>
          ))}
        </ul>
      ) : (
        <div className="animate-in fade-in flex flex-col items-center gap-3 py-16 duration-200 motion-reduce:animate-none">
          <p className={cn(TYPE.cardBody, "text-muted-foreground text-center")}>
            {emptyMessage(
              query,
              picked.length > 0,
              orders[feed].length,
              itemLabel.other
            )}
          </p>
          {picked.length > 0 && (
            <Button variant="outline" size="sm" sound="click" onClick={clear}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
