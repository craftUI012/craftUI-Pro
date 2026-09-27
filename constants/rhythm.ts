// Vertical rhythm: one minor and one major unit for every vertical gap in page
// layout (tokens in styles/globals.css). Ask one question per gap: same group
// → minor, new group → major. Anything else is a deliberate exception.
//
// Class strings are written out in full so Tailwind picks them up.
// Mobile-first, like TYPE: the -sm value is the base.

export const RHYTHM_SPACING = [
  "minor",
  "major-sm",
  "major-lg",
  "section-sm",
  "section-lg",
] as const;

export const RHYTHM = {
  // Between groups inside a section: header → grid → CTA.
  major: "gap-major-sm lg:gap-major-lg",
  // Inside a group: eyebrow → heading → paragraph, title → meta.
  minor: "gap-minor",
  // Top and bottom padding of a page section: 2 × major.
  section: "py-section-sm lg:py-section-lg",
} as const;
