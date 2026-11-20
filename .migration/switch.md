# switch

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean, checked in the browser.

## Changed

- `components/ui/switch.tsx`: `@base-ui/react/switch`; `data-[state=checked|unchecked]:*` → `data-checked:*` / `data-unchecked:*`; `disabled:*` → `data-disabled:*`.
- Call-site selectors `[data-slot=switch-thumb][data-state=checked]` → `[data-slot=switch-thumb][data-checked]` (press-stretch) in `registry/blocks/billing-settings/ui.tsx`, `registry/blocks/profile-settings-03/profile-extras.tsx`, `registry/blocks/security-settings/security-alerts.tsx`, `app/prototypes/billing-summary/variants/shared.tsx`.
- Leftover scan: clean.

## Left alone

- Thumb transition classes unchanged.

## Behavior changes

- Root renders `<span role="switch">` instead of `<button>`; keyboard and click behave the same.

## Verify by hand

- Security settings alerts: click a switch (thumb moves 14px, track turns primary); Space toggles it; press and hold: the thumb stretches toward its end.
