# separator

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean.

## Changed

- `components/ui/separator.tsx`: `Separator.Root` → callable `Separator` from `@base-ui/react/separator`; `decorative` prop dropped (no consumer passed it). Classes unchanged.
- Leftover scan: clean. Verified on /docs/blocks/billing-settings: vertical 16×1, border colour.

## Left alone

Consumers (docs-copy-page, preview-toolbar, code-collapsible-wrapper, command-menu, sidebar): no prop changes needed.

## Behavior changes

- **Flag:** Radix's default `decorative` rendered `role="none"`; Base UI always renders `role="separator"` with `aria-orientation`. Screen readers now hear the separators between toolbar buttons. Not patched (skill rule); if they should stay silent, pass `role="none"` / `aria-hidden` at those call sites.

## Verify by hand

- On a docs page, tab through the preview toolbar with VoiceOver: the dividers are announced as separators (expected change).
