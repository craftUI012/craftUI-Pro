"use client";

import { useRef } from "react";

import { EditorialSection } from "@/registry/sections/editorial-section";

// The docs preview iframe grows to fit its content, so it never scrolls
// and a pinned, scroll-driven section would never move in it. This gives
// the section a scroll box of its own, exactly one stage tall, and passes
// it as the section's `scroller`: scrolling in the box slides the cards
// into their stack.
const EditorialSectionPreview = () => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollerRef}
      className="bg-background h-[44rem] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <EditorialSection scroller={scrollerRef} />
    </div>
  );
};

export default EditorialSectionPreview;
