# sheet

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/sheet.tsx`: `@base-ui/react/dialog`; `Overlay` → `Backdrop`, `Content` → `Popup`; per-side slide classes keep tw-animate, keyed on `data-open|closed`; sounds kept.
- `SheetTrigger asChild` → `render` (codemod): `registry/blocks/billing-settings/app-shell.tsx`, `registry/blocks/profile-settings-02/app-shell.tsx`, `app/prototypes/billing-summary/variants/dashboard-shell.tsx`.
- `registry/sections/tables-section-02.tsx`: reduced-motion fade overrides `data-[state=*]` → `data-open|closed` (the `--tw-*-translate-x` overrides still apply because tw-animate is kept).
- Leftover scan: clean.

## Left alone

- None.

## Behavior changes

None.

## Verify by hand

- Profile settings 02 at phone width: the menu button slides the sheet in from the left (−220px → 0), focus moves in; Close slides it out and focus returns.
- Tables section 02: open a row's detail sheet with reduced motion on: it fades without sliding.
