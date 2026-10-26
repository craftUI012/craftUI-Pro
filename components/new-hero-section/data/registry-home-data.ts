import type {
  HomeData,
  IndexGroup,
  LibraryId,
  ShowcaseItem,
} from "@/components/new-hero-section/data/home-types";
import { ROUTES } from "@/constants/routes";
import {
  FILTER_GROUPS,
  LIBRARIES,
  NAV_LIBRARIES,
  POOLS,
} from "@/constants/taxonomy";
import type { FilterGroupId } from "@/constants/taxonomy";
import { getCardMedia, getCardVideo } from "@/lib/media";
import { source } from "@/lib/source";
import { assertRegistryTaxonomy, itemFilterValues } from "@/lib/taxonomy";
import type { TaxonomyRegistryItem } from "@/lib/taxonomy";
import aiHero01 from "@/public/images/AIHero01.png";
import registry from "@/registry.json";

// The browse page's data. The libraries and the values each one's filter
// index lists come from constants/taxonomy.ts; the cards come from
// registry.json. An item shows up in a library when it has `meta.library`;
// everything else in the registry (libs, helpers, dependencies like
// avatar-grid) stays out. Per item:
//
//   categories         → the "Categories" group (one or more)
//   meta.library       → which library (a LibraryId; templates = "Sections")
//   meta.types         → the "Type" group (one or more)
//   meta.styles        → the "Styles" group (zero or more)
//   meta.publishedAt   → "Latest" order and What's new
//   meta.docs          → the docs page it lives on, when that isn't its own
//                        name (hero-section-02 → the hero-section page). The
//                        card links to that page, #<name> for a variant.
//   meta.preview       → the card's screenshot (path under /public), when
//                        it has no R2 screenshot in content/media-manifest.json
//                        (lib/media.ts); a placeholder otherwise
//   meta.popularity    → "Most popular" order (install analytics, later)
//   meta.free          → no Pro badge (every other item is paid)
//
// The slugs are checked against constants/taxonomy.ts first
// (assertRegistryTaxonomy), so a bad one fails the build, not the page.

interface RegistryItem extends TaxonomyRegistryItem {
  description?: string;
  meta?: TaxonomyRegistryItem["meta"] & {
    docs?: string;
    popularity?: number;
    preview?: string;
    free?: boolean;
  };
  title?: string;
}

// A group with more than this many values splits over two columns.
const ONE_COLUMN_MAX = 5;

// Placeholder screenshot for items without meta.preview.
const PLACEHOLDER = {
  blurDataURL: aiHero01.blurDataURL,
  height: aiHero01.height,
  src: aiHero01.src,
  width: aiHero01.width,
};

const labelOf = (group: FilterGroupId, slug: string) =>
  POOLS[group][slug]?.label ?? slug;

// The index for one library: each filter group with the values the library
// lists (in its order), each counted over the library's items. Groups the
// library lists nothing for are dropped.
const libraryIndex = (
  library: LibraryId,
  items: RegistryItem[]
): IndexGroup[] => {
  const config = LIBRARIES[library];

  return FILTER_GROUPS.flatMap((group) => {
    const listed: readonly string[] = config[group.id];
    if (listed.length === 0) {
      return [];
    }
    return [
      {
        columns: listed.length > ONE_COLUMN_MAX ? 2 : 1,
        id: group.id,
        label:
          group.id === "types"
            ? (config.typeLabel ?? group.label)
            : group.label,
        links: listed.map((slug) => ({
          count: items.filter((item) =>
            itemFilterValues(item)[group.id].includes(slug)
          ).length,
          id: slug,
          label: labelOf(group.id, slug),
        })),
      },
    ];
  });
};

// The card's screenshot: the R2 one when it has been uploaded
// (content/media-manifest.json), else meta.preview, else the placeholder.
const previewOf = (item: RegistryItem, name: string) => {
  const alt = `${name} preview`;
  const media = getCardMedia(item.name);
  if (media) {
    return { ...media, alt };
  }
  if (item.meta?.preview) {
    return { alt, height: 1000, src: item.meta.preview, width: 1600 };
  }
  return { ...PLACEHOLDER, alt };
};

// The card for one registry item, or null when it has no docs page to link
// to (so a card never leads to a 404).
const toShowcaseItem = (
  library: LibraryId,
  item: RegistryItem
): ShowcaseItem | null => {
  const meta = item.meta ?? {};
  const page = meta.docs ?? item.name;
  if (!source.getPage([library, page])) {
    return null;
  }
  const name = item.title ?? item.name;
  const href = `${ROUTES.DOCS}/${library}/${page}${
    page === item.name ? "" : `#${item.name}`
  }`;
  const values = itemFilterValues(item);

  return {
    href,
    id: item.name,
    isPro: meta.free !== true,
    name,
    popularity: meta.popularity ?? 0,
    preview: previewOf(item, name),
    publishedAt: meta.publishedAt ?? "",
    tagline: item.description ?? "",
    tags: FILTER_GROUPS.flatMap((group) =>
      values[group.id].map((slug) => `${group.id}:${slug}`)
    ),
    video: getCardVideo(item.name),
  };
};

export const buildHomeDataFromRegistry = (): HomeData => {
  const items = registry.items as RegistryItem[];
  assertRegistryTaxonomy(items);

  return {
    feeds: [
      { id: "latest", label: "Latest" },
      { id: "popular", label: "Most popular" },
    ],
    libraries: NAV_LIBRARIES.map((id) => {
      const { itemLabel, label, searchPlaceholder, slug } = LIBRARIES[id];
      const own = items.filter((item) => item.meta?.library === id);
      const cards = own.flatMap((item) => toShowcaseItem(id, item) ?? []);
      // Counted over the items that got a card, so a count never promises
      // an item the grid can't show.
      const shown = own.filter((item) =>
        cards.some((card) => card.id === item.name)
      );
      return {
        id,
        index: libraryIndex(id, shown),
        itemLabel,
        items: cards,
        label,
        searchPlaceholder,
        slug,
      };
    }),
  };
};
