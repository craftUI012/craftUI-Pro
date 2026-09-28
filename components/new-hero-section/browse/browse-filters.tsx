"use client";

import type * as React from "react";
import { createContext, use, useMemo, useState } from "react";

// Which index item is picked in each group of one library, e.g.
// { categories: "forms", styles: "motion" }. At most one per group; picking
// the selected item again clears it.
export type BrowseSelection = Partial<Record<string, string>>;

interface BrowseFiltersValue {
  selection: BrowseSelection;
  toggle: (groupId: string, linkId: string) => void;
  clear: () => void;
}

const BrowseFiltersContext = createContext<BrowseFiltersValue | null>(null);

// Tag an item carries for one index item, as used in ShowcaseItem.tags.
export const indexTag = (groupId: string, linkId: string) =>
  `${groupId}:${linkId}`;

// Selection state for one library panel, shared by its index (which sets it)
// and its feed (which filters by it). Each library panel has its own
// provider, so switching libraries and back keeps what was picked.
export const BrowseFiltersProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [selection, setSelection] = useState<BrowseSelection>({});

  const value = useMemo<BrowseFiltersValue>(
    () => ({
      clear: () => setSelection({}),
      selection,
      toggle: (groupId, linkId) =>
        setSelection((current) => ({
          ...current,
          [groupId]: current[groupId] === linkId ? undefined : linkId,
        })),
    }),
    [selection]
  );

  return <BrowseFiltersContext value={value}>{children}</BrowseFiltersContext>;
};

export const useBrowseFilters = () => {
  const value = use(BrowseFiltersContext);
  if (!value) {
    throw new Error(
      "useBrowseFilters must be used inside BrowseFiltersProvider"
    );
  }
  return value;
};
