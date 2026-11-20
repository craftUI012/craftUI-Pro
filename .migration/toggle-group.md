# toggle-group

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean, checked in the browser.

## Changed

- `components/ui/toggle-group.tsx`: callable `ToggleGroup` (`@base-ui/react/toggle-group`); items are Base UI `Toggle`s.
- 8 consumer files via `scripts/codemods/toggle-group-values.mjs` (55 edits): `type="single"` removed, values wrapped in arrays, handlers `(v) => …` → `([v = ""]) => …` (body untouched; deselect still arrives as ""); `type="multiple"` → `multiple`. Files: email-editor, reel-studio, app-cards, finance-cards, feature-visuals, device-preview, strip-pieces, pricing-survey. One by hand: reel-studio view toggle `value={value ? [value] : []}`.
- Leftover scan: clean.

## Left alone

- None.

## Behavior changes

- **Flag:** `rovingFocus={false}` isn't possible in Base UI (always roving); none used it.
- Clicking the pressed item in a single group clears it, as Radix single mode did.

## Verify by hand

- Design admin: switch Cooking → Dining; multi group: press Stocks and REITs alongside ETFs.
- Home templates device preview: switch Hero/Team and Mobile/Tablet/Desktop.
