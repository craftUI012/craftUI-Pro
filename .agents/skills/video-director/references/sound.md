# Sound

Every benchmark reel has music. Ours were silent. Captions still carry the whole story, since most people watch muted, but a silent reel reads as unfinished to those who don't, and Instagram's reach favours reels with audio.

Status: **Planned.** The recorder films silent frames; sound is mixed in afterwards with ffmpeg, from the beat marks the recorder already logs (`shot-<i>`, `beat-<i>`).

## Two exports, always

1. **With our bed:** a royalty-free music track we hold the licence for, plus interface sounds. For TikTok, Shorts and posting as is.
2. **Sound effects only:** no music, so the admin can add a trending Instagram or TikTok sound in the app. Trending audio can't be baked into our file (we don't hold its licence), and it often reaches more people than any track we own.

## The music bed

- A small library in `reels/sound/` (Planned), each track tagged by mood and tempo: **calm** (80 to 95 bpm, for editorial and typography), **upbeat** (100 to 120 bpm, for interactions and dashboards), **tech** (110 to 128 bpm, for devtools and data). Only tracks with a licence that covers social posting; the licence file sits beside the track.
- The director picks the mood from the component and the hook; Studio can override it.
- **Cut on the beat:** scene changes are moved to the nearest beat (within 150ms) of the chosen track. The track's beat grid sits beside it as JSON.
- The bed starts at frame 0 (no silent lead-in) and fades out over the last 0.6s so the loop back to the hook is clean.
- Level: music at −18 LUFS, never covering the interface sounds.

## Interface sounds

Small, quiet, and only for things that happen on screen:

| On | Sound |
|---|---|
| A click or tap | A soft, short click (under 60ms) |
| A sweep or drag | A faint air movement for its length |
| A tile opening, a panel expanding | A low, short swell |
| A caption arriving (hook only) | Nothing, or one soft tick |
| The end card | One clean note |

No whooshes on cuts, no risers, no typing sounds on captions.
