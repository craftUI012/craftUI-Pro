# progress

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean, checked in the browser.

## Changed

- `components/ui/progress.tsx`: `Root > Track > Indicator` from `@base-ui/react/progress`; Base UI computes the fill (Indicator `width: N%`), so the manual `translateX` is gone. The caller's `className` now goes on the Track (the visible bar), as it styled the bar before.
- Leftover scan: clean. Verified on /design-admin: 65% → 258/397px.

## Left alone

- None.

## Behavior changes

- Root gains `aria-valuetext="65%"` and Base UI's visually hidden live text.

## Verify by hand

- Design admin: progress bars fill to their values; the landing page's tilted hero wall shows them at 8px tall.
