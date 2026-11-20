# badge

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean.

## Changed

- `components/ui/badge.tsx`: radix `Slot` → `useRender` + `mergeProps` (`@base-ui/react/use-render`, `merge-props`), props `useRender.ComponentProps<"span">`; data-* literal cast as the skill's worked example says. Classes unchanged.
- Call sites `asChild` → `render` (no `nativeButton`: a badge isn't a button), via the codemod with NO_NATIVE=1: `components/announcement.tsx`, `components/docs-article.tsx` (2), `registry/sections/feature-section-05/source-chat.tsx`.
- `scripts/codemods/as-child-to-render.mjs`: NO_NATIVE option.
- Leftover scan on badge.tsx: clean.

## Left alone

- `components/announcement.tsx` isn't rendered anywhere today; covered by typecheck only.

## Behavior changes

None.

## Verify by hand

- /docs pages with `links` front matter show the Docs / API Reference badges as links opening in a new tab (no page uses them yet).
- Feature section 05 source chat: source chips still render as links.
