// The browse page's filter vocabulary: the single place to add, rename or
// remove a library, a category, a type or a style.
//
//   1. POOLS: every category, type and style that exists, each defined once
//      (slug → label). The slug is what registry.json items use; the label is
//      what the filter shows.
//   2. LIBRARIES: per library (Sections, Blocks, …), which of those values its
//      filter index lists, in display order. A value can be listed by several
//      libraries ("dark-mode" in all of them, for example).
//   3. NAV_LIBRARIES: which libraries the navbar shows as tabs, in order.
//
// A registry item tags itself with slugs (one or more of each):
//
//   "categories": ["marketing"],
//   "meta": { "library": "templates", "types": ["hero"], "styles": ["motion"] }
//
// Every slug must be in its pool AND listed by the item's library, or
// `pnpm registry:build` (and the home page build) fails, naming the item and
// the slug (see lib/taxonomy.ts). So a typo can never ship silently.
//
// A listed value no item uses yet shows dimmed in the filter: it signals
// what's coming and keeps the index's layout stable as items land.
//
// Slugs: lowercase, words joined by "-" ("dark-mode"). Renaming a slug means
// renaming it in registry.json too; changing only a label is always safe.

export interface TaxonomyValue {
  label: string;
}

export const CATEGORIES = {
  ai: { label: "AI" },
  company: { label: "Company" },
  data: { label: "Data" },
  ecommerce: { label: "E-commerce" },
  finance: { label: "Finance" },
  marketing: { label: "Marketing" },
  people: { label: "People" },
  portfolio: { label: "Portfolio" },
  technology: { label: "Technology" },
} as const satisfies Record<string, TaxonomyValue>;

export const TYPES = {
  // One pool for every library; which ones a library lists (and in what
  // order) is set in LIBRARIES below.
  cards: { label: "Cards" },
  charts: { label: "Charts" },
  cta: { label: "CTA" },
  devices: { label: "Devices" },
  editorial: { label: "Editorial" },
  "empty-states": { label: "Empty states" },
  faq: { label: "FAQ" },
  features: { label: "Features" },
  footer: { label: "Footer" },
  forms: { label: "Forms" },
  gallery: { label: "Gallery" },
  hero: { label: "Hero" },
  objects: { label: "Objects" },
  pricing: { label: "Pricing" },
  scenes: { label: "Scenes" },
  settings: { label: "Settings" },
  spot: { label: "Spot" },
  stats: { label: "Stats" },
  tables: { label: "Tables" },
  team: { label: "Team" },
  testimonials: { label: "Testimonials" },
} as const satisfies Record<string, TaxonomyValue>;

export const STYLES = {
  "dark-mode": { label: "Dark mode" },
  flat: { label: "Flat" },
  gradient: { label: "Gradient" },
  line: { label: "Line" },
  minimal: { label: "Minimal" },
  motion: { label: "Motion" },
} as const satisfies Record<string, TaxonomyValue>;

export type CategoryId = keyof typeof CATEGORIES;
export type TypeId = keyof typeof TYPES;
export type StyleId = keyof typeof STYLES;

// The three filter groups, in index order. `param` is the group's key in the
// browse page's URL (/?category=marketing,company&type=hero).
export const FILTER_GROUPS = [
  { id: "categories", label: "Categories", param: "category" },
  { id: "types", label: "Type", param: "type" },
  { id: "styles", label: "Styles", param: "style" },
] as const;

export type FilterGroupId = (typeof FILTER_GROUPS)[number]["id"];

export const POOLS: Record<FilterGroupId, Record<string, TaxonomyValue>> = {
  categories: CATEGORIES,
  styles: STYLES,
  types: TYPES,
};

export type LibraryId =
  | "components"
  | "templates"
  | "blocks"
  | "illustrations"
  | "isometric";

export interface LibraryConfig {
  label: string;
  // Prefix of every item's product code (meta.id, e.g. "SEC-0001"). The code
  // is what purchases store, so it never changes once an item is published,
  // even if the item's slug or title does. "TPL" is kept for full-page
  // templates, a separate product to come.
  idPrefix: string;
  // The library's key in the browse page's URL (/?library=blocks).
  slug: string;
  // Nouns for the result count: "1 block", "6 blocks".
  itemLabel: { one: string; other: string };
  searchPlaceholder: string;
  // What the Type group is called in this library, when not "Type".
  typeLabel?: string;
  // The values its filter index lists, in display order.
  categories: CategoryId[];
  types: TypeId[];
  styles: StyleId[];
}

export const LIBRARIES: Record<LibraryId, LibraryConfig> = {
  blocks: {
    categories: ["marketing", "data", "finance", "people", "portfolio"],
    idPrefix: "BLK",
    itemLabel: { one: "block", other: "blocks" },
    label: "Blocks",
    searchPlaceholder: "Search blocks…",
    slug: "blocks",
    styles: ["motion", "dark-mode", "minimal"],
    types: ["cards", "charts", "gallery", "forms", "tables", "settings"],
  },
  // Not a navbar tab for now (see NAV_LIBRARIES). Kept so its items still
  // validate and it's one line away from coming back.
  components: {
    categories: [],
    idPrefix: "CMP",
    itemLabel: { one: "component", other: "components" },
    label: "Components",
    searchPlaceholder: "Search components…",
    slug: "components",
    styles: ["motion", "dark-mode", "minimal"],
    typeLabel: "Primitives",
    types: [],
  },
  illustrations: {
    categories: ["marketing", "technology", "people", "ecommerce"],
    idPrefix: "ILL",
    itemLabel: { one: "illustration", other: "illustrations" },
    label: "Illustrations",
    searchPlaceholder: "Search illustrations…",
    slug: "illustrations",
    styles: ["flat", "line", "gradient", "dark-mode"],
    types: ["scenes", "spot", "empty-states"],
  },
  isometric: {
    categories: ["technology", "finance", "ecommerce", "data"],
    idPrefix: "ISO",
    itemLabel: { one: "isometric item", other: "isometric items" },
    label: "Isometric",
    searchPlaceholder: "Search isometric…",
    slug: "isometric",
    styles: ["flat", "gradient", "line", "dark-mode"],
    types: ["objects", "scenes", "devices"],
  },
  templates: {
    categories: ["marketing", "company", "data", "ai", "portfolio"],
    idPrefix: "SEC",
    itemLabel: { one: "section", other: "sections" },
    label: "Sections",
    searchPlaceholder: "Search sections…",
    slug: "sections",
    styles: ["motion", "dark-mode", "minimal"],
    types: [
      "hero",
      "editorial",
      "features",
      "pricing",
      "testimonials",
      "stats",
      "team",
      "tables",
      "faq",
      "cta",
      "footer",
    ],
  },
};

// The navbar's tabs, in order. The first is the browse page's default.
export const NAV_LIBRARIES: LibraryId[] = [
  "templates",
  "blocks",
  "illustrations",
  "isometric",
];
