"use client";

import { useRef } from "react";

import { StatementSection } from "@/registry/sections/statement-section";

// The docs preview iframe grows to fit its content, so it never scrolls
// and a pinned, scroll-driven section would never move in it. This gives
// the section a scroll box of its own, a screen tall, with a lead-in and a
// lead-out, and passes it as the section's `scroller`.
const StatementSectionPreview = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollerRef}
      className="bg-background h-[44rem] overflow-y-auto [scrollbar-width:thin]"
    >
      <div className="text-muted-foreground grid h-[44rem] place-items-center font-mono text-[0.6875rem] tracking-[0.08em] uppercase">
        Scroll ↓
      </div>
      <StatementSection scroller={scrollerRef} />
      <div className="text-muted-foreground grid h-[44rem] place-items-center font-mono text-[0.6875rem] tracking-[0.08em] uppercase">
        End of section
      </div>
    </div>
  );
};

export default StatementSectionPreview;
