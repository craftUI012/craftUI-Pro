# Benchmark and score

We hold every video against the benchmark reels below; the strongest has 12k likes. A video ships when it scores **9 or higher on every criterion**, not just on average. Likes can't be promised; meeting the bar the most-liked reels set is what we control.

## Scoring

The best benchmark on a criterion sets 10 for that criterion. Score our video against it, 0 to 10, in whole or half points, with a one-line reason each.

| # | Criterion | 10 looks like | Set by |
|---|---|---|---|
| 1 | **Hook** | Frame 1 is finished and beautiful on its ground; the hook builds in by 1.0s; the product moves by 0.3s; you want the answer | @anmoldoesmotion, @avi_vashishta29 |
| 2 | **One point per scene** | With sound off, each scene's point can be named after one viewing | our rules |
| 3 | **Proof** | The ring lands exactly on what moved, with its real value, in every sampled frame | our rules |
| 4 | **Motion fidelity** | The real component, smooth at 60fps, true timing, real interactions with the cursor travelling | Site of Sites |
| 5 | **Pace** | Something changes every 1 to 3s; nothing still over a hold; total 11 to 20s for a 15s brief | @_pixel_motion_, @motionbyjawad |
| 6 | **Captions** | Readable in a second, at most 6 words, eyebrow and caption ranked, one style every video | @simo.dsgn |
| 7 | **Look** | A ground with depth that belongs to the component; the component fills 80 to 90% of the width, cropped to content; no dead bands | @avi_vashishta29, @theordrori, @anmoldoesmotion |
| 8 | **Camera** | Every feature pushed into, framed on the motion, then back out; never a detail too small to see | @motionbyjawad, @_code_and_chill_ |
| 9 | **Sound** | A bed by mood with cuts on its beats and quiet interface sounds; plus an interface-sounds-only export | all benchmarks (audio not yet analysed; see below) |
| 10 | **Why it converts** | A developer learns a technique; a founder sees why their page is better with it; no invented claims | our rules |
| 11 | **Growth** | One ask on screen for 2.5s, the handle and sting, the reel loops, 4:5-safe | @avi_vashishta29, @simo.dsgn |
| 12 | **Close** | craftUI, a tagline specific to what the video proved, the ask, held long enough to act on | @simo.dsgn |

## How to score

1. Extract a contact sheet: `ffmpeg -i <video> -vf "fps=4,scale=270:-1,tile=8x6" sheet.png`, plus every frame of the first 3 seconds at full size.
2. Watch it at phone size twice without stopping: once muted (write what each scene said; that is criterion 2) and once with sound (criterion 9).
3. Score each criterion with a one-line reason. A score without a reason doesn't count.
4. Fix the lowest criterion first; on a tie, look and framing before camera, camera before motion, motion before sound and polish. Film again and score again.
5. Log the round below.

## Breaking down a benchmark

For each benchmark video, write:

| Field | Notes |
|---|---|
| Link | |
| Length and scenes | Total seconds, scene count, average scene length |
| Hook | First frame, the words, when motion starts |
| Captions | Position, size, words per caption, how they arrive |
| Ground and frame | What's behind the product, how it's framed, how much of the frame it fills |
| Camera | Push-ins, pans, what it frames and when |
| Marks | What points at the motion, and how |
| Transitions | Which, and when |
| Pace | Cuts per 10 seconds |
| Sound | Track mood and tempo, interface sounds, whether cuts land on beats |
| Ask | What it asks the viewer to do, and when |
| Close | What, and for how long |
| Take | What we adopt (as a proposal in `CHANGELOG.md`) |
| Leave | What doesn't fit craftUI or the rules |

## Benchmarks

Video files go in `reels/benchmarks/` (ignored by git; Studio's Local video files card empties it). Breakdowns stay here. Likes are as read on 2026-11-05.

| # | Reel | Likes | Length, size | What it sets the bar for |
|---|---|---|---|---|
| 1 | [Site of Sites, Odyssée](https://www.instagram.com/p/DfUBcVziJaN/) | — | 26.9s, 4:5 | Restraint, real-time motion, a series frame |
| 2 | [@anmoldoesmotion](https://www.instagram.com/p/Dcn6EINyzaa/) (OpenAI piece) | 12,074 | 31s, 16:9 | Every scene its own world (forest, sky, field, paper); kinetic words built in one at a time |
| 3 | [@avi_vashishta29](https://www.instagram.com/p/Deq3PylStBF/) | 7,250 | 14.4s, 9:16 | The comparison hook ("Which is better? First or second?"), "Comment to get the code", the product on a warm photographic sky |
| 4 | [@simo.dsgn](https://www.instagram.com/p/DWyqa92jDXc/) | 5,699 | 15s, 4:5 | A persistent ask ("Comment FILE"), a glow ground behind the UI, a series signature (an Intro / Reveal / Feature / Outro bar), a push-in to the phone |
| 5 | [@theordrori](https://www.instagram.com/p/DRPV4KtDH2g/) | 3,546 | 19.4s, 16:9 | A soft drifting aurora ground; one element scaling up at a time |
| 6 | [@_pixel_motion_](https://www.instagram.com/p/DfBwSfuNma-/) | 3,180 | 11.2s, 9:16 | A whole product tour in 11s: fast, varied, light mint ground |
| 7 | [@_code_and_chill_](https://www.instagram.com/p/DeZWrkYoqOi/) | 1,866 | 30s, 9:16 | A deep navy ink ground, a constant handle watermark, the camera zooming into each panel |
| 8 | [@motionbyjawad](https://www.instagram.com/p/DbdDXNzseLV/) | 1,840 | 10.8s, 16:9 | A scenic ground, the camera pushed right into one button, a signed close |

### What the most-liked reels share

- **The ground is never flat:** a photo, a gradient or a tinted brand colour gives the product depth (2, 3, 4, 5, 7, 8).
- **The product fills the frame,** cropped to what matters; nobody shows a whole page small.
- **The camera goes where the action is:** push-ins on the one thing that changes (4, 7, 8).
- **Fast:** 11 to 20s, a change every 1 to 3s (3, 4, 6, 8).
- **They ask:** a comment keyword for the code or file (3, 4), a question to answer (3).
- **A signature:** the same frame, bar, watermark or close every time (1, 4, 7).
- **Music on every one.** Audio wasn't analysed in this pass (frames only); the next benchmark round should read the track's tempo and where the cuts fall against it.

What none of them have, and we do: the proof. No benchmark shows where the motion is or what its values are. That's our edge with developers; the look, camera, sound and ask are where we close the gap.

### 1. Site of Sites: Odyssée (2026-11-04)

| Field | Notes |
|---|---|
| Link | instagram.com/p/DfUBcVziJaN (a carousel; the video is item 2) |
| Length and scenes | 26.9s, 4:5 (1080×1350), 25fps, no audio. One continuous screen recording with 2 cuts (17.0s, 22.3s): 3 scenes of 17, 5 and 4.6s |
| Hook | Frame 1 is the site's finished hero: a close-up face, the serif statement and the cursor. No words of its own; the beauty of the frame is the hook |
| Captions | None. A fixed series frame instead: "Unlimited / Design / Inspiration" across the top, the Site of Sites mark and address across the bottom, on one flat brand blue |
| Marks | None. The cursor is the only pointer: it rests, hovers images, opens the menu |
| Transitions | Real scrolling as continuity; the 2 hard cuts land on section changes. Nothing decorative |
| Pace | Unhurried: scrolls ease in and out, each section holds about 1 to 2s, nothing still for over 3s |
| Close | No end card; the brand frame is on screen for the whole video |
| Frame | The site fills 89% of the width in a 16:9 rectangle, no browser chrome, centered with a large blue band above and below (the media is only 39% of the height) |
| Take | (1) A fixed series frame that makes every video recognizable as ours from one frame. (2) Real-time, unhurried motion; let the component breathe. (3) Frame 1 is the most beautiful still. (4) Continuity over cuts |
| Leave | No explanation of why it's good (our master rule needs captions and marks). 4:5 with small media (we're 9:16 and the component should fill more). No action at the end |

Scored on the first, 10-criterion rubric (before Look, Camera, Sound and Growth were added). This benchmark sets the 10 for motion fidelity, pace, frame identity and transitions. For hook, proof, captions and why it converts, the 10 stays as the rubric describes, until a benchmark shows it.

| Hook | Point | Proof | Motion | Pace | Captions | Frame | Transitions | Converts | Close | Overall |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 3 | 2 | 10 | 10 | 2 | 9 | 10 | 3 | 5 | 6.0 |

Reasons: a beautiful first frame but no promise (6); you see a site, not a point (3); nothing shows where to look (2); real and smooth throughout (10); unhurried, no dead air (10); no captions at all (2); a recognizable series frame, but small media in the frame (9); continuity and two motivated cuts (10); it never says why (3); brand present, no action (5).

## Our scores

| Date | Video | Spec | Scores 1 to 10 | Overall | Largest fault | Fix |
|---|---|---|---|---|---|---|
| | | | | | | |
