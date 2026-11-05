---
name: video-director
description: Directs craftUI's short vertical product videos (Reels, Shorts, TikTok) for one registry component at a time, from a reading of its source and a live probe of its interactions to a storyboard (VideoSpec) that plays as one HTML page our recorder films, held to the bar of the most-liked UI reels (look, camera, pace, sound, hook and ask). Each video type has its own style and rules; showcase is the first. Use when planning, writing, scoring or improving a craftUI video, editing the director's rules, the Studio tab in the admin panel, reels/spec.ts, reels/specs/*.json or lib/studio/director.ts, or comparing our video against a benchmark.
metadata:
  version: 1.1.0
---

# Video director

The director turns one craftUI component into one short vertical video that makes developers and startup founders want the library: "this is built better than what I'd build, and I can have it today."

It is held to the bar of the most-liked UI reels on Instagram (`references/benchmark.md`; the strongest has 12k likes): a first second that stops the scroll, a product with depth that fills the frame, a camera that goes where the action is, a change every 1 to 3 seconds, music, and one clear ask. Likes can't be guaranteed; every video meeting that bar, plus the proof no benchmark has, is what this skill is for.

It decides; it does not draw. Every frame of the component comes from the real component, filmed in a browser. Every focus mark and annotation is built with the stageshow kit (Benji Taylor's skill, `.agents/skills/stageshow`, vendored to `reels/kit`), and the whole video (captions, scenes, marks, transitions, end card) is one HTML page on one stageshow Stage, filmed frame by frame. No other video or UI skill is used to build a scene.

## Video types

Each type is its own style with its own rules, file and benchmark. Read the type file in full before planning.

| Type | Goal | Rules | Status |
|---|---|---|---|
| Showcase | Show the engineering beauty in the component, one feature per scene (features listed by Interface Craft from a live probe), and why it converts | `types/showcase.md` | v1.1: look, camera and growth built in the page; sound and comparison scenes planned |
| Tutorial | Install, use, ship, in numbered steps | not written | Old rules in `lib/studio/director.ts` |
| UGC | Screen-record style, phone frames, POV hooks | not written | Old rules in `lib/studio/director.ts` |

Never borrow a rule from another type's file. If a type needs one, propose it (see Updating this skill).

## The pipeline

1. **Brief.** The admin picks a component, the type, the hook style, audience and length in Studio (`/admin-panel-craft/studio`). Theme is not a brief choice: light and dark is a feature the video shows, so the director picks the theme the video opens in (the one the component looks best in) and shows the other where the type calls for it. Optionally the admin adds reference video links and instructions (see Reference videos and instructions below).
2. **Read the metadata, then the source.** Metadata first, always (see Component metadata below), then the source, props and docs. Facts come only from these.
3. **Probe and audit** (type-specific). For a showcase, the live probe tries the component's interactions for real, then Interface Craft lists its design-engineering features and what never to claim; the director gives each chosen feature one scene (`types/showcase.md`, The process; `references/feature-audit.md`).
4. **Plan.** The director chooses the look (`references/look.md`), writes the scenes with their push-ins and pace (`references/camera.md`), the hook and the ask (`references/growth.md`), and picks the sound's mood (`references/sound.md`). `reels/spec.ts` is the contract, `reels/specs/<item>-<type>.json` the file.
5. **Play.** The storyboard plays as one page, `/reels/video?spec=<name>` (`reels/video/reel.tsx`): one stageshow Stage at 540 × 960 CSS px, the caption band on top (`PAGE` in `reels/spec.ts`), the real component in an iframe of `/preview/<item>` in its frame on its ground below it, the camera pushing into each feature, the focus mark tracking the moving element every frame with its value under the frame, then the end card. Open the page in a browser to watch exactly what the MP4 will be.
6. **Film.** `pnpm video <spec>` (or Studio's **Render video**) films that page at 2x on a virtual clock (`scripts/lib/film.mjs`), one frame per step, straight to `reels/out/<spec>.mp4` at 1080 × 1920. The stage cursor drives the real mouse, so the component's own hover, press and click handlers run.
7. **Mix.** The sound bed and interface sounds are mixed in with ffmpeg at the logged beat frames, and a second export keeps interface sounds only (`references/sound.md`). The feed (4:5) cut and the cover come from the same render (`references/growth.md`).
8. **Score.** Against the benchmark rubric (`references/benchmark.md`), muted and with sound. Below 9 on any criterion, fix the lowest and film again.

## Component metadata

Before any plan, read the component's metadata. It says who the component is for and what it is meant to do, and the video has to speak to that, not to a guess from the code.

| Source | Fields | Use it for |
|---|---|---|
| `registry.json`, the item | `title`, `description`, `categories`, `meta.id`, `meta.library`, `meta.types`, `meta.styles`, `meta.useCases`, `meta.free`, `meta.publishedAt` | What it is, its style claims (`motion`, `dark-mode`, `minimal`), who it's for, free or paid |
| `content/agent-reference.json`, the item | `useCases`, `tags`, `props`, `import`, `paid`, `dependencies`, `registryDependencies`, `docs` | Real props and defaults, the import path, what it depends on |
| `content/docs/…` MDX for the item | Front matter and copy | How we already describe it in public; the video must not contradict it |

How the metadata steers the video:

- **Use cases pick the audience framing.** "Executive and enterprise software websites" means the founder caption speaks to credibility with enterprise buyers; "Indie launch page" means speed to launch. Name the use case in the hook or the end card when it sharpens it.
- **Styles are claims to prove.** A `motion` style needs at least one motion point; `dark-mode` makes the theme half of the adapt scene mandatory. A style the source can't back goes on the do-not-claim list and is reported to the admin.
- **Types and categories set the vocabulary:** a testimonials section is "social proof", a pricing table is "the page that closes".
- **Free or paid** decides the end card's wording. Never call a paid item free.
- **Description is the floor:** every feature it names is true; nothing it doesn't name is assumed.

If a field is missing or contradicts the source, say so in the plan's notes rather than filling the gap.

## Reference videos and instructions

Both are optional fields in the Studio brief. When they're empty, the director plans from the rules alone.

**Instructions** are the admin's own direction for this video (what to show, the mood, what to take from a reference). They lead every creative choice but never override the rules: they can't make the video claim what the source doesn't do, break the caption limits or change the type's structure. An instruction that can't be followed is named in the plan's notes.

**Reference videos** (up to 3 links: Instagram, YouTube, TikTok or a direct video file) are videos the admin wants this one to feel like. The director's job with each one:

1. **Read it frame by frame, without saving it.** `yt-dlp --get-url` turns a page link into its media stream (it downloads nothing); ffmpeg reads that stream once and, in the same pass, finds the scene cuts (`select='gt(scene,0.1)'`) and samples about one frame a second as small JPEGs held in memory. Nothing is written to disk. (`lib/studio/reference.ts`; dev machine only, since it needs ffmpeg and yt-dlp.)
2. **Understand its structure, not its content:** what's on screen in the first second and when the first motion or words arrive; how many scenes, how long each holds and where the cuts fall; where the text sits, how big, how many words at a time and in what voice; how the product is framed and how much of the frame it fills; what moves, how fast, and what the cursor or camera does; how it ends and for how long.
3. **Carry that structure into our video:** the hook's wording and timing, the pacing (holds), caption length and voice, whether to include the resize, the order of the moments, the tagline. Never copy a reference's content, words, brand or product. Our video is about craftUI and this component, built to these rules with stageshow.
4. **Report it.** The plan's reference notes list each trait found with its timestamps (for example "cuts at 17.0s and 22.3s: three long scenes"), how it shaped the plan, and what couldn't carry over because the video type fixes it.

A reference is for one video. A benchmark (`references/benchmark.md`) is the standing bar every video is scored against. A reference that keeps teaching the same lesson becomes a benchmark, or a proposal in `CHANGELOG.md`.

## Rules for every type

- **Only what is true.** Every claim names the code that proves it (file and line, or the value). Never invent features, data, metrics or conversion numbers. "Converts better" is argued from the mechanism (it feels responsive, it looks finished, it keeps reading), never from a made-up percentage.
- **Only what is visible.** If a viewer can't see it in the frame at phone size, it is not a scene.
- **The real component.** Film `/preview/<item>` in its iframe at real breakpoints. Never rebuild the component as a faux UI; stageshow builds only the frame around it and the marks on top of it.
- **Captions carry the story; sound adds to it.** No voiceover. Most people watch muted, so every point reads from the captions alone; the music and interface sounds make it feel finished for those who don't. Lines of at most 28 characters, at most 3 lines (a showcase: at most 6 words over 2), an eyebrow of at most 40. Sentence case, no emoji, no hashtags, no exclamation marks, no hype words.
- **Never flat, never small.** The component sits on a ground with depth and fills the frame (`references/look.md`).
- **The camera goes where the action is** (`references/camera.md`).
- **One ask per video,** the same words every time (`references/growth.md`).
- **Two audiences in one line.** The eyebrow speaks developer (the technique: "Spring, bounce 0"); the caption speaks founder (what it does for them: "Feels instant, not floaty"). Both must be true for the same scene.
- **Safe zones.** Platform UI covers the top ~11% and the bottom ~17% of a 9:16 reel: the handle sits at y 300 (output px), the caption band between 336 and 600, the component's box between 624 and 1524 with its value row under it, nothing important below 1600 (`PAGE` in `reels/spec.ts`). Everything that matters also sits inside the central 4:5 area, so one render crops for the feed.
- **Brand.** craftUI, the handle, the sting, the install command `npx shadcn@latest add <host>/r/<item>.json`, the site address. No other company's logo, product or place in frame, grounds included.

## Updating this skill

This skill grows as we make videos, but only with the user's approval.

- When a video shows a new use case, a rule that failed, or a benchmark teaches something, write it as a proposal under **Proposed** in `CHANGELOG.md`: what we saw, the rule, which file it changes.
- Ask the user. Only after a yes, move it to **Approved**, edit the rule file and bump `metadata.version`.
- Never change a rule silently, and never change one because a single video looked better without it.

## Files

| File | Holds |
|---|---|
| `types/showcase.md` | Showcase: the process, scene grammar, layout, hook, captions, look, camera, close, sound, done means |
| `references/feature-audit.md` | How Interface Craft lists the features (Design Critique in reverse, Storyboard Animation), the card each gets, and a worked example |
| `references/focus-overlays.md` | The SVG focus marks, each built from a stageshow part, and when to use them |
| `references/look.md` | The ground (Aurora, Glow, Ink, Paper, Dusk, Auto from the component's palette), the frame (Browser, Card, Phone, Bleed) and the scale |
| `references/camera.md` | The push-in on each feature, and the pace by length |
| `references/sound.md` | The music bed, interface sounds, beats, and the two exports |
| `references/growth.md` | The first second, the ask, the series signature, comparison scenes, formats and length |
| `references/benchmark.md` | The rubric, how to score, the benchmark videos and our scores |
| `CHANGELOG.md` | Approved changes and proposals waiting for approval |
