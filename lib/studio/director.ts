/* oxlint-disable no-magic-numbers, max-lines, max-statements, complexity */

import Anthropic, {
  APIConnectionError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import { FALLBACK_SITE_ORIGIN } from "@/constants/site";
import { readComponentContext } from "@/lib/studio/context";
import type { ComponentContext, Interactions } from "@/lib/studio/context";
import {
  auditFeatures,
  MAX_FEATURE_CAPTION_WORDS,
} from "@/lib/studio/features";
import type { Audit, Feature } from "@/lib/studio/features";
import type {
  AudienceId,
  GroundId,
  HookStyleId,
  LengthId,
  ThemeId,
  VideoTypeId,
} from "@/lib/studio/options";
import { HOOK_STYLES, SOCIAL_HANDLE, VIDEO_ASK } from "@/lib/studio/options";
import { runProbe } from "@/lib/studio/probe";
import type { ProbeResult } from "@/lib/studio/probe";
import { analyzeReference, summarize } from "@/lib/studio/reference";
import type {
  ReferenceAnalysis,
  ReferenceSummary,
} from "@/lib/studio/reference";
import { parseSpec } from "@/reels/spec";
import type { Beat, Caption, LiveShot, Shot, VideoSpec } from "@/reels/spec";

// The director: plans a video for one component as a storyboard
// (reels/spec.ts VideoSpec). Rules own the structure of each video type,
// the install command, timing and every check; Claude writes what needs
// taste: the hook, captions, which interactions to show and the usage code.
// Every target Claude picks is checked against the component's own source
// before the storyboard is accepted.

const MODEL = "claude-opus-5-5";

export interface DirectInput {
  item: string;
  type: VideoTypeId;
  hook: HookStyleId;
  audience: AudienceId;
  length: LengthId;
  /** The ground; "auto" lets the director choose. */
  ground?: GroundId;
  /** Optional links to videos whose structure the plan should follow. */
  references?: string[];
  /** Optional notes from the admin, in their words. */
  instructions?: string;
}

export interface DirectResult {
  spec: VideoSpec;
  /** The director's reasoning for these choices, for the admin. */
  notes: string;
  /** Rule fixes the director's draft needed (dropped targets and so on). */
  warnings: string[];
  estimateSeconds: number;
  interactions: Interactions;
  model: string;
  /** The reference videos as read, without their frames. */
  references: ReferenceSummary[];
  /** What the director took from the references and how it used it. */
  referenceNotes: string;
  /** Showcase only: the Interface Craft feature audit the scenes come from. */
  audit: Audit | null;
  /** Showcase only: the live interaction probe the features were chosen from. */
  probe: ProbeResult | null;
  /** Showcase only: for each feature (0-based), the shot (1-based) showing it. */
  featureShots: Record<number, number>;
}

// What Claude returns. Flat and simple on purpose: the rules below turn it
// into shots. Lengths are checked after, with one repair round.
const CaptionDraft = z.object({
  eyebrow: z.string(),
  lines: z.array(z.string()),
});

const DraftSchema = z.object({
  hook: CaptionDraft,
  install_caption: CaptionDraft,
  interactions: z.array(
    z.object({
      action: z.enum(["click", "hover", "key"]),
      caption: CaptionDraft.nullable(),
      hold_ms: z.number().int(),
      /** click / hover: one aria-label exactly; key: a key name. */
      target: z.string(),
    })
  ),
  look: z.object({
    frame: z.enum(["card", "browser", "bleed"]),
    ground: z.enum(["auto", "aurora", "glow", "ink", "paper", "flat"]),
  }),
  notes: z.string(),
  opening_theme: z.enum(["light", "dark"]),
  reference_notes: z.string(),
  resize: z.object({ caption: CaptionDraft, include: z.boolean() }),
  scenes: z.array(
    z.object({
      caption: CaptionDraft,
      /** 1-based number of a feature in the feature list. */
      feature: z.number().int(),
      hold_ms: z.number().int(),
    })
  ),
  ship_caption: CaptionDraft,
  tagline: z.string(),
  theme_caption: CaptionDraft,
  usage: z.object({
    caption: CaptionDraft,
    code: z.string(),
    file: z.string(),
    highlight: z.array(z.array(z.number().int())),
  }),
  variations: z.array(
    z.object({
      caption: CaptionDraft,
      frame: z.enum(["browser", "phone"]),
      theme: z.enum(["light", "dark"]),
    })
  ),
});

type Draft = z.infer<typeof DraftSchema>;

const LIMITS = {
  codeLine: 58,
  codeLines: 20,
  eyebrow: 40,
  line: 28,
  lines: 3,
  tagline: 90,
} as const;

/** Interactions each length can hold, across the whole video. */
const BUDGET: Record<LengthId, number> = { 15: 3, 30: 5, 45: 7 };

/** The site's public address, never localhost: it is printed in the video. */
const publicHost = () => {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  const origin =
    env && !/localhost|127\.0\.0\.1/.test(env) ? env : FALLBACK_SITE_ORIGIN;
  return new URL(origin).host;
};

const SYSTEM = `You are the creative director for craftUI, a library of production-ready shadcn/ui sections, blocks and illustrations built with Tailwind CSS and Motion. You plan short vertical videos (Instagram Reels, YouTube Shorts, TikTok) that show one real component and make developers and startup founders want to use the library.

You return a draft as JSON. Code turns it into the final storyboard, films the real component in a browser and checks everything you choose, so:

- Only show what the component really does. Read its source: describe its actual behavior, never invent features, data or metrics.
- Interactions: for "click" and "hover", the target must be one of the listed aria-labels, copied exactly. For "key", the target must be one of the listed keys. If the component has none, return an empty list.
- hold_ms is how long to stay on the result after the action (1200 to 2600; longer for text-heavy results, so a viewer can read).
- Captions are on-screen text over the video. Each line is at most ${LIMITS.line} characters, 1 to ${LIMITS.lines} lines, broken where the meaning breaks. The eyebrow is a short label of at most ${LIMITS.eyebrow} characters (a step, a feature name, or the format). Sentence case. No emoji, no hashtags, no exclamation marks, no "revolutionary"-style hype.
- The hook is the first thing on screen and decides whether people keep watching. Make it specific to this component and this audience.
- Founders care about launching faster, looking credible, and converting visitors. Developers care about it being their own code (copied in, not a dependency), shadcn/ui and Tailwind conventions, props, responsiveness and accessibility.
- usage.code is a short, real example of using the component in a Next.js page: import it from the given import path, pass realistic props from the props list, and nothing else. At most ${LIMITS.codeLines} lines, each at most ${LIMITS.codeLine} characters (wrap JSX props onto their own lines). usage.highlight lists 1 to 3 groups of 1-based line numbers to light up in order (the import, the data, the JSX).
- variations are used by UGC videos: 1 to 3 shots of the same component in different devices and themes ("phone" or "browser", "light" or "dark"), each with a caption in a screen-recording, creator voice.
- look is the video's look (craftUI's look rules): frame "card" (the component alone, rounded, on its ground; most sections, blocks and cards), "browser" (a browser window; full pages, heroes, navigation, anything where "it's a website" matters) or "bleed" (edge to edge; big visual components such as galleries, globes, image-led heroes). ground "auto" builds the ground from the component's own colours and is the right choice almost always; name another (aurora, glow, ink, paper, flat) only when the component's mood clearly asks for it.
- opening_theme is the theme the video opens in: the one the component looks best in, judged from its source and styles. Light and dark are not a brief choice; showing both is a feature, so the other theme gets its own shot where the type uses it (theme_caption, about the component switching themes for real, from its tokens).
- scenes are used by showcase videos only (see the structure); return an empty list for other types.
- reference_notes: when reference videos are attached, see Reference videos below; otherwise an empty string.
- tagline is the end card's one sentence under the craftUI name, at most ${LIMITS.tagline} characters.
- notes: two or three sentences for the admin on why you chose this hook and these moments.

Admin instructions, when given, are the admin's own direction for this video. Follow them in every creative choice, but never past the rules above: they can't make you claim something the source doesn't do, break the caption limits or change the video type's structure. If one can't be followed, say so in notes.

Reference videos, when attached, are videos the admin wants this one to feel like. For each you get its length, size, frame rate, the seconds where it cuts to a new shot and frames sampled about once a second, each labelled with its time. Study its structure, not its content:
- the hook: what is on screen in the first second, and when the first motion or words arrive;
- the scenes: how many, how long each holds, where the cuts fall;
- the words: where the text sits, how big, how many words at a time, its voice;
- the frame: how the product is framed and how much of the frame it fills;
- the motion: what moves, how fast, what the cursor or camera does;
- the close: how it ends and for how long.
Carry that structure into this plan wherever the draft lets you: the hook's wording and timing, hold_ms for the pacing, caption length and voice, whether to include the resize, the order of the moments and the tagline. Never copy a reference's content, words, brand or product: the video is about craftUI and this component. In reference_notes, list the traits you found with their timestamps (for example "cuts at 17.0s and 22.3s: three long scenes"), how each one shaped this plan, and what you couldn't carry over because the video type fixes it.`;

const hookGuide = (id: HookStyleId) => {
  const style = HOOK_STYLES.find((s) => s.id === id);
  return style ? `${style.label}: ${style.description}` : id;
};

const STRUCTURE: Record<VideoTypeId, string> = {
  showcase: `Showcase: one feature, one scene. The video opens on the hook: a short shot of the component in opening_theme, the hook as its caption. Then one scene per feature you pick from the feature list (the Interface Craft audit below): the component's motion in the centre of the screen and a short caption on top. In scenes, give each one the feature's number, its hold_ms (how long the result holds to be read, 1500 to 3500) and its caption: the eyebrow is the feature's name (the technique, developer words) and the lines are the feature's caption, sharpened if you can, at most ${MAX_FEATURE_CAPTION_WORDS} words over 1 or 2 lines, no numbers. Pick the strongest features first, each once, and avoid two from the same lens in a row. At 45 seconds the install command (install_caption) follows the scenes; then the end card. interactions, resize, theme_caption, usage, ship_caption and variations are not used; fill them briefly anyway.`,
  tutorial:
    "Tutorial: a short browser shot with the first interaction (the hook), the install command (install_caption, as step 1), the usage code (usage.caption, as step 2), a second browser shot with the remaining interactions and the optional resize (ship_caption, as step 3), then the end card. Number the steps in the eyebrows. variations are not shown; fill them briefly anyway.",
  ugc: "UGC: screen-recording style. One shot per variation (the first shows the hook instead of its own caption), the interactions spread across them, then the end card. Prefer phone frames and show both themes (the first variation in opening_theme). install_caption, usage, ship_caption and resize are not shown; fill them briefly anyway.",
};

/** The audit as the director reads it: numbered features, then what not to claim. */
const featureList = (
  audit: Audit
) => `<feature_list source="Interface Craft feature audit">
${audit.features
  .map(
    (
      f,
      i
    ) => `${i + 1}. ${f.name} (${f.lens}; visibility ${f.visibility}/5, rarity ${f.rarity}/5)
   seen: ${f.observation}
   storyboard: ${f.storyboard}
   evidence: ${f.evidence}
   impact: ${f.impact}
   trigger: ${f.trigger.action}${f.trigger.target ? ` "${f.trigger.target}"` : ""}
   caption: ${f.caption}`
  )
  .join("\n")}
</feature_list>

<do_not_claim>
${audit.do_not_claim.map((d) => `- ${d}`).join("\n") || "- nothing listed"}
</do_not_claim>`;

const userPrompt = (
  ctx: ComponentContext,
  input: DirectInput,
  references: ReferenceAnalysis[],
  audit: Audit | null
) => {
  const facts = {
    audience: input.audience,
    component: {
      description: ctx.description,
      export: ctx.componentName,
      import_path: ctx.importPath,
      name: ctx.name,
      paid: ctx.paid,
      props: ctx.props,
      styles: ctx.styles,
      title: ctx.title,
      types: ctx.types,
      use_cases: ctx.useCases,
    },
    hook_style: hookGuide(input.hook),
    interaction_budget: BUDGET[input.length],
    interactive_elements: {
      aria_labels: ctx.interactions.ariaLabels,
      keys: ctx.interactions.keys,
    },
    target_length_seconds: input.length,
    video_type: input.type,
  };
  return `Plan a ${input.type} video.

${STRUCTURE[input.type]}

${audit ? `Pick at most ${BUDGET[input.length]} features for scenes.` : `Use at most ${BUDGET[input.length]} interactions in total.`}
${audit ? `\n${featureList(audit)}\n` : ""}
<facts>
${JSON.stringify(facts, null, 2)}
</facts>

<source file="${ctx.files[0] ?? ctx.name}">
${ctx.source}
</source>${
    input.instructions?.trim()
      ? `

<admin_instructions>
${input.instructions.trim()}
</admin_instructions>`
      : ""
  }${
    references.length > 0
      ? `

${references.length} reference video${references.length === 1 ? " follows" : "s follow"}. Read their structure as described in your instructions.`
      : ""
  }`;
};

/** A reference video as message blocks: its facts, then each frame. */
const referenceBlocks = (
  r: ReferenceAnalysis,
  index: number
): Anthropic.Beta.BetaContentBlockParam[] => [
  {
    text: `<reference index="${index + 1}" url="${r.url}" seconds="${r.duration.toFixed(1)}" size="${r.width}x${r.height}" fps="${r.fps}" cuts="${r.cuts.map((c) => c.toFixed(1)).join(", ") || "none"}" frames="${r.frames.length}">`,
    type: "text",
  },
  ...r.frames.flatMap((f): Anthropic.Beta.BetaContentBlockParam[] => [
    { text: `t=${f.t.toFixed(1)}s`, type: "text" },
    {
      source: { data: f.jpeg, media_type: "image/jpeg", type: "base64" },
      type: "image",
    },
  ]),
  { text: "</reference>", type: "text" },
];

// Checks ----------------------------------------------------------------------

const captionProblems = (
  where: string,
  c: Caption | { eyebrow: string; lines: string[] }
) => {
  const problems: string[] = [];
  if (c.lines.length < 1 || c.lines.length > LIMITS.lines) {
    problems.push(`${where}: ${c.lines.length} lines (1 to ${LIMITS.lines})`);
  }
  for (const line of c.lines) {
    if (line.length > LIMITS.line || line.trim().length === 0) {
      problems.push(
        `${where}: line "${line}" is ${line.length} characters (max ${LIMITS.line})`
      );
    }
  }
  if ((c.eyebrow ?? "").length > LIMITS.eyebrow) {
    problems.push(
      `${where}: eyebrow "${c.eyebrow}" is over ${LIMITS.eyebrow} characters`
    );
  }
  return problems;
};

/** Problems Claude must fix (a repair round), as opposed to warnings the rules fix. */
const words = (lines: string[]) =>
  lines.join(" ").split(/\s+/).filter(Boolean).length;

/** Showcase scenes: real, distinct features and short, crisp captions. */
const sceneProblems = (draft: Draft, audit: Audit, budget: number) => {
  const problems: string[] = [];
  if (draft.scenes.length < 1 || draft.scenes.length > budget) {
    problems.push(`scenes has ${draft.scenes.length} entries (1 to ${budget})`);
  }
  const seen = new Set<number>();
  for (const [n, scene] of draft.scenes.entries()) {
    const where = `scenes[${n}]`;
    if (scene.feature < 1 || scene.feature > audit.features.length) {
      problems.push(
        `${where}.feature is ${scene.feature}; the list has 1 to ${audit.features.length}`
      );
    }
    if (seen.has(scene.feature)) {
      problems.push(`${where} repeats feature ${scene.feature}`);
    }
    seen.add(scene.feature);
    problems.push(...captionProblems(`${where}.caption`, scene.caption));
    if (scene.caption.lines.length > 2) {
      problems.push(
        `${where}.caption has ${scene.caption.lines.length} lines (1 or 2)`
      );
    }
    if (words(scene.caption.lines) > MAX_FEATURE_CAPTION_WORDS) {
      problems.push(
        `${where}.caption has ${words(scene.caption.lines)} words (at most ${MAX_FEATURE_CAPTION_WORDS})`
      );
    }
  }
  return problems;
};

const draftProblems = (
  draft: Draft,
  ctx: ComponentContext,
  type: VideoTypeId,
  audit: Audit | null,
  budget: number
) => {
  const problems = [
    ...captionProblems("hook", draft.hook),
    ...draft.interactions.flatMap((i, n) =>
      i.caption ? captionProblems(`interactions[${n}].caption`, i.caption) : []
    ),
  ];
  if (draft.tagline.length > LIMITS.tagline) {
    problems.push(
      `tagline is ${draft.tagline.length} characters (max ${LIMITS.tagline})`
    );
  }
  if (type !== "ugc") {
    problems.push(...captionProblems("install_caption", draft.install_caption));
  }
  if (type === "tutorial" && draft.resize.include) {
    problems.push(...captionProblems("resize.caption", draft.resize.caption));
  }
  if (type === "showcase" && audit) {
    problems.push(...sceneProblems(draft, audit, budget));
  }
  if (type === "tutorial") {
    problems.push(
      ...captionProblems("usage.caption", draft.usage.caption),
      ...captionProblems("ship_caption", draft.ship_caption)
    );
    const lines = draft.usage.code.split("\n");
    if (lines.length > LIMITS.codeLines) {
      problems.push(
        `usage.code has ${lines.length} lines (max ${LIMITS.codeLines})`
      );
    }
    for (const [n, line] of lines.entries()) {
      if (line.length > LIMITS.codeLine) {
        problems.push(
          `usage.code line ${n + 1} is ${line.length} characters (max ${LIMITS.codeLine})`
        );
      }
    }
    if (!draft.usage.code.includes(ctx.importPath)) {
      problems.push(`usage.code must import from "${ctx.importPath}"`);
    }
  }
  if (type === "ugc") {
    if (draft.variations.length < 1 || draft.variations.length > 3) {
      problems.push(
        `variations has ${draft.variations.length} entries (1 to 3)`
      );
    }
    problems.push(
      ...draft.variations
        .slice(1)
        .flatMap((v, n) =>
          captionProblems(`variations[${n + 1}].caption`, v.caption)
        )
    );
  }
  return problems;
};

const asCaption = (c: { eyebrow: string; lines: string[] }): Caption => ({
  ...(c.eyebrow.trim() ? { eyebrow: c.eyebrow.trim() } : {}),
  lines: c.lines.map((l) => l.trim()),
});

/** Draft interactions to beats, keeping only targets the source really has. */
const toBeats = (
  draft: Draft,
  ctx: ComponentContext,
  warnings: string[]
): Beat[] => {
  const beats: Beat[] = [];
  for (const i of draft.interactions) {
    const hold = Math.max(800, Math.min(4000, i.hold_ms));
    const caption = i.caption ? asCaption(i.caption) : undefined;
    if (i.action === "key") {
      if (!ctx.interactions.keys.includes(i.target)) {
        warnings.push(
          `Dropped key "${i.target}": the component doesn't handle it.`
        );
        continue;
      }
      beats.push({ caption, do: "key", hold, key: i.target });
      continue;
    }
    if (!ctx.interactions.ariaLabels.includes(i.target)) {
      warnings.push(
        `Dropped ${i.action} on "${i.target}": no element has that aria-label.`
      );
      continue;
    }
    beats.push(
      i.action === "click"
        ? { caption, do: "click", hold, target: `aria:${i.target}` }
        : { caption, do: "hover", ms: hold, target: `aria:${i.target}` }
    );
  }
  return beats;
};

const installOutput = (files: string[]) => [
  "✔ Checking registry.",
  "✔ Installing dependencies.",
  `✔ Created ${files.length} file${files.length === 1 ? "" : "s"}:`,
  ...files.slice(0, 3).map((f) => `  - ${f}`),
];

const live = (
  caption: Caption,
  beats: Beat[],
  frame: "browser" | "phone",
  theme: ThemeId
): LiveShot => ({
  beats: beats.length > 0 ? beats : [{ do: "wait", ms: 3000 }],
  caption,
  frame,
  kind: "live",
  theme,
  url: "yourstartup.com",
  viewport: 768,
});

/** What a scene does to make its feature happen, then the hold. */
const featureBeats = (feature: Feature, hold: number): Beat[] => {
  const lead: Beat = { do: "wait", ms: 400 };
  // The audit resolved the target to a storyboard target already.
  const { target } = feature.trigger;
  switch (feature.trigger.action) {
    case "click": {
      return [lead, { do: "click", hold, target }];
    }
    case "hover": {
      return [lead, { do: "hover", ms: hold, target }];
    }
    case "key": {
      return [lead, { do: "key", hold, key: target }];
    }
    case "sweep": {
      return [
        lead,
        { do: "sweep", from: 0.12, ms: 2600, target, to: 0.88 },
        { do: "wait", ms: Math.max(0, hold - 1200) },
      ];
    }
    case "drag": {
      return [
        lead,
        { do: "drag", dx: -240, ms: 1000, target },
        { do: "wait", ms: Math.max(0, hold - 600) },
      ];
    }
    case "resize": {
      return [
        lead,
        { do: "resize", ms: 1500, to: 390 },
        { do: "wait", ms: hold },
      ];
    }
    default: {
      // "theme" (filmed in the other theme) and "idle" (it moves on its own).
      return [{ do: "wait", ms: hold + 600 }];
    }
  }
};

/** Showcase: the hook, then one scene per chosen feature. */
const showcaseScenes = (
  draft: Draft,
  audit: Audit,
  opening: ThemeId,
  warnings: string[]
): Shot[] => {
  const other: ThemeId = opening === "dark" ? "light" : "dark";
  const hook = live(
    asCaption(draft.hook),
    [{ do: "wait", ms: 1500 }],
    "browser",
    opening
  );
  const scenes = draft.scenes.flatMap((scene) => {
    const feature = audit.features[scene.feature - 1];
    if (!feature) {
      return [];
    }
    const hold = Math.max(1200, Math.min(4000, scene.hold_ms));
    const theme = feature.trigger.action === "theme" ? other : opening;
    const selector = feature.focus.selector.trim();
    const shot = live(
      asCaption(scene.caption),
      featureBeats(feature, hold),
      "browser",
      theme
    );
    if (selector) {
      shot.mark = {
        label:
          feature.focus.label.trim().slice(0, 32) || feature.name.slice(0, 32),
        target: `css:${selector}`,
      };
    }
    return [shot];
  });
  const showsTheme = draft.scenes.some(
    (scene) => audit.features[scene.feature - 1]?.trigger.action === "theme"
  );
  if (!showsTheme && audit.features.some((f) => f.trigger.action === "theme")) {
    warnings.push("The audit found a theme feature, but no scene shows it.");
  }
  return [hook, ...scenes];
};

/** The storyboard: the draft placed into the video type's fixed structure. */
const assemble = (
  draft: Draft,
  ctx: ComponentContext,
  input: DirectInput,
  warnings: string[],
  audit: Audit | null,
  probe: ProbeResult | null
) => {
  const host = publicHost();
  const opening: ThemeId = draft.opening_theme;
  const beats = audit
    ? []
    : toBeats(draft, ctx, warnings).slice(0, BUDGET[input.length]);
  if (!audit && beats.length === 0) {
    warnings.push(
      ctx.interactions.ariaLabels.length === 0 &&
        ctx.interactions.keys.length === 0
        ? "The component has no labelled controls, so its shots just hold on it."
        : "No usable interactions were left, so the shots just hold on the component."
    );
  }
  const resize: Beat | null = draft.resize.include
    ? {
        caption: asCaption(draft.resize.caption),
        do: "resize",
        ms: 1500,
        to: 390,
      }
    : null;
  const terminal: Shot = {
    caption: asCaption(draft.install_caption),
    command: `npx shadcn@latest add ${host}/r/${ctx.name}.json`,
    kind: "terminal",
    output: installOutput(ctx.files),
    path: "~/yourstartup",
  };
  const end: Shot = {
    ask: VIDEO_ASK,
    cta: host,
    headline: "craftUI",
    kind: "end",
    ms: 2200,
    // Never "free" for a paid item.
    ...(ctx.paid ? {} : { note: "Free to start" }),
    tagline: draft.tagline.trim(),
  };
  const lead: Beat = { do: "wait", ms: 700 };

  let shots: Shot[];
  if (input.type === "showcase" && audit) {
    shots = [
      ...showcaseScenes(draft, audit, opening, warnings),
      ...(input.length === 45 ? [terminal] : []),
      end,
    ];
  } else if (input.type === "tutorial") {
    const lines = draft.usage.code.split("\n").length;
    const highlight = draft.usage.highlight
      .map((g) => g.filter((n) => n >= 1 && n <= lines))
      .filter((g) => g.length > 0)
      .slice(0, 4);
    const second = beats.length > 1 ? beats.slice(1) : beats;
    shots = [
      live(
        asCaption(draft.hook),
        [lead, ...beats.slice(0, 1)],
        "browser",
        opening
      ),
      terminal,
      {
        caption: asCaption(draft.usage.caption),
        code: draft.usage.code,
        file: draft.usage.file.trim() || "app/page.tsx",
        highlight,
        kind: "code",
        lang: "tsx",
        ms: 6500,
      },
      live(
        asCaption(draft.ship_caption),
        [{ do: "wait", ms: 500 }, ...second, ...(resize ? [resize] : [])],
        "browser",
        opening
      ),
      end,
    ];
  } else {
    const variations = draft.variations.slice(0, 3);
    if (variations.length === 0) {
      variations.push({ caption: draft.hook, frame: "phone", theme: opening });
    }
    // Spread the interactions over the shots, so each shot has at least one.
    const per = variations.map((_, i) =>
      beats.filter((__, b) => b % variations.length === i)
    );
    shots = [
      ...variations.map((v, i) =>
        live(
          asCaption(i === 0 ? draft.hook : v.caption),
          [
            { do: "wait", ms: 500 },
            ...(per[i].length > 0 ? per[i] : beats.slice(0, 1)),
          ],
          v.frame,
          v.theme
        )
      ),
      end,
    ];
  }

  return parseSpec({
    audience: input.audience,
    fps: 60,
    handle: SOCIAL_HANDLE,
    item: ctx.name,
    look: {
      dark: probe?.dark,
      frame: draft.look.frame,
      ground:
        input.ground && input.ground !== "auto"
          ? input.ground
          : draft.look.ground,
      palette: probe?.palette ?? [],
    },
    shots,
    theme: opening,
    title: `${ctx.title}: ${input.type}`,
    type: input.type,
    version: 1,
  });
};

// Timing ----------------------------------------------------------------------

/** How long one beat runs, in ms, as the shooter plays it. */
const beatMs = (b: Beat) => {
  switch (b.do) {
    case "wait": {
      return b.ms;
    }
    case "click": {
      return 900 + 460 + b.hold;
    }
    case "hover": {
      return 900 + b.ms;
    }
    case "key": {
      return 300 + b.hold;
    }
    case "resize": {
      return 900 + 200 + b.ms + 300 + 800 + 400;
    }
    case "scroll": {
      return b.ms + 300;
    }
    case "type": {
      return 900 + 460 + b.text.length * 45 + 600;
    }
    case "sweep": {
      return 900 + b.ms + 500;
    }
    case "drag": {
      return 900 + 200 + b.ms + 600;
    }
    default: {
      return 0;
    }
  }
};

/** Rough length in seconds, from the same timings the shooter and composer use. */
export const estimateSeconds = (spec: VideoSpec) => {
  const shotMs = (s: Shot) => {
    switch (s.kind) {
      case "live": {
        return 500 + s.beats.reduce((t, b) => t + beatMs(b), 0) + 500;
      }
      case "terminal": {
        return 500 + s.command.length * 22 + 350 + s.output.length * 300 + 1700;
      }
      default: {
        return s.ms;
      }
    }
  };
  const overlaps = (spec.shots.length - 1) * (10 / 60) * 1000;
  return (
    Math.round(
      (spec.shots.reduce((t, s) => t + shotMs(s), 0) - overlaps) / 100
    ) / 10
  );
};

// Claude ----------------------------------------------------------------------

const describeError = (error: unknown) => {
  if (error instanceof AuthenticationError) {
    return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.";
  }
  if (error instanceof RateLimitError) {
    return "Claude is rate limited right now. Try again in a minute.";
  }
  if (error instanceof APIConnectionError) {
    return "Couldn't reach the Anthropic API. Check the connection.";
  }
  if (error instanceof APIError) {
    return `Claude API error ${error.status}: ${error.message}`;
  }
  return error instanceof Error ? error.message : "The director failed.";
};

export const direct = async (input: DirectInput): Promise<DirectResult> => {
  const ctx = await readComponentContext(input.item);
  // Read each reference video before asking (streamed, never saved).
  const references: ReferenceAnalysis[] = [];
  for (const url of input.references ?? []) {
    try {
      references.push(await analyzeReference(url));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Couldn't read the reference video ${url}: ${reason}`, {
        cause: error,
      });
    }
  }
  const client = new Anthropic();
  const warnings: string[] = [];
  // Showcase: the probe tries the component's interactions for real, then
  // Interface Craft lists the features from what worked; one scene each.
  let audit: Audit | null = null;
  let probe: ProbeResult | null = null;
  if (input.type === "showcase") {
    try {
      probe = await runProbe(ctx.name, ctx.interactions.keys);
    } catch (error) {
      warnings.push(
        `${error instanceof Error ? error.message : String(error)} Features come from the source alone.`
      );
    }
    try {
      audit = await auditFeatures({
        client,
        ctx,
        model: MODEL,
        probe,
        warnings,
      });
    } catch (error) {
      throw new Error(describeError(error), { cause: error });
    }
  }
  const budget = BUDGET[input.length];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      content: [
        { text: userPrompt(ctx, input, references, audit), type: "text" },
        ...references.flatMap(referenceBlocks),
      ],
      role: "user",
    },
  ];

  const ask = async () => {
    try {
      const response = await client.beta.messages.parse({
        betas: ["server-side-fallback-2026-07-01"],
        // On a policy decline the API re-runs the request on a fallback model.
        fallbacks: "default",
        max_tokens: 16_000,
        messages,
        model: MODEL,
        output_config: {
          effort: "high",
          format: betaZodOutputFormat(DraftSchema),
        },
        system: SYSTEM,
      });
      if (response.stop_reason === "refusal") {
        throw new Error("Claude declined to plan this video.");
      }
      if (response.stop_reason === "max_tokens" || !response.parsed_output) {
        throw new Error("The director's answer was cut off. Try again.");
      }
      // Keep the whole turn (thinking included) for the repair round.
      messages.push({ content: response.content, role: "assistant" });
      return response.parsed_output;
    } catch (error) {
      throw new Error(describeError(error), { cause: error });
    }
  };

  let draft = await ask();
  let problems = draftProblems(draft, ctx, input.type, audit, budget);
  // One repair round: the rules say exactly what to fix.
  if (problems.length > 0) {
    messages.push({
      content: `Fix these and return the whole draft again:\n${problems.map((p) => `- ${p}`).join("\n")}`,
      role: "user",
    });
    draft = await ask();
    problems = draftProblems(draft, ctx, input.type, audit, budget);
    if (problems.length > 0) {
      throw new Error(
        `The director's draft still breaks the rules:\n${problems.join("\n")}`
      );
    }
  }

  const spec = assemble(draft, ctx, input, warnings, audit, probe);
  // The hook is shot 1; scene i is shot i + 2 (scenes with unknown features were skipped).
  const featureShots: Record<number, number> = {};
  if (audit) {
    let shot = 2;
    for (const scene of draft.scenes) {
      if (audit.features[scene.feature - 1]) {
        featureShots[scene.feature - 1] = shot;
        shot += 1;
      }
    }
  }
  return {
    audit,
    estimateSeconds: estimateSeconds(spec),
    featureShots,
    interactions: ctx.interactions,
    model: MODEL,
    notes: draft.notes,
    probe,
    referenceNotes: draft.reference_notes.trim(),
    references: references.map(summarize),
    spec,
    warnings,
  };
};
