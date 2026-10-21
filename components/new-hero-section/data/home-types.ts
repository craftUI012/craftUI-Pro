// Data shape for the new home page, modelled on Mobbin's browse screen:
//
//   ┌──────────────┬────────────────────────────── [Search ⌘K] ♥ ◐ ⚙ ─┐
//   │ craftUI Pro  │ Categories   Sections              Styles       │
//   │              │ Forms        Hero      Pricing     Minimal      │
//   │ Library      │ …            …         …           …            │
//   │ ▍Components 6│                                                 │
//   │  Blocks     6│ Latest  Most popular              6 components  │
//   │  Templates  6│ ┌────────┐ ┌────────┐ ┌────────┐                │
//   │              │ │preview │ │preview │ │preview │  ← ShowcaseItem│
//   │ Resources    │ └────────┘ └────────┘ └────────┘                │
//   │  Docs …      │ (icon) Name / tagline                           │
//   └──────────────┴─────────────────────────────────────────────────┘
//
// Everything must stay plain JSON (strings, numbers, arrays, objects):
// getHomeData caches it with `unstable_cache`, which serialises the value.

import type { FilterGroupId, LibraryId } from "@/constants/taxonomy";

// Libraries and filter groups are defined in constants/taxonomy.ts.
export type { FilterGroupId, LibraryId } from "@/constants/taxonomy";

// One value in the index above the grid. Picking it filters the grid to items
// whose `tags` include `<group id>:<value id>`. The values a library lists
// come from constants/taxonomy.ts; `id` is the slug.
export interface IndexLink {
  id: string;
  label: string;
  // How many of the library's items carry it. 0 shows the value dimmed and
  // not clickable (listed, but nothing published yet).
  count: number;
}

// One column group of the index. `columns: 2` splits the links over two grid
// columns, as Mobbin's "Sections" does.
export interface IndexGroup {
  id: FilterGroupId;
  label: string;
  columns: 1 | 2;
  links: IndexLink[];
}

// The icon tile next to a card's name (Mobbin: the app icon).
// WHEN WE SHIP REAL DATA: `src` is the item's icon from the registry
// (`meta.icon`, a square SVG/PNG). Until then `glyph` (one or two letters) is
// drawn on the brand fill.
export interface ShowcaseIcon {
  glyph: string;
  src?: string;
}

// The screenshot inside a card.
// WHEN WE SHIP REAL DATA: `meta.preview` from the registry item, a 16:10
// screenshot, 1600px wide or more, made by the preview script (the
// template-preview route can render it). Keep width/height for next/image.
export interface ShowcasePreview {
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL?: string;
}

// One card in the grid.
// WHEN WE SHIP REAL DATA, from each registry.json item:
//   id        ← item.name
//   name      ← item.title
//   tagline   ← item.description (one line; card truncates the rest)
//   href      ← /docs/components/<name> (or /blocks, /templates)
//   icon      ← item.meta.icon
//   preview   ← item.meta.preview
//   publishedAt ← item.meta.publishedAt (ISO date) → "Latest" order
//   popularity  ← installs over the last 30 days (analytics) → "Most popular"
//   isPro     ← item.meta.pro, to badge paid items
//   tags      ← "<group>:<slug>" for each of item.categories, item.meta.types
//               and item.meta.styles (matches the index; see IndexLink)
export interface ShowcaseItem {
  id: string;
  name: string;
  tagline: string;
  href: string;
  icon: ShowcaseIcon;
  preview: ShowcasePreview;
  publishedAt: string;
  popularity: number;
  tags: string[];
  isPro?: boolean;
}

// The feed tabs above the grid (Mobbin: Latest / Most popular).
export type FeedId = "latest" | "popular";

export interface Library {
  id: LibraryId;
  label: string;
  // The library's key in the browse page's URL (/?library=blocks).
  slug: string;
  // Nouns for the result count: "1 component", "6 components".
  itemLabel: { one: string; other: string };
  searchPlaceholder: string;
  index: IndexGroup[];
  items: ShowcaseItem[];
}

export interface HomeData {
  libraries: Library[];
  feeds: { id: FeedId; label: string }[];
}
