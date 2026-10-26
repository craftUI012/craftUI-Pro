import path from "node:path";

import { ROUTES } from "@/constants/routes";
import { readFileFromRoot } from "@/lib/read-file";
import { isLibraryId } from "@/lib/taxonomy";
import registry from "@/registry.json";

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

export const readOptionalFromRoot = async (
  relativePath: string
): Promise<string | null> => {
  try {
    return await readFileFromRoot(relativePath);
  } catch {
    return null;
  }
};

// An item's main file is the first in its registry.json `files`, wherever
// its library folder is (registry/sections, registry/blocks, …).
export const getRegistryUiSourceCandidates = ({ name }: { name: string }) => {
  const main = registry.items.find((item) => item.name === name)?.files[0];
  return main ? [main.path] : [];
};

export const getDemoSource = (name: string): Promise<string | null> =>
  readOptionalFromRoot(path.join("examples", `${name}.tsx`));

export const getRegistrySource = async (
  name: string
): Promise<string | null> => {
  const candidates = getRegistryUiSourceCandidates({ name });

  for (const candidate of candidates) {
    const code = await readOptionalFromRoot(candidate);
    if (code) {
      return code;
    }
  }

  return null;
};
