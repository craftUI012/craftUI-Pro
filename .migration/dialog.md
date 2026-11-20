# dialog

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck + lint clean, checked in the browser.

## Changed

- `components/ui/dialog.tsx`: `@base-ui/react/dialog`; `Overlay` → `Backdrop` (export name `DialogOverlay` kept), `Content` → `Popup`; `data-[state=open|closed]` → `data-open|closed`, keeping the tw-animate enter/exit (Base UI waits for running animations before unmounting); dead `data-[state=open]` classes on the close button dropped; sounds kept (`onOpenChange(open, details)`).
- `registry/blocks/billing-settings/payment-methods-dialog.tsx` (direct primitive): `radix-ui` → `@base-ui/react/dialog`; `Content` → `Popup`; `onOpenAutoFocus` → `initialFocus` (returns the active method tab via a popup ref); `onCloseAutoFocus` → `finalFocus={opener}`; motion strings to `data-open|closed`; Close parts `asChild` → `render`.
- `registry/blocks/security-settings/two-factor.tsx`: `onCloseAutoFocus` → `finalFocus` (opener if still there, else the sign-in card).
- `components/ui/command.tsx`: `CommandDialog` children narrowed to `ReactNode` (Base UI's Root also accepts a function child). `components/command-menu.tsx`: leftover props typed as the Button's, since that's where they're spread.
- Triggers/closes `asChild` → `render` (codemod): registry-add-button, command-menu, admin user/purchase/resource forms, email-editor.
- `components/pricing-survey.tsx`: `data-[state=closed]:duration-150` → `data-closed:duration-150`.
- Leftover scan: clean.

## Left alone

- `components/ui/drawer.tsx` (vaul) and its `DrawerTrigger asChild` call sites: not radix, untouched.

## Behavior changes

- The popup no longer sets `aria-modal`; Base UI makes the outside inert instead.

## Verify by hand

- Billing preview: Manage payment methods opens with focus on the active tab; switch tabs, height eases; Escape, Cancel and the backdrop close it; focus returns to the button.
- Security settings: Sign out of all other sessions → confirm dialog focuses Cancel; 2FA Turn on → Escape returns focus to Turn on.
- Not verified here: the ⌘K command menu (lives in `SiteHeader`, which no page renders now) and the pricing exit survey.
