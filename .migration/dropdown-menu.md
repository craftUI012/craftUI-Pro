# dropdown-menu

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept; Positioner + SubContent shape from the base-nova golden) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/dropdown-menu.tsx`: `@base-ui/react/menu`; Portal > Positioner (`isolate z-50 outline-none`) > Popup; `align`/`alignOffset`/`collisionPadding`/`side`/`sideOffset` forwarded to the Positioner; `Sub` → `SubmenuRoot`, `SubTrigger` → `SubmenuTrigger` (open fill on `data-popup-open`), `Label` → `GroupLabel`, `ItemIndicator` → `CheckboxItemIndicator` / `RadioItemIndicator`; SubContent composes Content with submenu defaults (`side="right" align="start" alignOffset={-3} sideOffset={0}`); `--radix-*` → `--available-height` / `--transform-origin`; `data-[disabled]` → `data-disabled`; sounds kept.
- `asChild` → `render` (codemod, 15 sites): docs-copy-page, docs-toc, preview-copy-for-ai, docs-share-menu, preview-install-command, profile-settings-02 app-shell, profile-settings-03 settings-rail, profile-settings sign-in-methods; mrr-movements month trigger by hand.
- **`onSelect` → `onClick`** on items (Base UI has no `onSelect`; it still compiles as the DOM select event and never fires): browse-top-bar, profile-settings-02 app-shell (×4), sign-in-methods.
- Keep-open hack `onSelect={(e) => e.preventDefault()}` removed from checkbox items (tables-section, tables-section-02): Base UI checkbox items stay open by default.
- `onCloseAutoFocus` → `finalFocus`: docs-share-menu (`false`), browse-top-bar (`() => !openedByPointer.current`).
- Trigger selectors `data-[state=open]` → `data-popup-open` (browse-top-bar, tables-section-02); settings-rail `w-(--radix-dropdown-menu-trigger-width)` → `w-(--anchor-width)`.
- profile-settings-02 app-shell: labels wrapped in `DropdownMenuGroup` (Base UI throws on a GroupLabel outside a group).
- Also fixed here: `registry/blocks/security-settings/motion.tsx` POPOVER_MOTION (missed in the popover step).
- Leftover scan: clean.

## Left alone

- None.

## Behavior changes

- **Flag:** radio items no longer close the menu on pick (Base UI default `closeOnClick=false`; Radix closed). Affects the MRR month picker and the tables status/priority pickers. `closeOnClick` on the item restores it.
- **Flag:** `DropdownMenuLabel` must sit inside `DropdownMenuGroup` now.

## Verify by hand

- Home: UI kits menu: click Isometrics → URL `?library=isometrics`, menu closes; Enter opens with focus on the first item, Escape returns focus to the trigger.
- Tables section 02: Filter → hover Status (submenu opens to the right), tick a status: it checks and the menu stays open.
- Profile settings 02: switch workspace from the workspace menu.
- MRR movements: pick another month (the chart changes; menu stays open, see flag).
