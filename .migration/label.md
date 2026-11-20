# label

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean.

## Changed

- `components/ui/label.tsx`: no Base UI Label primitive → native `<label>` with the same classes and `data-slot`. `jsx-a11y/label-has-associated-control` silenced on the wrapper only (callers pass `htmlFor`).
- 16 consumers unchanged (props are a subset).
- Leftover scan: clean.

## Left alone

- Inside Base UI `Field`s, `Field.Label` is the right part; none exist yet.

## Behavior changes

- Radix Label prevented text selection on double-click via `onMouseDown`; the native label relies on the existing `select-none` class (same visible result).

## Verify by hand

- Click a field's label: focus moves into the field (profile and billing forms).
