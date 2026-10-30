import { FILTER_GROUPS, LIBRARIES, POOLS } from "@/constants/taxonomy";
import type {
  FilterGroupId,
  LibraryConfig,
  LibraryId,
} from "@/constants/taxonomy";

// Reads and checks registry items against the filter vocabulary in
// constants/taxonomy.ts. Kept free of Next.js imports: scripts/build-registry.mjs
// loads it too, so a bad slug fails `pnpm registry:build` before anything ships.

export interface TaxonomyRegistryItem {
  name: string;
  categories?: string[];
  meta?: {
    // Free to install without a plan. Everything else is paid.
    free?: unknown;
    // The product code purchases store, e.g. "SEC-7K3QX9" (see
    // LibraryConfig.idPrefix). Left out on a new item: the registry build
    // gives it one.
    id?: unknown;
    library?: string;
    publishedAt?: string;
    // Renamed to `types` (an item can have several). Still read, only to
    // point at the rename.
    section?: unknown;
    styles?: string[];
    types?: string[];
    // Who it's for, in a founder's words ("Agency and studio portfolios"):
    // what AI agents match a request against (lib/agent-reference.ts).
    useCases?: unknown;
  };
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
// A product code: the library's prefix, then six random characters
// ("SEC-7K3QX9") from Crockford's base 32, which has no I, L, O or U, so a
// code read out or retyped is never mistaken. Random, not counted, so two
// people adding items on separate branches never pick the same one.
// Codes from before (four digits, "SEC-0013") are still valid: purchases
// store them, so they never change.
const PRODUCT_ID = /^([A-Z]{3})-(\d{4}|[0-9A-HJKMNP-TV-Z]{6})$/;
const PRODUCT_ID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const PRODUCT_ID_LENGTH = 6;

/**
 * A new random product code for the library with this prefix, not one in
 * `taken`. 32^6 is about a billion codes per prefix, so a repeat is all but
 * impossible, and the check below catches it if one ever happens.
 */
export const newProductId = (prefix: string, taken: ReadonlySet<string>) => {
  let code: string;
  do {
    // 256 is a multiple of 32, so `% 32` keeps every character equally likely.
    const bytes = crypto.getRandomValues(new Uint8Array(PRODUCT_ID_LENGTH));
    const body = Array.from(bytes, (byte) => PRODUCT_ID_ALPHABET[byte % 32]);
    code = `${prefix}-${body.join("")}`;
  } while (taken.has(code));
  return code;
};

// Groups an item must tag at least one value in. Styles can be empty: not
// every item has a style worth filtering on.
const REQUIRED_GROUPS = new Set<FilterGroupId>(["categories", "types"]);

// meta.useCases: a short list of short phrases, so each one reads as a tag.
const USE_CASES = { max: 5, maxLength: 60, min: 2 };

const useCaseErrors = (at: string, useCases: unknown): string[] => {
  const example = `e.g. "useCases": ["SaaS landing pages", "Product launch pages"]`;
  if (!Array.isArray(useCases)) {
    return [`${at}: meta.useCases is missing: list who it's for, ${example}.`];
  }
  const errors: string[] = [];
  if (useCases.length < USE_CASES.min || useCases.length > USE_CASES.max) {
    errors.push(
      `${at}: meta.useCases needs ${USE_CASES.min} to ${USE_CASES.max} entries (it has ${useCases.length}).`
    );
  }
  for (const useCase of useCases) {
    if (typeof useCase !== "string" || useCase.trim() === "") {
      errors.push(`${at}: meta.useCases entries must be text, ${example}.`);
    } else if (useCase.length > USE_CASES.maxLength) {
      errors.push(
        `${at}: meta.useCases "${useCase}" is over ${USE_CASES.maxLength} characters. Keep each to a short phrase.`
      );
    } else if (useCase.endsWith(".")) {
      errors.push(
        `${at}: meta.useCases "${useCase}" shouldn't end with a period.`
      );
    }
  }
  return errors;
};

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

/** What's wrong with an item's product code, if anything: missing, not a
 * code, another library's prefix, or taken already (`ids`: code → item). */
const productIdError = (
  at: string,
  id: unknown,
  library: LibraryConfig,
  ids: ReadonlyMap<string, string>
) => {
  const match = typeof id === "string" ? PRODUCT_ID.exec(id) : null;
  if (!match) {
    return id === undefined
      ? `${at}: meta.id is missing. Run \`pnpm registry:build\` locally: it gives the item a product code and writes it into registry.json, to commit with the item.`
      : `${at}: meta.id "${String(id)}" isn't a product code. Remove it and run \`pnpm registry:build\` locally for a new one, like "${library.idPrefix}-7K3QX9".`;
  }
  const [code, prefix] = match;
  if (prefix !== library.idPrefix) {
    return `${at}: meta.id "${code}" must start with "${library.idPrefix}-", the ${library.label} prefix.`;
  }
  if (ids.has(code)) {
    return `${at}: meta.id "${code}" is already used by "${ids.get(code)}". If this is the new item, remove its meta.id and run \`pnpm registry:build\` for a new one.`;
  }
  return null;
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
    // A new item has none until `pnpm registry:build` adds one.
    const idError = productIdError(at, meta.id, library, ids);
    if (idError) {
      errors.push(idError);
    } else {
      ids.set(String(meta.id), item.name);
    }
    if (meta.free !== undefined && typeof meta.free !== "boolean") {
      errors.push(`${at}: meta.free must be true or false.`);
    }
    errors.push(...useCaseErrors(at, meta.useCases));

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
