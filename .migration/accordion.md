# accordion

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/accordion.tsx`: `@base-ui/react/accordion`; `Content` → `Panel`; chevron rotates on `[data-panel-open]`; open/close height is a transition on `--accordion-panel-height` with `data-starting-style:h-0` / `data-ending-style:h-0` (the tw-animate keyframes only read `--radix-accordion-content-height`). Sounds kept.
- `type="multiple"` → `multiple`: `app/(app)/about/page.tsx`, `app/(app)/skills/isometrics/page.tsx`, `components/pricing-plans.tsx`.
- `components/design-admin/finance-cards.tsx`: `type="single" collapsible defaultValue="security"` → `defaultValue={["security"]}`.
- `components/hero-features/features-showcase.tsx` (direct radix import): `value={[open]}`, `onValueChange={([value]) => …}` (still keeps one open), Panel with the same height transition.
- Leftover scan: clean. Verified: open 0→56px and close 56→0 over ~12 frames; multiple mode keeps 2 open; features accordion keeps one open.

## Left alone

- **Deviation from the skill's golden shape:** the height transition sits on the Panel itself (Base UI docs pattern), not the inner div; the inner div never receives `data-starting-style`, so the golden placement doesn't animate here.

## Behavior changes

- Single mode is always collapsible (Radix `collapsible={false}` gone); features-showcase still blocks closing the open item.
- Arrow keys no longer move between headers (Base UI follows the newer APG guidance); Tab moves between them.

## Verify by hand

- Pricing FAQ: open and close two questions; the height slides, the chevron flips.
- Old home features: click each feature; one is always open.
