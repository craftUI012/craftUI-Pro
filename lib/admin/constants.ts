// Plain values the admin panel's client forms and its server actions share
// (no server imports, so client components can use them).

// Every status a purchase can have: ours ("active", "refunded") and the
// subscription statuses Dodo sends. Only "active" grants access.
export const PURCHASE_STATUSES = [
  "active",
  "refunded",
  "cancelled",
  "expired",
  "on_hold",
  "past_due",
  "failed",
  "paused",
] as const;

export const PURCHASE_KINDS = ["lifetime", "yearly", "item"] as const;

// The kinds of resource the admin panel's Resources page keeps (stored as
// `category` on each resource document, lib/db/schema.ts). Add one here to
// get its tab, form option and validation.
export const RESOURCE_CATEGORIES = [
  { id: "website", label: "Websites", one: "Website" },
  // People who share great design work on X (link to their X profile).
  // Stored as "people", its first name, so saved resources kept their
  // category when it was renamed.
  { id: "people", label: "Designers on X", one: "Designer on X" },
  { id: "x-post", label: "X posts", one: "X post" },
] as const;

export type ResourceCategory = (typeof RESOURCE_CATEGORIES)[number]["id"];

export const isResourceCategory = (value: unknown): value is ResourceCategory =>
  RESOURCE_CATEGORIES.some((category) => category.id === value);

// A resource's tags as stored: lowercase, words joined by "-", no repeats,
// at most 20, each at most 40 characters. "Design Systems, motion, AI/ML"
// becomes ["design-systems", "motion", "ai-ml"]. The form shows the same result as you type.
export const MAX_RESOURCE_TAGS = 20;

export const normalizeTags = (input: string | string[]) =>
  [
    ...new Set(
      (Array.isArray(input) ? input : input.split(","))
        .map((tag) =>
          tag
            .trim()
            .toLowerCase()
            .replaceAll(/[^\p{L}\p{N}]+/gu, "-")
            .replaceAll(/^-|-$/g, "")
            .slice(0, 40)
        )
        .filter(Boolean)
    ),
  ].slice(0, MAX_RESOURCE_TAGS);
