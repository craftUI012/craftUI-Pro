import { getHomeData } from "@/components/new-hero-section/data/get-home-data";
import type { ShowcaseItem } from "@/components/new-hero-section/data/home-types";
import type { FilterGroupId } from "@/constants/taxonomy";

// "More like this" under a docs page, as on Mobbin: other items from the same
// library, ranked by the browse tags they share with the page's item(s).
// The tags are the home page filters' own ("<group>:<slug>", from
// constants/taxonomy.ts via registry.json), so related means "would show up
// under the same filters".

// How much one shared tag says about two items being alike: the same kind of
// section (type) matters most, then what it's for (category), then the look
// (style).
const WEIGHTS: Record<FilterGroupId, number> = {
  categories: 2,
  styles: 1,
  types: 3,
};

// Two rows of the three-column grid.
const LIMIT = 6;

const pagePath = (href: string) => href.split("#")[0];

const tagWeight = (tag: string) =>
  WEIGHTS[tag.split(":")[0] as FilterGroupId] ?? 0;

const score = (candidate: ShowcaseItem, tags: Set<string>) =>
  candidate.tags.reduce(
    (total, tag) => total + (tags.has(tag) ? tagWeight(tag) : 0),
    0
  );

// The items a docs page shows (one, or several variants sharing the page),
// and the most similar others from their library: highest score first,
// newest on a tie. Items with nothing in common still fill in after, so the
// section isn't empty while a library is small.
export const getRelatedItems = async (url: string) => {
  const data = await getHomeData();
  for (const library of data.libraries) {
    const own = library.items.filter((item) => pagePath(item.href) === url);
    if (own.length > 0) {
      const tags = new Set(own.flatMap((item) => item.tags));
      const items = library.items
        .filter((item) => pagePath(item.href) !== url)
        .map((item) => ({ item, score: score(item, tags) }))
        .toSorted(
          (a, b) =>
            b.score - a.score ||
            b.item.publishedAt.localeCompare(a.item.publishedAt)
        )
        .slice(0, LIMIT)
        .map(({ item }) => item);
      return { items, own };
    }
  }
  return { items: [], own: [] };
};
