# checkbox

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean, checked in the browser.

## Changed

- `components/ui/checkbox.tsx`: `@base-ui/react/checkbox`, types `CheckboxPrimitive.Root.Props`. Root now renders a `<span>` + hidden input, so `disabled:*` → `data-disabled:*`; `data-[state=checked]:*` → `data-checked:*`.
- `components/design-admin/finance-cards.tsx`: "Select all" `checked={"indeterminate"}` → `checked` (boolean) + `indeterminate` (committed with the slider/toggle-group step, same file).
- `components/ui/label.tsx`: added `peer-data-disabled:*` next to `peer-disabled:*` (the peer control is a span now).
- Leftover scan: clean.

## Left alone

- `registry/sections/tables-section*.tsx`, `registry/blocks/security-settings/*`: no prop changes needed.

## Behavior changes

- Indicator also shows for `indeterminate` (same visual as before: the check icon).
- `onCheckedChange` receives `(checked: boolean, details)`; existing handlers unaffected.

## Verify by hand

- Tables section: click a row checkbox (checks, primary fill); the header checkbox reads "mixed" when some rows are checked.
- Tab to a checkbox, press Space: toggles.
