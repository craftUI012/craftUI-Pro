import type {
  HomeData,
  IndexGroup,
  Library,
  LibraryId,
  ShowcaseItem,
} from "@/components/new-hero-section/data/home-types";
import { ROUTES } from "@/constants/routes";
import { source } from "@/lib/source";
import aiHero01 from "@/public/images/AIHero01.png";
import registry from "@/registry.json";

// The browse page's data, built from registry.json. An item shows up in a
// library when it has `meta.library`; everything else in the registry
// (libs, helpers, dependencies like avatar-grid) stays out. Per item:
//
//   categories         → the "Categories" index group
//   meta.library       → which library: "components" | "blocks" | "templates"
//                        (templates is shown as "Sections")
//   meta.section       → the library's type group (Primitives / Type)
//   meta.styles        → the "Styles" index group
//   meta.publishedAt   → "Latest" order and the rail's What's new
//   meta.docs          → the docs page it lives on, when that isn't its own
//                        name (hero-section-02 → the hero-section page). The
//                        card links to that page, #<name> for a variant.
//   meta.preview       → the card's screenshot (path under /public);
//                        a placeholder until the preview script makes them
//   meta.popularity    → "Most popular" order (install analytics, later)
//   meta.pro           → the Pro badge
//
// Index groups are built from whatever values the items carry, so a new
// category, type or style needs no code change. Values are slugs; labels come
// from LABELS or are sentence-cased from the slug.

interface ItemMeta {
  docs?: string;
  library?: string;
  popularity?: number;
  preview?: string;
  pro?: boolean;
  publishedAt?: string;
  section?: string;
  styles?: string[];
}

interface RegistryItem {
  categories?: string[];
  description?: string;
  meta?: ItemMeta;
  name: string;
  title?: string;
}

// Labels a slug can't produce by sentence-casing.
const LABELS: Record<string, string> = {
  "sound-and-haptics": "Sound & haptics",
};

const labelOf = (slug: string) =>
  LABELS[slug] ??
  slug.charAt(0).toUpperCase() + slug.slice(1).replaceAll("-", " ");

// Per-library copy, and the label of its type group (meta.section).
const LIBRARIES: {
  id: LibraryId;
  itemLabel: Library["itemLabel"];
  label: string;
  searchPlaceholder: string;
  sectionLabel: string;
}[] = [
  {
    id: "components",
    itemLabel: { one: "component", other: "components" },
    label: "Components",
    searchPlaceholder: "Search components…",
    sectionLabel: "Primitives",
  },
  {
    id: "blocks",
    itemLabel: { one: "block", other: "blocks" },
    label: "Blocks",
    searchPlaceholder: "Search blocks…",
    sectionLabel: "Type",
  },
  {
    id: "templates",
    itemLabel: { one: "section", other: "sections" },
    label: "Sections",
    searchPlaceholder: "Search sections…",
    sectionLabel: "Type",
  },
];

// A group with more than this many links splits over two columns.
const ONE_COLUMN_MAX = 5;

// Placeholder screenshot for items without meta.preview.
const PLACEHOLDER = {
  blurDataURL: aiHero01.blurDataURL,
  height: aiHero01.height,
  src: aiHero01.src,
  width: aiHero01.width,
};

// One index group from the values the items carry, in first-seen order.
// Empty groups are dropped.
const indexGroup = (
  id: string,
  label: string,
  values: string[]
): IndexGroup[] => {
  const unique = [...new Set(values)];
  if (unique.length === 0) {
    return [];
  }
  return [
    {
      columns: unique.length > ONE_COLUMN_MAX ? 2 : 1,
      id,
      label,
      links: unique.map((slug) => ({ id: slug, label: labelOf(slug) })),
    },
  ];
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
  const name = item.title ?? labelOf(item.name);
  const href = `${ROUTES.DOCS}/${library}/${page}${
    page === item.name ? "" : `#${item.name}`
  }`;

  return {
    href,
    icon: { glyph: name.slice(0, 1) },
    id: item.name,
    isPro: meta.pro === true,
    name,
    popularity: meta.popularity ?? 0,
    preview: meta.preview
      ? { alt: `${name} preview`, height: 1000, src: meta.preview, width: 1600 }
      : { ...PLACEHOLDER, alt: `${name} preview` },
    publishedAt: meta.publishedAt ?? "",
    tagline: item.description ?? "",
    tags: [
      ...(item.categories ?? []).map((slug) => `categories:${slug}`),
      ...(meta.section ? [`sections:${meta.section}`] : []),
      ...(meta.styles ?? []).map((slug) => `styles:${slug}`),
    ],
  };
};

export const buildHomeDataFromRegistry = (): HomeData => {
  const items = registry.items as RegistryItem[];

  return {
    feeds: [
      { id: "latest", label: "Latest" },
      { id: "popular", label: "Most popular" },
    ],
    libraries: LIBRARIES.map(({ sectionLabel, ...library }) => {
      const own = items.filter((item) => item.meta?.library === library.id);
      return {
        ...library,
        index: [
          ...indexGroup(
            "categories",
            "Categories",
            own.flatMap((item) => item.categories ?? [])
          ),
          ...indexGroup(
            "sections",
            sectionLabel,
            own.flatMap((item) => item.meta?.section ?? [])
          ),
          ...indexGroup(
            "styles",
            "Styles",
            own.flatMap((item) => item.meta?.styles ?? [])
          ),
        ],
        items: own.flatMap((item) => toShowcaseItem(library.id, item) ?? []),
      };
    }),
  };
};
