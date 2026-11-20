# aspect-ratio

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean.

## Changed

- `components/ui/aspect-ratio.tsx`: no Base UI counterpart → `<div>` with CSS `aspect-ratio` (`ratio` prop, default 1) and `relative w-full`, so `next/image fill` children stay inside.
- Leftover scan: clean.

## Left alone

- No consumers in the project (only an SVG `preserveAspectRatio` attribute matched).

## Behavior changes

- Radix nested an absolutely positioned inner box; the new one is a single box sized by `aspect-ratio`. Children that relied on the inner `absolute inset-0` wrapper would need `absolute inset-0` themselves (none exist).

## Verify by hand

- None (unused).
