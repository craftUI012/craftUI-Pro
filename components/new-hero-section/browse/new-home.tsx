import type * as React from "react";

import { BrowseCard } from "@/components/new-hero-section/browse/browse-card";
import { BrowseFeed } from "@/components/new-hero-section/browse/browse-feed";
import { BrowseFiltersProvider } from "@/components/new-hero-section/browse/browse-filters";
import { BrowseIndex } from "@/components/new-hero-section/browse/browse-index";
import { BrowsePanels } from "@/components/new-hero-section/browse/browse-panels";
import type { RailData } from "@/components/new-hero-section/browse/browse-rail";
import { BrowseShell } from "@/components/new-hero-section/browse/browse-shell";
import { buildDocsMenu } from "@/components/new-hero-section/data/docs-menu";
import {
  feedOrders,
  getHomeData,
} from "@/components/new-hero-section/data/get-home-data";
import { recentKey } from "@/components/new-hero-section/data/home-keys";
import type {
  FeedId,
  HomeData,
  Library,
} from "@/components/new-hero-section/data/home-types";

// Cards in the first row of the first tab: on screen at load, so eager.
const EAGER_CARDS = 3;

// How many of the newest items the rail's What's new lists.
const WHATS_NEW_COUNT = 3;

// Everything the rail shows, worked out once on the server: the browse menu's
// What's new (from the same cached data as the panels) and the docs menu
// (from the docs source).
const toRailData = (data: HomeData): RailData => ({
  docs: buildDocsMenu(),
  whatsNew: data.libraries
    .flatMap((library) =>
      library.items.map((item) => ({ item, library: library.id }))
    )
    .toSorted((a, b) => b.item.publishedAt.localeCompare(a.item.publishedAt))
    .slice(0, WHATS_NEW_COUNT)
    .map(({ item, library }) => ({
      href: item.href,
      key: recentKey(library, item.id),
      library,
      name: item.name,
    })),
});

// Server component, one library's panel: the index (a filter), then the feed.
// Both sit in one BrowseFiltersProvider, so picking an index item filters
// this library's grid. Cards are rendered here and handed to the client feed
// as slots.
const LibraryPanel = ({
  eager,
  feeds,
  library,
}: {
  eager: boolean;
  feeds: { id: FeedId; label: string }[];
  library: Library;
}) => {
  const orders = feedOrders(library.items);
  const firstRow = new Set(
    orders[feeds[0]?.id ?? "latest"].slice(0, EAGER_CARDS)
  );

  return (
    <BrowseFiltersProvider>
      <BrowseIndex groups={library.index} />
      <BrowseFeed
        feeds={feeds}
        itemLabel={library.itemLabel}
        tags={Object.fromEntries(
          library.items.map((item) => [item.id, item.tags])
        )}
        orders={orders}
        cards={Object.fromEntries(
          library.items.map((item) => [
            item.id,
            <BrowseCard
              key={item.id}
              item={item}
              eager={eager && firstRow.has(item.id)}
            />,
          ])
        )}
        searchText={Object.fromEntries(
          library.items.map((item) => [
            item.id,
            `${item.name} ${item.tagline}`.toLowerCase(),
          ])
        )}
      />
    </BrowseFiltersProvider>
  );
};

// Server entry for the shell, used by app/homepage-new/layout.tsx: the rail
// (browse and docs menus) and the top bar, around whatever route is open.
// Both the layout and the browse page call getHomeData(); React `cache`
// dedupes it within the render.
export const NewHomeShell = async ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const data = await getHomeData();

  return (
    <BrowseShell
      libraries={data.libraries.map(({ id, label, searchPlaceholder }) => ({
        id,
        label,
        searchPlaceholder,
      }))}
      railData={toRailData(data)}
    >
      {children}
    </BrowseShell>
  );
};

// Server entry for the browse page: per library a big index and a grid of
// preview cards with Latest / Most popular tabs. Prerendered from cached
// data; client JS covers the index selection, the feed (order + filter) and
// the button sounds.
export const NewHomeBrowse = async () => {
  const data = await getHomeData();

  // No page transition: the content swaps in place; only the rail animates.
  return (
    <BrowsePanels
      order={data.libraries.map((library) => library.id)}
      panels={
        Object.fromEntries(
          data.libraries.map((library, index) => [
            library.id,
            <LibraryPanel
              key={library.id}
              library={library}
              feeds={data.feeds}
              eager={index === 0}
            />,
          ])
        ) as Record<Library["id"], React.ReactNode>
      }
    />
  );
};
