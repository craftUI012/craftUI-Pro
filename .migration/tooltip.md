# tooltip

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept; Positioner shape from the base-nova golden) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/tooltip.tsx`: `@base-ui/react/tooltip`; Portal > Positioner (`isolate z-50`) > Popup; `align`/`alignOffset`/`side`/`sideOffset` declared, destructured and forwarded to the Positioner (defaults kept: `sideOffset = 0`, side top); `delayDuration` → `delay` on the provider; `data-[state=closed]` → `data-closed`; origin → `--transform-origin`; the Arrow gets per-side offsets (Base UI positions a div, not Radix's svg wrapper).
- Triggers `asChild` → `render` (codemod `--tags TooltipTrigger`): copy-button, docs-nav-link, github-stars, preview-toolbar, mode-switcher, truncated-text, billing card-slot, `components/ui/sidebar.tsx` (menu button tooltip).
- `delayDuration` → `delay`: `components/new-hero-section/browse/truncated-text.tsx` (moved to the Trigger), `components/ui/sidebar.tsx`, `registry/blocks/billing-settings/payment-methods-dialog.tsx` (providers).
- Leftover scan: clean. Verified: mode-switcher tooltip flips below at the top edge with the arrow pointing at the icon; leaves on pointer out.

## Left alone

- `components/ui/sidebar.tsx` otherwise still uses Radix `Slot` (migrates on its own).

## Behavior changes

- Tooltip triggers don't take `nativeButton`; rendering a span/link is fine.

## Verify by hand

- Hover the theme toggle in the docs header: tooltip appears instantly, arrow points at the icon.
- Browse cards: a truncated title shows its tooltip after the delay; a short one doesn't.
