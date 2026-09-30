import { createHash } from "node:crypto";

import { unstable_cache } from "next/cache";
import { cache } from "react";

import type {
  FeedId,
  HomeData,
  ShowcaseItem,
} from "@/components/new-hero-section/data/home-types";
import { buildHomeDataFromRegistry } from "@/components/new-hero-section/data/registry-home-data";
import registry from "@/registry.json";

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
// Built from registry.json (see registry-home-data.ts). Install analytics,
// for "Most popular", can join it later as meta.popularity.
const loadHomeData = (): Promise<HomeData> =>
  Promise.resolve(buildHomeDataFromRegistry());

// A short hash of the registry's items, also part of the cache key, so an
// edit to registry.json shows up without bumping HOME_DATA_VERSION.
const registryHash = () =>
  createHash("sha1")
    .update(JSON.stringify(registry.items))
    .digest("hex")
    .slice(0, 8);

// Part of the cache key. The Data Cache outlives code edits (even in dev), so
// bump this whenever the HomeData shape changes, or pages keep getting the old
// cached shape.
const HOME_DATA_VERSION = "7";

export const getHomeData = cache(
  unstable_cache(
    loadHomeData,
    ["new-home-data", HOME_DATA_VERSION, registryHash()],
    {
      revalidate: false,
      tags: [HOME_CACHE_TAG],
    }
  )
);

// Card order for each feed tab, worked out on the server so the client only
// swaps which list it shows.
export const feedOrders = (
  items: ShowcaseItem[]
): Record<FeedId, string[]> => ({
  latest: items
    .toSorted((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .map((item) => item.id),
  // Newest first among equals, so it's still a sensible order while there's
  // no install data (every popularity is 0).
  popular: items
    .toSorted(
      (a, b) =>
        b.popularity - a.popularity ||
        b.publishedAt.localeCompare(a.publishedAt)
    )
    .map((item) => item.id),
});
