# Changelog

Rules change only with the user's approval (`SKILL.md`, Updating this skill). Write a proposal under Proposed, ask, and move it to Approved after a yes.

## Proposed

| Date | What we saw | Proposed rule | Changes |
|---|---|---|---|
| 2026-11-04 | Benchmark 1 (Site of Sites) is recognizable from any single frame by a fixed brand frame | Add a series frame to every showcase: a fixed craftUI band at top and bottom (outside the safe zones' content), the same on every video | `types/showcase.md` Frame; `reels/remotion/Reel.tsx` |
| 2026-11-04 | Benchmark 1 lets the product's motion play at real time with long, calm holds and only 2 cuts in 27s | Raise point scenes to 4 to 6s, keep at most one 0.25× replay per video, and prefer continuity over any cut | `types/showcase.md` Scenes, Inside a point scene |
| 2026-11-04 | Benchmark 1's media fills only 39% of the height; it reads small on a phone | Keep our rule that the component fills the clip's width, and size the clip to at least 55% of the frame's height | `types/showcase.md` Frame; `reels/spec.ts` LAYOUT |

## Approved

| Date | Version | Change |
|---|---|---|
| 2026-11-04 | 0.1.1 | Theme removed from the brief (user): light and dark is a feature to show; the director picks the opening theme and the showcase adds a shot in the other theme for `dark-mode` components |
| 2026-11-04 | 0.1.0 | First version: shared rules, showcase type, feature audit, focus marks, benchmark rubric. Stageshow is the only scene skill. |
