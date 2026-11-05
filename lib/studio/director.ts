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
import type {
  AudienceId,
  HookStyleId,
  LengthId,
  ThemeId,
  VideoTypeId,
} from "@/lib/studio/options";
import { HOOK_STYLES } from "@/lib/studio/options";
import { parseSpec } from "@/reels/spec";
import type { Beat, Caption, Shot, VideoSpec } from "@/reels/spec";

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
  notes: z.string(),
  opening_theme: z.enum(["light", "dark"]),
  resize: z.object({ caption: CaptionDraft, include: z.boolean() }),
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
const BUDGET: Record<LengthId, number> = { 15: 2, 30: 4, 45: 6 };

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
- opening_theme is the theme the video opens in: the one the component looks best in, judged from its source and styles. Light and dark are not a brief choice; showing both is a feature, so the other theme gets its own shot where the type uses it (theme_caption, about the component switching themes for real, from its tokens).
- tagline is the end card's one sentence under the craftUI name, at most ${LIMITS.tagline} characters.
- notes: two or three sentences for the admin on why you chose this hook and these moments.`;

const hookGuide = (id: HookStyleId) => {
  const style = HOOK_STYLES.find((s) => s.id === id);
  return style ? `${style.label}: ${style.description}` : id;
};

const STRUCTURE: Record<VideoTypeId, string> = {
  showcase:
    "Showcase: one browser shot of the component in opening_theme with your interactions (the hook as its caption), optionally the window dragged down to phone width (resize.caption), then the same component in the other theme replaying the first interaction (theme_caption; only when the component's styles include dark-mode), then the install command (install_caption), then the end card. usage, ship_caption and variations are not shown; fill them briefly anyway.",
  tutorial:
    "Tutorial: a short browser shot with the first interaction (the hook), the install command (install_caption, as step 1), the usage code (usage.caption, as step 2), a second browser shot with the remaining interactions and the optional resize (ship_caption, as step 3), then the end card. Number the steps in the eyebrows. variations are not shown; fill them briefly anyway.",
  ugc: "UGC: screen-recording style. One shot per variation (the first shows the hook instead of its own caption), the interactions spread across them, then the end card. Prefer phone frames and show both themes (the first variation in opening_theme). install_caption, usage, ship_caption and resize are not shown; fill them briefly anyway.",
};

const userPrompt = (ctx: ComponentContext, input: DirectInput) => {
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

Use at most ${BUDGET[input.length]} interactions in total.

<facts>
${JSON.stringify(facts, null, 2)}
</facts>

<source file="${ctx.files[0] ?? ctx.name}">
${ctx.source}
</source>`;
};

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
const draftProblems = (
  draft: Draft,
  ctx: ComponentContext,
  type: VideoTypeId
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
    if (draft.resize.include) {
      problems.push(...captionProblems("resize.caption", draft.resize.caption));
    }
  }
  if (type === "showcase" && ctx.styles.includes("dark-mode")) {
    problems.push(...captionProblems("theme_caption", draft.theme_caption));
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
): Shot => ({
  beats: beats.length > 0 ? beats : [{ do: "wait", ms: 3000 }],
  caption,
  frame,
  kind: "live",
  theme,
  url: "yourstartup.com",
  viewport: 768,
});

/** The storyboard: the draft placed into the video type's fixed structure. */
const assemble = (
  draft: Draft,
  ctx: ComponentContext,
  input: DirectInput,
  warnings: string[]
) => {
  const host = publicHost();
  const opening: ThemeId = draft.opening_theme;
  const other: ThemeId = opening === "dark" ? "light" : "dark";
  const beats = toBeats(draft, ctx, warnings).slice(0, BUDGET[input.length]);
  if (beats.length === 0) {
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
    cta: host,
    headline: "craftUI",
    kind: "end",
    ms: 3600,
    note: "Free to start",
    tagline: draft.tagline.trim(),
  };
  const lead: Beat = { do: "wait", ms: 700 };

  // Light and dark is a feature to show, not a brief choice: the showcase
  // replays its first interaction in the other theme when the component
  // claims dark mode.
  const themeShot: Shot[] = [];
  if (input.type === "showcase") {
    if (ctx.styles.includes("dark-mode")) {
      themeShot.push(
        live(
          asCaption(draft.theme_caption),
          [{ do: "wait", ms: 600 }, ...beats.slice(0, 1)],
          "browser",
          other
        )
      );
    } else {
      warnings.push(
        "The component's styles don't include dark-mode, so the showcase has no theme shot."
      );
    }
  }

  let shots: Shot[];
  if (input.type === "showcase") {
    const before = resize && beats.length > 1 ? beats.slice(0, -1) : beats;
    const after = resize && beats.length > 1 ? beats.slice(-1) : [];
    shots = [
      live(
        asCaption(draft.hook),
        [lead, ...before, ...(resize ? [resize] : []), ...after],
        "browser",
        opening
      ),
      ...themeShot,
      terminal,
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
    item: ctx.name,
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
  const client = new Anthropic();
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { content: userPrompt(ctx, input), role: "user" },
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
  let problems = draftProblems(draft, ctx, input.type);
  // One repair round: the rules say exactly what to fix.
  if (problems.length > 0) {
    messages.push({
      content: `Fix these and return the whole draft again:\n${problems.map((p) => `- ${p}`).join("\n")}`,
      role: "user",
    });
    draft = await ask();
    problems = draftProblems(draft, ctx, input.type);
    if (problems.length > 0) {
      throw new Error(
        `The director's draft still breaks the rules:\n${problems.join("\n")}`
      );
    }
  }

  const warnings: string[] = [];
  const spec = assemble(draft, ctx, input, warnings);
  return {
    estimateSeconds: estimateSeconds(spec),
    interactions: ctx.interactions,
    model: MODEL,
    notes: draft.notes,
    spec,
    warnings,
  };
};
