# context-menu

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept; Positioner + SubContent shape from the base-nova golden) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/context-menu.tsx`: `@base-ui/react/context-menu`; Portal > Positioner > Popup (main menu stays pointer-anchored; positioning props only forwarded when given); submenu parts renamed as in dropdown-menu; SubContent composes Content with `side="right" align="start" alignOffset={4} sideOffset={0}`.
- `components/brand-context-menu.tsx`: `ContextMenuTrigger asChild` → `render={children}`; `children` typed `ReactElement`.
- Leftover scan: clean.

## Left alone

- None.

## Behavior changes

None.

## Verify by hand

- Home: right-click the logo: menu opens at the pointer with Copy as SVG / Download as SVG; Escape closes it.
