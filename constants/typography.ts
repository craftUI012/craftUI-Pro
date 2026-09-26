// Responsive type roles. Each role has sm / md / lg tokens in
// styles/globals.css; the class strings below are written out in full so
// Tailwind picks them up. Mobile-first: the -sm token is the base.

export const TYPE_ROLES = [
  "heading-hero",
  "heading-display",
  "heading-section",
  "heading-panel",
  "page-lead",
  "card-header",
  "card-description",
  "card-body",
  "card-label",
  "card-caption",
  "card-eyebrow",
  "card-metric",
  "card-metric-hero",
] as const;

export const TYPE_SIZES = ["sm", "md", "lg"] as const;

export const TYPE = {
  cardBody: "text-card-body-sm md:text-card-body-md lg:text-card-body-lg",
  cardCaption:
    "text-card-caption-sm md:text-card-caption-md lg:text-card-caption-lg",
  cardDescription:
    "text-card-description-sm md:text-card-description-md lg:text-card-description-lg",
  cardEyebrow:
    "text-card-eyebrow-sm md:text-card-eyebrow-md lg:text-card-eyebrow-lg",
  cardHeader:
    "text-card-header-sm md:text-card-header-md lg:text-card-header-lg",
  cardLabel: "text-card-label-sm md:text-card-label-md lg:text-card-label-lg",
  cardMetric:
    "text-card-metric-sm md:text-card-metric-md lg:text-card-metric-lg",
  cardMetricHero:
    "text-card-metric-hero-sm md:text-card-metric-hero-md lg:text-card-metric-hero-lg",
  headingDisplay:
    "text-heading-display-sm md:text-heading-display-md lg:text-heading-display-lg",
  headingHero:
    "text-heading-hero-sm md:text-heading-hero-md lg:text-heading-hero-lg",
  headingPanel:
    "text-heading-panel-sm md:text-heading-panel-md lg:text-heading-panel-lg",
  headingSection:
    "text-heading-section-sm md:text-heading-section-md lg:text-heading-section-lg",
  pageLead: "text-page-lead-sm md:text-page-lead-md lg:text-page-lead-lg",
} as const;
