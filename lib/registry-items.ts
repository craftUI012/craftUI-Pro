import { ROUTES } from "@/constants/routes";
import { isLibraryId } from "@/lib/taxonomy";
import registry from "@/registry.json";

// Lookups in registry.json only, with no file reads, so proxy.ts can use
// them. Anything that reads files relative to the project (lib/read-file.ts)
// makes the build trace the whole project into that bundle, which broke the
// proxy on Vercel: the root package.json ("type": "module") came along and
// made Node load the CommonJS middleware as an ES module. lib/registry.ts
// re-exports these for everything else.

// registry.json's own `meta`. `meta.id` is the item's product code (e.g.
// "SEC-0001"), which purchases store; `meta.free` marks an item free.
export const getRegistryItemMeta = (
  name: string
): { free?: boolean; id?: string; library?: string } | undefined =>
  registry.items.find((item) => item.name === name)?.meta;

// An item by its name ("hero-section") or its product code ("SEC-0003"):
// install URLs accept either.
export const getRegistryItem = (nameOrId: string) =>
  registry.items.find(
    (item) => item.name === nameOrId || item.meta?.id === nameOrId
  );

// Every library item is paid unless it's marked `meta.free`: its source and
// install need a plan or a purchase of it. Items outside the library (no
// `meta.library`, e.g. the scaffold) aren't sold.
export const isPaidItem = (name: string) => {
  const meta = getRegistryItemMeta(name);
  return meta?.library !== undefined && meta.free !== true;
};

// The docs page of every library item (/docs/<library>/<page>, where <page>
// is meta.docs or the item's name). Other pages in a library's docs folder
// have no item behind them yet (placeholders), so they're kept out of
// search: see isIndexableDocsPage.
const ITEM_DOCS_PATHS = new Set(
  registry.items.flatMap((item) => {
    const meta = item.meta as { docs?: string; library?: string } | undefined;
    return meta?.library
      ? [`${ROUTES.DOCS}/${meta.library}/${meta.docs ?? item.name}`]
      : [];
  })
);

// Whether a docs page belongs in the sitemap and search results: a library
// item's page, or a guide outside the library folders (e.g. /docs/installation).
export const isIndexableDocsPage = (slugs: string[], url: string) =>
  !isLibraryId(slugs[0]) || ITEM_DOCS_PATHS.has(url);

export const getRegistryItemTitle = (name: string): string | undefined =>
  registry.items.find((item) => item.name === name)?.title;
