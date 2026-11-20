# button

2026-11-20 · transformation engine (legacy style new-york: no base golden; own file rewired, classes kept) · migrated, typecheck and build clean.

## Changed

- `components/ui/button.tsx`: `Slot` (radix-ui) → `Button` primitive from `@base-ui/react/button`; `asChild` removed, `render` + `nativeButton` come from `ButtonPrimitive.Props`. Kept every class (press scale 0.96, optical padding, hit areas), `sound`, `haptic` and `static`.
- Same file: when `nativeButton={false}` and a `render` element are passed (a link styled as a button), it renders through `useRender` + `mergeProps` instead of the primitive, so the `<a>` keeps link semantics. See Behavior changes.
- 30 consumer files: `<Button asChild><X …>kids</X></Button>` → `<Button nativeButton={false} render={<X … />}>kids</Button>` (41 by `scripts/codemods/as-child-to-render.mjs --tags Button`, 2 by hand: `components/docs-copy-page.tsx` (render from MENU_ITEMS, typed `React.ReactElement`), `components/new-hero-section/browse/browse-top-bar.tsx` (comment child)). Includes registry items: `registry/blocks/profile-settings/settings-nav.tsx`, `registry/blocks/security-settings/settings-nav.tsx`, `registry/sections/brands-section/brands-section.tsx`, `registry/sections/editorial-section.tsx`.
- `components/registry-add-button.tsx`, `components/ui/sidebar.tsx` (SidebarTrigger): click handlers typed from `Button`'s `onClick` (Base UI passes `BaseUIEvent<…>`).
- `oxlint.config.ts`: `jsx-a11y/anchor-has-content` off (false positive for `render={<a … />}`, whose content is the button's children).
- Leftover scan: `grep -n "radix-ui\|@radix-ui" components/ui/button.tsx` → clean.

## Left alone

- Other wrappers still on radix that compose Button (sidebar's Slot uses, dialogs' close buttons): migrated in their own steps.
- Commented-out code in `browse-top-bar.tsx` (old top bar) still says `asChild`; it isn't compiled.
- `registry-paid/*.json` and `public/r`: rebuilt once at the end of the migration.

## Behavior changes

- Base UI's Button with `nativeButton={false}` adds `role="button"` and button key handling to any element. For link-buttons that would announce links as buttons, so the wrapper renders them with `useRender` instead (deliberate deviation from "always ButtonPrimitive", limited to `nativeButton={false}` + `render`). Verified: `<a>` without role, Enter navigates.
- Click handlers receive `BaseUIEvent` (adds `preventBaseUIHandler()`); existing handlers are unaffected.

## Verify by hand

- Tab to "Get Started", "Pricing", "Sign in": each is announced as a link and Enter opens it.
- Click "Copy code" on /pricing: still a button, still copies, click sound plays.
- Hold a button: it scales to 0.96; a disabled button doesn't.
