import type { TemplateSlug } from "@/components/hero-templates/templates-data";
import BenchmarksTemplate from "@/registry/sections/benchmarks-section";
import HeroTemplate from "@/registry/sections/hero-section";
import TeamTemplate from "@/registry/sections/team-section";

// The component behind each template option. To swap in a real section,
// replace its file in registry/sections (keep the default export) or point
// the entry here at the new component. Adding an option: add it to
// TEMPLATES in templates-data.ts and an entry here; the preview route and
// the picker follow automatically.
export const TEMPLATE_COMPONENTS: Record<TemplateSlug, React.ComponentType> = {
  benchmarks: BenchmarksTemplate,
  hero: HeroTemplate,
  team: TeamTemplate,
};
