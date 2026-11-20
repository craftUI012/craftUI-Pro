# toggle

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean, checked in the browser.

## Changed

- `components/ui/toggle.tsx`: callable `Toggle` from `@base-ui/react/toggle`; `data-[state=on]:*` → `data-pressed:*`; on/off sounds kept (`onPressedChange(pressed, details)` forwarded).
- `components/pricing-survey.tsx`: `data-[state=on]:bg-accent` → `data-pressed:bg-accent`.
- Leftover scan: clean.

## Left alone

- `components/site-settings.tsx`: no changes.

## Behavior changes

None.

## Verify by hand

- Site settings: flip a toggle; the on/off sound plays and it highlights.
