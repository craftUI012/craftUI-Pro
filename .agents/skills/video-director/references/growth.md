# Growth: hook, ask, series and formats

A reel grows when people stop, watch to the end, watch again, comment and share. The craft gets them to stop; this file is what makes them act. Every pattern here comes from the benchmark reels (`references/benchmark.md`).

Status: **Built** in the video page (`reels/video/reel.tsx`, exports in `scripts/video.mjs`) except comparison scenes and the comment-to-DM automation, which are Planned. The handle and the ask are constants in `lib/studio/options.ts` (`SOCIAL_HANDLE`, `VIDEO_ASK`: "Link in bio" until the automation exists).

## The first second

- **Frame 1 is the finished product on its ground,** never a logo or a blank; the hook's words then build onto it (Built). The cover is taken once they have.
- **The hook words build in,** one word or phrase at a time, 70 to 90ms apart, a 400ms rise each (@anmoldoesmotion's "One place to imagine / build / discover"). The full hook is on screen by 1.0s.
- **The product moves by 0.3s.** The scroller decides in under a second.
- **Hook formats that work for a UI library,** in order:
  1. **Question:** "Why does this gallery feel expensive?"
  2. **Choice:** "Light or dark? Comment which." Only with a real comparison scene (below).
  3. **Bold claim about the craft:** "Every photo here is on a spring."
  4. **Stop doing:** "Stop shipping carousels that just slide."

## The ask

- **Comment to get it.** The end card and the hook's last beat carry one ask: "Comment CRAFT for the code" (@avi_vashishta29, @simo.dsgn). It needs a comment-to-DM automation on the account that replies with the component's link; until that exists, the ask is "Link in bio: <component name>".
- **One ask per video,** in the same words every time, so the audience learns it.
- **The ask is on screen for at least 2.5s** and sits inside the safe zones.

## The series

People follow a series, not a one-off. Every video carries the same signature:

- **The handle** (for example @craftui) small in the top-right corner of the safe zone, the whole video (@_code_and_chill_).
- **A 0.5s sting** at the start of the end card: the craftUI mark settling into place, the same every time.
- **One caption style:** the same font, sizes and placement in every video (Built: the caption band).
- **A named format** when a run of videos shares a structure ("Why it feels good: <component>"), stated in the eyebrow of the hook.

## Comparison scenes

"Which is better? First or second?" (@avi_vashishta29, 7.2k likes) turns watchers into commenters. A comparison scene shows two real variants side by side or one after the other, and the hook asks which. Real only:

- the component in light and in dark (needs the `dark-mode` style);
- the component at desktop and phone width;
- two prop variants the component really has (from `content/agent-reference.json`).

Never build a worse version to beat ("before"); that's a fabricated comparison.

## Formats

| Export | Size | Where |
|---|---|---|
| Reel | 1080 × 1920, 9:16 | Reels, TikTok, Shorts (Built) |
| Feed | 1080 × 1350, 4:5, cropped from the reel's central area (`<name>-4x5.mp4`) | The Instagram grid and carousels (Built) |
| Cover | The hook's finished frame (about 1.6s, once its words have built) at both sizes (`<name>-cover.jpg`, `<name>-cover-4x5.jpg`) | The grid thumbnail (Built) |

The reel is composed so its caption and component fit inside the central 4:5 area (`references/look.md`, Scale), so one render gives all three.

## Length

15 seconds by default; the most-liked benchmarks ran 11 to 20s. 30s only when a component has five or more strong features. A shorter reel that's watched to the end and replayed beats a longer one that's dropped halfway.
