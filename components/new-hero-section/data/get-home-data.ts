import { unstable_cache } from "next/cache";
import { cache } from "react";

import { HOME_MOCK } from "@/components/new-hero-section/data/home-mock-data";
import type {
  FeedId,
  HomeData,
  ShowcaseItem,
} from "@/components/new-hero-section/data/home-types";

// Tag for on-demand revalidation: calling `revalidateTag(HOME_CACHE_TAG)` from
// a Server Action or Route Handler (for example after the registry JSON is
// rebuilt) refreshes the page without a redeploy.
export const HOME_CACHE_TAG = "new-home";

// Two cache layers, following the Next 16 guide for apps without
// `cacheComponents` (docs: caching-without-cache-components):
// - unstable_cache keeps the result in the Data Cache across requests and
//   builds, so the page prerenders once and stays static.
// - React `cache` dedupes calls within one render.
//
// WHEN WE SHIP REAL DATA: replace the body with a read of the building JSON
// (registry.json + install analytics). The result must still match HomeData.
const loadHomeData = (): Promise<HomeData> => Promise.resolve(HOME_MOCK);

// Part of the cache key. The Data Cache outlives code edits (even in dev), so
// bump this whenever the HomeData shape changes, or pages keep getting the old
// cached shape.
const HOME_DATA_VERSION = "3";

export const getHomeData = cache(
  unstable_cache(loadHomeData, ["new-home-data", HOME_DATA_VERSION], {
    revalidate: false,
    tags: [HOME_CACHE_TAG],
  })
);

// Card order for each feed tab, worked out on the server so the client only
// swaps which list it shows.
export const feedOrders = (
  items: ShowcaseItem[]
): Record<FeedId, string[]> => ({
  latest: items
    .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((item) => item.id),
  popular: items
    .toSorted((a, b) => b.popularity - a.popularity)
    .map((item) => item.id),
});
