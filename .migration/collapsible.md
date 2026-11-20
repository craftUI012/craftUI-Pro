# collapsible

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/collapsible.tsx`: `@base-ui/react/collapsible`; `Content` → `Panel`; expand/collapse sounds kept (`onOpenChange(open, details)` forwarded).
- `components/code-collapsible-wrapper.tsx`: `forceMount` → `keepMounted`; the panel's `hidden` is overridden through `render` because the closed state still shows a 16rem preview (Base UI hides a closed panel); `data-[state=closed]` → `data-closed`, `group-data-[state=open]` → `group-data-open`. The top trigger was `asChild` on a div holding a Button + Separator; the Button is now the trigger (`render={<Button />}`) so no div gets `role="button"` around a nested button.
- Leftover scan: clean.

## Left alone

- None.

## Behavior changes

- Only the "Collapse/Expand" button toggles now, not the separator beside it (it was inside the old trigger div).

## Verify by hand

- Not verified here: the code wrapper renders only for unlocked source. On a docs page with unlocked code: the closed block shows ~16rem with the fade; "Expand" opens it and the label flips to "Collapse"; "Collapse" returns it.
