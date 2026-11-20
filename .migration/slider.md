# slider

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean, checked in the browser.

## Changed

- `components/ui/slider.tsx`: Base UI anatomy `Root > Control > Track > (Indicator, Thumb…)`; `Range` → `Indicator`; `thumbAlignment="edge"` (Radix look); `data-[disabled]` → `data-disabled`; accepts a single number or an array.
- Call sites: single-thumb sliders now pass a number and narrow the callback (`typeof v === "number"`): `components/admin-panel/studio/reel-studio.tsx` (3), `reel-stage.tsx`, `reel-soundtrack.tsx`; range slider in `components/design-admin/finance-cards.tsx` keeps an array.
- Leftover scan: clean.

## Left alone

- `components/hero-UI-components/strip-pieces.tsx` (`defaultValue={[70]}`): still valid.

## Behavior changes

- `onValueChange` passes the shape you gave it (number or array) plus event details; `onValueCommit` would be `onValueCommitted` (none used).

## Verify by hand

- Design admin "Minimum Payout Amount": arrow keys move it by 50, the fill follows.
- Reel studio: drag the text-size and dim sliders.
