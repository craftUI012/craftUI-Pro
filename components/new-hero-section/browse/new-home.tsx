import { BrowseCard } from "@/components/new-hero-section/browse/browse-card";
import { BrowseFeed } from "@/components/new-hero-section/browse/browse-feed";
import { BrowseFiltersProvider } from "@/components/new-hero-section/browse/browse-filters";
import { BrowseIndex } from "@/components/new-hero-section/browse/browse-index";
import type { RailData } from "@/components/new-hero-section/browse/browse-rail";
import { BrowseShell } from "@/components/new-hero-section/browse/browse-shell";
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

// Everything the rail shows, worked out once on the server from the same
// cached data as the panels.
const toRailData = (data: HomeData): RailData => ({
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

// Server entry for the new home page: a rail on the left (libraries with
// counts, resource links), a slim top bar (search, site actions), then per
// library a big index and a grid of preview cards with Latest / Most popular
// tabs.
//
// The whole page is prerendered from cached data. Client JS covers only the
// shell, rail and top bar (library, search and drawer state, site actions),
// the index selection,
// the feed (order + filter) and the button sounds.
export const NewHome = async () => {
  const data = await getHomeData();

  return (
    <BrowseShell
      libraries={data.libraries.map(({ id, label, searchPlaceholder }) => ({
        id,
        label,
        searchPlaceholder,
      }))}
      railData={toRailData(data)}
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
