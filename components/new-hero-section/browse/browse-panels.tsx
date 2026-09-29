"use client";

import type * as React from "react";

import { useActiveLibrary } from "@/components/new-hero-section/browse/browse-shell";
import type { LibraryId } from "@/components/new-hero-section/data/home-types";

// The browse page's content: one server-rendered index + grid per library,
// passed in as slots. The library picked in the rail (shell context) is
// shown; the others stay in the HTML but `hidden`, so their lazy images don't
// load until picked.
export const BrowsePanels = ({
  order,
  panels,
}: {
  order: LibraryId[];
  panels: Record<LibraryId, React.ReactNode>;
}) => {
  const active = useActiveLibrary();

  return (
    // md:pt-6 is paired with the rail's Library group padding
    // (browse-rail.tsx) so "Library" and "Categories" share a line. Change
    // one side, change the other.
    <main className="container flex flex-col gap-16 pt-8 pb-24 md:gap-20 md:pt-6">
      {order.map((id) => (
        <div
          key={id}
          hidden={id !== active}
          className="flex flex-col gap-16 md:gap-24"
        >
          {panels[id]}
        </div>
      ))}
    </main>
  );
};
