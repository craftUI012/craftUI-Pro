"use client";

import { useRef } from "react";

import { StatementSection } from "@/registry/sections/statement-section";

// The docs preview iframe grows to fit its content, so it never scrolls
// and a pinned, scroll-driven section would never move in it. This gives
// the section a scroll box of its own, exactly one stage tall, and passes
// it as the section's `scroller`: the box opens on the stage itself, and
// its whole scroll is the section's pinned scroll, so scrolling in it only
// grows the image, ending on it full screen.
const StatementSectionPreview = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollerRef}
      className="bg-background h-[44rem] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <StatementSection scroller={scrollerRef} />
    </div>
  );
};

export default StatementSectionPreview;
