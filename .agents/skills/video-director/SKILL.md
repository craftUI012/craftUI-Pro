---
name: video-director
description: Directs craftUI's short vertical product videos (Reels, Shorts, TikTok) for one registry component at a time, from a reading of its source to a storyboard (VideoSpec) that our recorder films and Remotion composes. Each video type has its own style and rules; showcase is the first. Use when planning, writing, scoring or improving a craftUI video, editing the director's rules, the Studio tab in the admin panel, reels/spec.ts, reels/specs/*.json or lib/studio/director.ts, or comparing our video against a benchmark.
metadata:
  version: 0.1.1
---

# Video director

The director turns one craftUI component into one short vertical video that makes developers and startup founders want the library: "this is built better than what I'd build, and I can have it today."

It decides; it does not draw. Every frame of the component comes from the real component, filmed in a browser. Every focus mark and annotation is built with the stageshow kit (Benji Taylor's skill, `.agents/skills/stageshow`, vendored to `reels/kit`), and Remotion composes the scenes, captions, transitions and end card. No other video or UI skill is used to build a scene.

## Video types

Each type is its own style with its own rules, file and benchmark. Read the type file in full before planning.

| Type | Goal | Rules | Status |
|---|---|---|---|
| Showcase | Show the engineering beauty in the component's motion and polish, one point per scene, and why it converts | `types/showcase.md` | Writing (v0.1) |
| Tutorial | Install, use, ship, in numbered steps | not written | Old rules in `lib/studio/director.ts` |
| UGC | Screen-record style, phone frames, POV hooks | not written | Old rules in `lib/studio/director.ts` |

Never borrow a rule from another type's file. If a type needs one, propose it (see Updating this skill).

## The pipeline

1. **Brief.** The admin picks a component, the type, the hook style, audience and length in Studio (`/admin-panel-craft/studio`). Theme is not a brief choice: light and dark is a feature the video shows, so the director picks the theme the video opens in (the one the component looks best in) and shows the other where the type calls for it.
2. **Read the metadata, then the source.** Metadata first, always (see Component metadata below), then the source, props and docs. Facts come only from these.
3. **Audit** (type-specific). For a showcase this is the feature audit: `references/feature-audit.md`.
4. **Plan.** The director writes scenes as a storyboard: `reels/spec.ts` is the contract, `reels/specs/<item>-<type>.json` the file.
5. **Film.** `pnpm video <spec>` films each live scene frame by frame on a virtual clock (`scripts/lib/film.mjs`), with stageshow overlays drawn in the shot page (`reels/shoot/`).
6. **Compose.** Remotion (`reels/remotion/`) lays out captions, transitions, terminal, code and the end card at 1080×1920.
7. **Score.** Contact sheet against the benchmark rubric (`references/benchmark.md`). Below 9/10, fix the largest fault and film again.

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

## Rules for every type

- **Only what is true.** Every claim names the code that proves it (file and line, or the value). Never invent features, data, metrics or conversion numbers. "Converts better" is argued from the mechanism (it feels responsive, it looks finished, it keeps reading), never from a made-up percentage.
- **Only what is visible.** If a viewer can't see it in the frame at phone size, it is not a scene.
- **The real component.** Film `/preview/<item>` in its iframe at real breakpoints. Never rebuild the component as a faux UI; stageshow builds only the frame around it and the marks on top of it.
- **Captions are read, not heard.** No voiceover; assume sound off. Lines of at most 28 characters, at most 3 lines, an eyebrow of at most 40. Sentence case, no emoji, no hashtags, no exclamation marks, no hype words.
- **Two audiences in one line.** The eyebrow speaks developer (the technique: "Spring, bounce 0"); the caption speaks founder (what it does for them: "Feels instant, not floaty"). Both must be true for the same scene.
- **Safe zones.** Captions start at y 240, media at 600, nothing important below 1600 (platform UI covers it). These are `LAYOUT` in `reels/spec.ts`.
- **Brand.** craftUI, the install command `npx shadcn@latest add <host>/r/<item>.json`, the site address. No other company's logo or product in frame.

## Updating this skill

This skill grows as we make videos, but only with the user's approval.

- When a video shows a new use case, a rule that failed, or a benchmark teaches something, write it as a proposal under **Proposed** in `CHANGELOG.md`: what we saw, the rule, which file it changes.
- Ask the user. Only after a yes, move it to **Approved**, edit the rule file and bump `metadata.version`.
- Never change a rule silently, and never change one because a single video looked better without it.

## Files

| File | Holds |
|---|---|
| `types/showcase.md` | Showcase: goal, scene grammar, structure by length, captions, transitions, theme and device |
| `references/feature-audit.md` | How to find the points worth a scene, with the three lenses and a worked example |
| `references/focus-overlays.md` | The SVG focus marks, each built from a stageshow part, and when to use them |
| `references/benchmark.md` | The rubric, how to score, the benchmark videos and our scores |
| `CHANGELOG.md` | Approved changes and proposals waiting for approval |
