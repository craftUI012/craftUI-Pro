import { FILTER_GROUPS, LIBRARIES, POOLS } from "@/constants/taxonomy";
import type { FilterGroupId, LibraryId } from "@/constants/taxonomy";

// Reads and checks registry items against the filter vocabulary in
// constants/taxonomy.ts. Kept free of Next.js imports: scripts/build-registry.mjs
// loads it too, so a bad slug fails `pnpm registry:build` before anything ships.

export interface TaxonomyRegistryItem {
  name: string;
  categories?: string[];
  meta?: {
    // Free to install without a plan. Everything else is paid.
    free?: unknown;
    // The product code purchases store, e.g. "SEC-0001" (see
    // LibraryConfig.idPrefix).
    id?: unknown;
    library?: string;
    publishedAt?: string;
    // Renamed to `types` (an item can have several). Still read, only to
    // point at the rename.
    section?: unknown;
    styles?: string[];
    types?: string[];
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRODUCT_ID = /^([A-Z]{3})-(\d{4})$/;

// Groups an item must tag at least one value in. Styles can be empty: not
// every item has a style worth filtering on.
const REQUIRED_GROUPS = new Set<FilterGroupId>(["categories", "types"]);

export const isLibraryId = (value: unknown): value is LibraryId =>
  typeof value === "string" && Object.hasOwn(LIBRARIES, value);

// An item's slugs per filter group. Categories are a top-level registry field
// (the shadcn schema has one); types and styles live in `meta`.
export const itemFilterValues = (
  item: TaxonomyRegistryItem
): Record<FilterGroupId, string[]> => ({
  categories: item.categories ?? [],
  styles: item.meta?.styles ?? [],
  types: item.meta?.types ?? [],
});

const fieldOf: Record<FilterGroupId, string> = {
  categories: "categories",
  styles: "meta.styles",
  types: "meta.types",
};

// Every problem with the registry's browse metadata, as readable lines.
// Items without `meta.library` aren't browse items (libs, helpers) and are
// skipped.
export const validateRegistryTaxonomy = (
  items: TaxonomyRegistryItem[]
): string[] => {
  const errors: string[] = [];
  // Product code → the item that took it, to catch a code used twice.
  const ids = new Map<string, string>();

  for (const item of items) {
    const { meta } = item;
    if (meta?.library === undefined) {
      continue;
    }
    const at = `"${item.name}"`;

    if (!isLibraryId(meta.library)) {
      errors.push(
        `${at}: meta.library "${meta.library}" isn't a library. Use one of: ${Object.keys(LIBRARIES).join(", ")}.`
      );
      continue;
    }
    const library = LIBRARIES[meta.library];

    if (meta.section !== undefined) {
      errors.push(
        `${at}: meta.section was renamed to meta.types (an array), e.g. "types": ["${String(meta.section)}"].`
      );
    }
    if (!meta.publishedAt || !ISO_DATE.test(meta.publishedAt)) {
      errors.push(`${at}: meta.publishedAt must be a YYYY-MM-DD date.`);
    }

    // The product code: purchases point at it, so it must exist, match the
    // library and never be shared. Never change one that has been sold.
    const idMatch =
      typeof meta.id === "string" ? PRODUCT_ID.exec(meta.id) : null;
    if (!idMatch) {
      errors.push(
        `${at}: meta.id must be a product code like "${library.idPrefix}-0001" (the next unused number for ${library.label}).`
      );
    } else if (idMatch[1] !== library.idPrefix) {
      errors.push(
        `${at}: meta.id "${String(meta.id)}" must start with "${library.idPrefix}-", the ${library.label} prefix.`
      );
    } else if (ids.has(idMatch[0])) {
      errors.push(
        `${at}: meta.id "${idMatch[0]}" is already used by "${ids.get(idMatch[0])}". Give it the next unused number.`
      );
    } else {
      ids.set(idMatch[0], item.name);
    }
    if (meta.free !== undefined && typeof meta.free !== "boolean") {
      errors.push(`${at}: meta.free must be true or false.`);
    }

    const values = itemFilterValues(item);
    for (const group of FILTER_GROUPS) {
      const slugs = values[group.id];
      if (REQUIRED_GROUPS.has(group.id) && slugs.length === 0) {
        errors.push(`${at}: ${fieldOf[group.id]} needs at least one value.`);
      }
      const listed: readonly string[] = library[group.id];
      for (const slug of slugs) {
        if (!Object.hasOwn(POOLS[group.id], slug)) {
          errors.push(
            `${at}: ${fieldOf[group.id]} "${slug}" isn't defined. Add it to the ${group.id.toUpperCase()} pool in constants/taxonomy.ts, or fix the slug.`
          );
        } else if (!listed.includes(slug)) {
          errors.push(
            `${at}: ${fieldOf[group.id]} "${slug}" isn't listed for the ${library.label} library. Add it to LIBRARIES.${meta.library}.${group.id} in constants/taxonomy.ts.`
          );
        }
      }
    }
  }

  return errors;
};

export const assertRegistryTaxonomy = (items: TaxonomyRegistryItem[]) => {
  const errors = validateRegistryTaxonomy(items);
  if (errors.length > 0) {
    throw new Error(
      `registry.json browse metadata doesn't match constants/taxonomy.ts:\n${errors.map((line) => `  - ${line}`).join("\n")}`
    );
  }
};
