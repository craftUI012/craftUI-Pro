"use client";

import type * as React from "react";

import type { LibraryId } from "@/components/new-hero-section/data/home-types";
import { TabsContent } from "@/components/ui/tabs";
import { SITE } from "@/constants/site";

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
    {/* The page's one h1, for search engines and screen readers. The design
        has no visible title (the navbar tabs and the index say it), so it's
        visually hidden, and it states exactly what the page shows. */}
    <h1 className="sr-only">
      {SITE.NAME}: shadcn/ui sections, blocks, illustrations and isometric art
    </h1>
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
