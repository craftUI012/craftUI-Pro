# popover

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept; Positioner shape from the base-nova golden) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/popover.tsx`: `@base-ui/react/popover`; Portal > Positioner (`isolate z-50`) > Popup; `align`/`alignOffset`/`anchor`/`side`/`sideOffset` forwarded to the Positioner; open/close sounds kept (`onOpenChange(open, details)`); `data-[state=open|closed]` → `data-open|closed`; origin → `--transform-origin`.
- `PopoverAnchor` removed (no Base UI part). Its one use, `components/docs-copy-page.tsx`, now passes `anchor={groupRef}` so the menu still opens under the whole button group.
- Triggers `asChild` → `render` (codemod): docs-copy-page, site-settings, mobile-nav, phone-field ×3 (profile 02/03, security), verify-popover, handle-field.
- `components/mobile-nav.tsx`: `--radix-popper-available-height|width` → `--available-height|width`.
- Block popover motion strings (`registry/blocks/*/phone-field.tsx`, `profile-settings-03/motion.tsx` POPOVER_MOTION): `data-[state=open|closed]` → `data-open|closed`, origin var → `--transform-origin`, comments updated.
- Leftover scan: clean.

## Left alone

- `registry/blocks/profile-settings-03/settings-rail.tsx` `--radix-dropdown-menu-trigger-width`: migrates with dropdown-menu.

## Behavior changes

- **Flag:** `PopoverAnchor` export is gone (Base UI has no Anchor part); use `anchor` on PopoverContent.

## Verify by hand

- Not verified headlessly: the site settings popover (inside the browse rail) and the docs copy menu (its mobile trigger sits in a `hidden sm:block` wrapper, so it never shows). Open site settings from the rail: sound plays, Escape closes it, focus returns.
- Phone field (profile 02): open the country list near the bottom of the screen: it flips above and grows from the button; type "ind", Enter: it closes and focus goes to the number.
- Profile 03: Edit handle / Change email / Change phone: focus moves in, Escape closes, focus returns to the link.
