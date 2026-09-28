import FeaturesTemplate from "@/components/hero-templates/sections/features";
import HeroTemplate from "@/components/hero-templates/sections/hero";
import TeamTemplate from "@/components/hero-templates/sections/team";
import type { TemplateSlug } from "@/components/hero-templates/templates-data";

// The component behind each template option. To swap in a real section,
// replace its file in this folder (keep the default export) or point the
// entry here at the new component. Adding an option: add it to TEMPLATES in
// templates-data.ts and an entry here; the preview route and the picker
// follow automatically.
export const TEMPLATE_COMPONENTS: Record<TemplateSlug, React.ComponentType> = {
  features: FeaturesTemplate,
  hero: HeroTemplate,
  team: TeamTemplate,
};
