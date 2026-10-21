"use client";

import type * as React from "react";

import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { TabsContent } from "@/components/ui/tabs";

// The browse page's content: one server-rendered index + grid per library,
// passed in as slots. Each is a TabsContent of the shell's <Tabs>
// (browse-shell.tsx), so the navbar tab picks which one shows. All of them
// are force-mounted so they're in the prerendered HTML; the inactive ones are
// display:none, so their lazy images don't load until picked.
export const BrowsePanels = ({
  order,
  panels,
}: {
  order: LibraryId[];
  panels: Record<LibraryId, React.ReactNode>;
}) => (
  <main className="container flex flex-col gap-16 pt-8 pb-24 md:gap-20 md:pt-6">
    {order.map((id) => (
      <TabsContent
        key={id}
        value={id}
        forceMount
        className="flex flex-col gap-16 data-[state=inactive]:hidden md:gap-24"
      >
        {panels[id]}
      </TabsContent>
    ))}
  </main>
);
