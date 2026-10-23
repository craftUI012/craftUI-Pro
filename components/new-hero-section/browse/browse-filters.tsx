"use client";

import type * as React from "react";
import { createContext, use, useMemo, useState } from "react";

import type { FilterGroupId, LibraryId } from "@/constants/taxonomy";

// What's picked in each filter group of one library, e.g.
// { categories: ["marketing", "company"], styles: ["motion"] }. Several picks
// in one group widen the result (OR); picks in different groups narrow it
// (AND): Marketing or Company, and Motion.
export type BrowseSelection = Partial<Record<FilterGroupId, string[]>>;

// Every library's selection. Kept per library, so switching tabs and back
// keeps what was picked.
export type BrowseSelections = Partial<Record<LibraryId, BrowseSelection>>;

// Tag an item carries for one index value, as used in ShowcaseItem.tags.
export const indexTag = (groupId: FilterGroupId, linkId: string) =>
  `${groupId}:${linkId}`;

// The groups with at least one pick, in a stable order.
export const pickedGroups = (selection: BrowseSelection) =>
  (Object.entries(selection) as [FilterGroupId, string[] | undefined][])
    .filter((entry): entry is [FilterGroupId, string[]] =>
      Boolean(entry[1]?.length)
    )
    .toSorted(([a], [b]) => a.localeCompare(b));

// OR within a group, AND across groups.
export const matchesSelection = (
  tags: string[] | undefined,
  selection: BrowseSelection
) =>
  pickedGroups(selection).every(([groupId, values]) =>
    values.some((value) => tags?.includes(indexTag(groupId, value)))
  );

const toggleValue = (
  selection: BrowseSelection,
  groupId: FilterGroupId,
  value: string
): BrowseSelection => {
  const current = selection[groupId] ?? [];
  return {
    ...selection,
    [groupId]: current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value],
  };
};

interface BrowseFiltersStore {
  selections: BrowseSelections;
  setSelections: React.Dispatch<React.SetStateAction<BrowseSelections>>;
}

const BrowseFiltersStoreContext = createContext<BrowseFiltersStore | null>(
  null
);

// Holds every library's selection. Rendered by the shell (browse-shell.tsx),
// which owns the state so it can keep the URL in sync with it.
export const BrowseFiltersStoreProvider = ({
  children,
  selections,
  setSelections,
}: BrowseFiltersStore & { children: React.ReactNode }) => {
  const value = useMemo(
    () => ({ selections, setSelections }),
    [selections, setSelections]
  );
  return (
    <BrowseFiltersStoreContext value={value}>
      {children}
    </BrowseFiltersStoreContext>
  );
};

// A store with its own state, for pages without the shell (the navigation
// prototypes): filters work, but aren't kept in the URL.
export const BrowseFiltersLocalStore = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selections, setSelections] = useState<BrowseSelections>({});
  return (
    <BrowseFiltersStoreProvider
      selections={selections}
      setSelections={setSelections}
    >
      {children}
    </BrowseFiltersStoreProvider>
  );
};

const BrowseLibraryScopeContext = createContext<LibraryId | null>(null);

// Marks which library a panel belongs to, so its index (which sets the
// selection) and its feed (which filters by it) share that library's
// selection. One per library panel (new-home.tsx).
export const BrowseLibraryScope = ({
  children,
  library,
}: {
  children: React.ReactNode;
  library: LibraryId;
}) => (
  <BrowseLibraryScopeContext value={library}>
    {children}
  </BrowseLibraryScopeContext>
);

export const useBrowseFilters = () => {
  const store = use(BrowseFiltersStoreContext);
  const library = use(BrowseLibraryScopeContext);
  if (!store || !library) {
    throw new Error(
      "useBrowseFilters must be used inside BrowseFiltersStoreProvider and BrowseLibraryScope"
    );
  }
  const { selections, setSelections } = store;

  return {
    clear: () => setSelections((current) => ({ ...current, [library]: {} })),
    selection: selections[library] ?? {},
    toggle: (groupId: FilterGroupId, value: string) =>
      setSelections((current) => ({
        ...current,
        [library]: toggleValue(current[library] ?? {}, groupId, value),
      })),
  };
};
