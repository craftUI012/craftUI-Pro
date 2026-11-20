# radio-group

2026-11-20 · transformation engine (legacy style new-york; own file rewired, classes kept) · migrated, typecheck clean, checked in the browser.

## Changed

- `components/ui/radio-group.tsx`: group → callable `RadioGroup` (`@base-ui/react/radio-group`), items → `Radio.Root` / `Radio.Indicator` (`@base-ui/react/radio`); `disabled:*` → `data-disabled:*`.
- Leftover scan: clean.

## Left alone

- Consumers (strip pieces, finance cards, profile settings 03 handle field): no prop changes.

## Behavior changes

- `orientation` / `loop` props dropped (arrow keys work on both axes; focus always wraps). No consumer passed them.

## Verify by hand

- Profile settings 03: pick a handle suggestion with the arrow keys and Space.
