# project

2026-11-20 · whole-project migration, Radix → Base UI (`@base-ui/react` 1.9.0) · complete: 0 wrappers on Radix, `radix-ui` removed, typecheck + lint clean, full `next build` passes (419 pages), registry rebuilt, real install in a Base UI buyer project passes.

## Changed

- **Wrappers (23, one commit each, bottom-up):** button, badge, label, separator, aspect-ratio, avatar, checkbox, switch, radio-group, progress, slider, toggle, toggle-group, collapsible, accordion, tabs, tooltip, popover, sheet, dialog, context-menu, dropdown-menu, sidebar (Slot → `useRender`). Every sound/haptic customisation kept. Per-component details in `.migration/<component>.md`.
- **Direct Radix imports:** `components/hero-features/features-showcase.tsx` (accordion) and `registry/blocks/billing-settings/payment-methods-dialog.tsx` (dialog) now import `@base-ui/react`.
- **Call sites (app, components, registry sections and blocks):** `asChild` → `render` via `scripts/codemods/as-child-to-render.mjs`; toggle-group values to arrays via `scripts/codemods/toggle-group-values.mjs`; Radix state selectors → Base UI data attributes; `--radix-*` → `--transform-origin` / `--available-height|width` / `--anchor-width`; focus hooks → `initialFocus` / `finalFocus`; menu `onSelect` → `onClick`.
- **Dependencies:** `radix-ui` removed from `package.json` and the lockfile. `@radix-ui/*` packages still appear in `node_modules` only as cmdk's and vaul's own dependencies.
- **Registry:** billing-settings depends on `@base-ui/react` instead of `radix-ui`; `pnpm registry:build` now refuses items with Radix imports or dependencies, `asChild`, Radix state selectors or `--radix-*` variables (`scripts/build-registry.mjs`), documented in docs-admin "Registry pipeline". Format-only rebuild churn reverted.
- **Found by the buyer install, fixed:** tables-section and tables-section-02 read `Date.now()` while rendering, which a Next 16 `cacheComponents` app refuses at build. First render now uses a fixed time; the clock takes over after mount. (Pre-existing, not caused by the migration.)
- **Docs-admin:** stack table and MDX component reference say Base UI.

## Left alone

- cmdk (`command`), vaul (`drawer`), sonner, input-otp, react-day-picker, recharts: not Radix wrappers, untouched.
- `components.json` style switched `new-york` → `base-nova` (2026-11-20), so `shadcn add` now delivers Base UI components. Existing files are unchanged; anything added later arrives in base-nova's look and may need restyling to match.
- Fixed after the run: `registry/blocks/mrr-movements.tsx` read `Date.now()` during render with real data and no `now`; the clock is now read after mount (the last change stands in for the first render).

## Behavior changes

- Tabs and menu radio items: Base UI's defaults differ (manual activation; radio items stay open). Both restored to the Radix behaviour in the wrappers and at every registry call site, verified on the site and in the buyer project.
- A `DropdownMenuLabel` must sit inside a `DropdownMenuGroup`.
- Accordion: arrow keys no longer move between headers; single mode is always collapsible.
- Dialog: no `aria-modal`; the outside is made inert instead.
- Separator: always `role="separator"`.
- `PopoverAnchor` removed (use `anchor` on PopoverContent).
- Buyers now need a Base UI shadcn project (`base-*` style). Radix-style projects will hit type errors on `render`, `onClick` menu items, and Base UI data attributes.

## Verify by hand

- The parts no page renders (⌘K menu, site settings popover, docs copy menu, code-block expand) were mounted on a temporary route and click-tested, then the route was removed; the pricing exit survey was triggered on /pricing. The browse rail and docs sidebar are still unused; their sidebar links share the component verified on /docs-admin.
- Everything else was click-tested in the site and in the buyer project; see each component's report.
