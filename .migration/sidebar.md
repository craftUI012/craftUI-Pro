# sidebar

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept; useRender shape from the base-nova golden) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/sidebar.tsx`: Radix `Slot` removed. `SidebarGroupLabel`, `SidebarGroupAction`, `SidebarMenuButton`, `SidebarMenuAction`, `SidebarMenuSubButton` take `render` instead of `asChild` and render through `useRender` + `mergeProps` (same classes, `data-slot` / `data-sidebar` / `data-size` / `data-active` kept as string attributes so `data-[active=true]` still matches). Menu-button sound kept. Converted with an AST script so the multi-line class expressions moved intact.
- Earlier (tooltip step): `TooltipProvider delay={0}`, menu-button tooltip `render={button}`.
- Call sites `asChild` → `render` (codemod): `components/docs-sidebar.tsx` (2), `components/new-hero-section/browse/browse-rail.tsx` (1).
- Leftover scan: clean; no `radix-ui` import remains in app, components or registry.

## Left alone

- None.

## Behavior changes

None.

## Verify by hand

- /docs-admin: sidebar links are real `<a>`s; click "Local setup": it navigates and becomes the active row.
- `DocsSidebar` and `BrowseRail` aren't rendered anywhere right now (the rail is commented out in browse-shell), so they're typecheck-only.
