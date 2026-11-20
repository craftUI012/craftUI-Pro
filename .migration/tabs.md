# tabs

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/tabs.tsx`: `@base-ui/react/tabs`; `Trigger` → `Tab`, `Content` → `Panel`; `data-[state=active]` → `data-active`; sounds kept.
- `components/command-box.tsx`, `components/code-block-command.tsx`, `components/new-hero-section/browse/browse-top-bar.tsx`: `data-[state=active]` → `data-active`; command-box panel `asChild` → `render={<span />}`.
- `components/new-hero-section/browse/browse-panels.tsx`: `forceMount` → `keepMounted`, `data-[state=inactive]:hidden` → `data-hidden:hidden`.
- `registry/blocks/billing-settings/payment-methods-dialog.tsx`: tab classes `data-[state=inactive]` → `not-data-active`, `data-[state=active]` → `data-active`, the indicator query `[data-state=active]` → `[data-active]`; the swap panel moved inside its `motion.div` with `keepMounted` + `hidden={false}` so the leaving panel stays visible while it fades.
- Leftover scan: clean.

## Left alone

- Dialog classes in `payment-methods-dialog.tsx` (`data-[state=open|closed]`): migrate with dialog.

## Behavior changes

- Base UI tabs default to manual activation. Restored to the Radix behaviour (2026-11-20, at the user's request): `TabsList` defaults `activateOnFocus` to true, and the registry call sites (billing dialog, tables-section-02) set it, so buyers get it too. Verified: ArrowRight selects the next tab on the site and in a Base UI buyer project.
- Base UI selects the first tab when no default is given (Radix selected none); every consumer passes a value.

## Verify by hand

- Browse top bar: click Blocks; the URL becomes `?library=blocks` and only that panel shows.
- /docs/installation: switch pnpm → npm; the command changes.
- Billing preview, Manage payment methods: switch Cards → PayPal (cross-fade, height glides); arrow keys select tabs.
