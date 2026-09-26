"use client";

import dynamic from "next/dynamic";

// The wall renders 18 live kit cards (charts included), so it ships as its
// own chunk, loaded after the heading has painted. Client-only: it's a
// decorative preview with no SEO value, and skipping SSR keeps the initial
// HTML small.
export const HeroWallLazy = dynamic(
  async () => {
    const { HeroWall } = await import("@/components/hero-section/hero-wall");

    return HeroWall;
  },
  { loading: () => null, ssr: false }
);
