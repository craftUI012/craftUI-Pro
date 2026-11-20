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
- `components.json` style stays `new-york`. **Flag:** to the shadcn CLI that style still means Radix, so `shadcn add <component>` here would deliver Radix variants. Either switch the style to a `base-*` one (which restyles anything re-added) or add new components by hand.
- `registry/blocks/mrr-movements.tsx`: with real data and no `now` prop it reads `Date.now()` inside a `useMemo` during render (the demo uses a fixed date). Same class of issue as the tables; not hit by the demo, not changed.

## Behavior changes

- Tabs: manual activation (arrow keys move focus, Enter/Space selects).
- Menus: radio items stay open after a pick (MRR month picker, tables status/priority pickers); a `DropdownMenuLabel` must sit inside a `DropdownMenuGroup`.
- Accordion: arrow keys no longer move between headers; single mode is always collapsible.
- Dialog: no `aria-modal`; the outside is made inert instead.
- Separator: always `role="separator"`.
- `PopoverAnchor` removed (use `anchor` on PopoverContent).
- Buyers now need a Base UI shadcn project (`base-*` style). Radix-style projects will hit type errors on `render`, `onClick` menu items, and Base UI data attributes.

## Verify by hand

- Not reachable headlessly during the run: ⌘K command menu (lives in `SiteHeader`, which no page renders), site settings popover (inside the commented-out browse rail), docs copy menu's mobile trigger, code-block Expand/Collapse (unlocked source only), pricing exit survey.
- Everything else was click-tested in the site and in the buyer project; see each component's report.
