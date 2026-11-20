# avatar

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean.

## Changed

- `components/ui/avatar.tsx`: `Avatar.Root/Image/Fallback` from `@base-ui/react/avatar`; types `AvatarPrimitive.<Part>.Props`. Classes, sizes, AvatarBadge/Group/GroupCount unchanged.
- Leftover scan: clean. Verified on /preview/profile-settings-02: images load at 32px and 56px.

## Left alone

- No consumer used `delayMs` (Base UI: `delay` on Fallback).

## Behavior changes

None.

## Verify by hand

- Profile settings 02: the sidebar and personal-details avatars show the photo; with a broken image URL the initials show.
