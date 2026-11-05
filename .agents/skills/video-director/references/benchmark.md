# Benchmark and score

We hold every video against benchmark videos the user picks. A video ships when it scores 9 or higher overall and no criterion is under 8.

## Scoring

The best benchmark on a criterion sets 10 for that criterion. Score our video against it, 0 to 10, in whole or half points. Overall is the mean of the ten.

| # | Criterion | 10 looks like |
|---|---|---|
| 1 | **Hook** | Frame 1 is a finished, beautiful frame with the hook on it; motion by 0.3s; you want to know the answer |
| 2 | **One point per scene** | With sound off, each scene's point can be named after one viewing |
| 3 | **Proof** | The mark lands exactly on what moved, with its real value, in every sampled frame |
| 4 | **Motion fidelity** | The real component, smooth at 60fps, true timing, slow motion labeled and exact |
| 5 | **Pace** | Scenes 3 to 5s, no dead air over a second, nothing still over three seconds outside a hold, cuts on beats |
| 6 | **Captions** | Readable in a second at phone size, inside the safe zones, eyebrow and caption clearly ranked |
| 7 | **Frame** | Stageshow framing: fills the clip, real chrome, no plate, no empty band, one theme per scene |
| 8 | **Transitions** | Continuity on the same frame, a crossfade only when the frame changes, nothing decorative |
| 9 | **Why it converts** | A developer learns a technique; a founder sees why their page is better with it; no invented claims |
| 10 | **Close** | Brand, one action and the address, held long enough to act on |

## How to score

1. Extract a contact sheet: `ffmpeg -i <video> -vf "fps=4,scale=270:-1,tile=8x6" sheet.png`, plus every frame of the first 3 seconds at full size.
2. Watch it at phone size, sound off, once through without stopping. Write what each scene said. That is criterion 2.
3. Score each criterion with a one-line reason. A score without a reason doesn't count.
4. Fix the lowest criterion first. Framing faults before motion, motion before polish (stageshow's order). Film again and score again.
5. Log the round below.

## Breaking down a benchmark

For each benchmark video, write:

| Field | Notes |
|---|---|
| Link | |
| Length and scenes | Total seconds, scene count, average scene length |
| Hook | First frame, the words, when motion starts |
| Captions | Position, size, words per caption, how they arrive |
| Marks | What points at the motion, and how |
| Transitions | Which, and when |
| Pace | Cuts per 10 seconds |
| Close | What, and for how long |
| Take | What we adopt (as a proposal in `CHANGELOG.md`) |
| Leave | What doesn't fit craftUI or the rules |

## Benchmarks

Video files go in `reels/benchmarks/` (ignored by git; Studio's Local video files card empties it). Breakdowns stay here.

| # | Link | What it sets the bar for |
|---|---|---|
| 1 | [Site of Sites, Odyssée](https://www.instagram.com/p/DfUBcVziJaN/) | Restraint, real-time pace, a series frame, the product's own motion as the content |

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

Scored on the rubric. This benchmark sets the 10 for motion fidelity, pace, frame identity and transitions. For hook, proof, captions and why it converts, the 10 stays as the rubric describes, until a benchmark shows it.

| Hook | Point | Proof | Motion | Pace | Captions | Frame | Transitions | Converts | Close | Overall |
|---|---|---|---|---|---|---|---|---|---|---|
| 6 | 3 | 2 | 10 | 10 | 2 | 9 | 10 | 3 | 5 | 6.0 |

Reasons: a beautiful first frame but no promise (6); you see a site, not a point (3); nothing shows where to look (2); real and smooth throughout (10); unhurried, no dead air (10); no captions at all (2); a recognizable series frame, but small media in the frame (9); continuity and two motivated cuts (10); it never says why (3); brand present, no action (5).

## Our scores

| Date | Video | Spec | Scores 1 to 10 | Overall | Largest fault | Fix |
|---|---|---|---|---|---|---|
| | | | | | | |
