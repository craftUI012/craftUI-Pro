// Registry items whose docs preview runs in an iframe (/preview/<name>) at
// the device width picked in the preview toolbar: inside the iframe the
// window is that wide, so the item's sm / md / lg / xl breakpoints switch
// exactly as they would on a phone, tablet or desktop. Everything else (the
// screenshot previews, the docs-admin examples) renders inline in the box.
//
// Only names live here, so a docs page that checks the list doesn't pull in
// every section's code; the components are mapped in
// components/live-preview-components.ts, which TypeScript keeps in step with
// this list. Adding a live item: its name here, its component there.
export const LIVE_PREVIEWS = [
  "arc-carousel",
  "benchmarks-section",
  "feature-section-02",
  "feature-section-03",
  "feature-section-04",
  "feature-sphere-section",
  "gallery-section",
  "hero-section",
  "hero-section-02",
  "image-sphere",
  "statement-section",
  "tables-section",
  "tables-section-02",
  "team-section",
  "testimonials-section",
] as const;

export type LivePreview = (typeof LIVE_PREVIEWS)[number];

export const isLivePreview = (name: string): name is LivePreview =>
  (LIVE_PREVIEWS as readonly string[]).includes(name);

// What a preview page posts to the docs page around it: its height, so the
// box can fit it with no scrollbar of its own.
export const PREVIEW_SIZE_MESSAGE = "craftui:preview-size";
