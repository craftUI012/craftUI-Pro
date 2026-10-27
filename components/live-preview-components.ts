import type { LivePreview } from "@/constants/live-previews";
import { ImageSphere } from "@/registry/blocks/image-sphere";
import BenchmarksSection from "@/registry/sections/benchmarks-section";
import HeroSection from "@/registry/sections/hero-section";
import HeroSection02 from "@/registry/sections/hero-section-02";
import TablesSection from "@/registry/sections/tables-section";
import TablesSection02 from "@/registry/sections/tables-section-02";
import TeamSection from "@/registry/sections/team-section";

// The component behind each live preview (constants/live-previews.ts),
// rendered alone by the /preview/[name] page. Only that page imports this
// file, so docs pages keep loading just the section they show.
export const LIVE_PREVIEW_COMPONENTS: Record<LivePreview, React.ComponentType> =
  {
    "benchmarks-section": BenchmarksSection,
    "hero-section": HeroSection,
    "hero-section-02": HeroSection02,
    "image-sphere": ImageSphere,
    "tables-section": TablesSection,
    "tables-section-02": TablesSection02,
    "team-section": TeamSection,
  };
