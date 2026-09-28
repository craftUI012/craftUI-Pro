import type { Metadata } from "next";

import { BrowseCard } from "@/components/new-hero-section/browse/browse-card";
import { BrowseFeed } from "@/components/new-hero-section/browse/browse-feed";
import { BrowseFiltersProvider } from "@/components/new-hero-section/browse/browse-filters";
import { BrowseIndex } from "@/components/new-hero-section/browse/browse-index";
import {
  feedOrders,
  getHomeData,
} from "@/components/new-hero-section/data/get-home-data";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";

import { NavigationHarness } from "./harness";

// PROTOTYPE ONLY: compares navigation variants for /homepage-new over the
// real index and grid. Production code never imports from here. Delete this
// folder once a variant is promoted.
export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Prototype: navigation",
};

export default async function NavigationPrototype({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ v }, data] = await Promise.all([searchParams, getHomeData()]);
  const initialVariant = Math.max(0, Math.min(3, (Number(v) || 1) - 1));

  // Same panels as /homepage-new (index + feed per library).
  const panels = Object.fromEntries(
    data.libraries.map((library) => {
      const orders = feedOrders(library.items);
      return [
        library.id,
        <BrowseFiltersProvider key={library.id}>
          <BrowseIndex groups={library.index} />
          <BrowseFeed
            feeds={data.feeds}
            itemLabel={library.itemLabel}
            orders={orders}
            tags={Object.fromEntries(
              library.items.map((item) => [item.id, item.tags])
            )}
            searchText={Object.fromEntries(
              library.items.map((item) => [
                item.id,
                `${item.name} ${item.tagline}`.toLowerCase(),
              ])
            )}
            cards={Object.fromEntries(
              library.items.map((item) => [
                item.id,
                <BrowseCard key={item.id} item={item} />,
              ])
            )}
          />
        </BrowseFiltersProvider>,
      ];
    })
  ) as Record<LibraryId, React.ReactNode>;

  return (
    <div className="bg-background min-h-svh">
      <NavigationHarness
        initialVariant={initialVariant}
        panels={panels}
        libraries={data.libraries.map((library) => ({
          count: library.items.length,
          id: library.id,
          label: library.label,
          searchPlaceholder: library.searchPlaceholder,
        }))}
        searchItems={data.libraries.flatMap((library) =>
          library.items.map((item) => ({
            href: item.href,
            id: item.id,
            library: library.id,
            libraryLabel: library.label,
            name: item.name,
            tagline: item.tagline,
          }))
        )}
      />
    </div>
  );
}
