import { readFile } from "node:fs/promises";

import type Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import type { ComponentContext } from "@/lib/studio/context";
import { interfaceCraftPath } from "@/lib/studio/paths";
import { probeReport, probeResponds } from "@/lib/studio/probe";
import type { ProbeResult } from "@/lib/studio/probe";

// The feature audit: before the director plans a showcase, Interface Craft
// (Josh Puckett's skill) is consulted to list the design-engineering points
// the component is built with. Claude gets two of its guides as the method,
// Design Critique (how to look: noticing, uncommon care, industry
// standards, its voice) and Storyboard Animation (how to write a motion as
// a timeline of real values), plus the component's source, and returns the
// features. The director then gives each chosen feature one scene.

/** How a scene makes the feature happen on screen. */
export const TRIGGERS = [
  "click",
  "hover",
  "sweep",
  "drag",
  "key",
  "resize",
  "theme",
  "idle",
] as const;

const FeatureSchema = z.object({
  /** Short founder-facing line for the scene, at most 6 words. */
  caption: z.string(),
  /** File lines and values that prove it. */
  evidence: z.string(),
  /** Where the focus mark sits in the video, and the value it shows. */
  focus: z.object({
    /** The value beside the ring, at most 32 characters ("40ms stagger"). */
    label: z.string(),
    /** A CSS selector for the element that moves, inside the component. */
    selector: z.string(),
  }),
  /** How it affects the person using the page. */
  impact: z.string(),
  /** Which Design Critique lens found it. */
  lens: z.enum([
    "visual design",
    "interface design",
    "consistency",
    "user context",
    "motion",
  ]),
  /** The technique in developer words, used as the scene's eyebrow. */
  name: z.string(),
  /** What a viewer sees, stated factually and quantitatively. */
  observation: z.string(),
  /** 1 to 5: would a typical template have it? 5 = almost never. */
  rarity: z.number().int(),
  /** The motion as a storyboard timeline ("0ms … / 220ms …"). */
  storyboard: z.string(),
  trigger: z.object({
    action: z.enum(TRIGGERS),
    /** A probe group ("G2") for click/hover/sweep/drag (an aria-label when
     *  there was no probe), a key name for key, empty otherwise. After the
     *  audit it holds the storyboard target ("css:…", "aria:…" or the key). */
    target: z.string(),
  }),
  /** 1 to 5: how clearly it reads at phone size. */
  visibility: z.number().int(),
});

const AuditSchema = z.object({
  /** Design Critique Step 0: what this is and the emotional context. */
  context: z.string(),
  /** Weaknesses the critique found, never to be featured. */
  do_not_claim: z.array(z.string()),
  features: z.array(FeatureSchema),
  /** Design Critique Step 1, in one paragraph. */
  first_impression: z.string(),
});

export type Feature = z.infer<typeof FeatureSchema>;
export type Audit = z.infer<typeof AuditSchema>;

const MIN_FEATURES = 3;
const MAX_FEATURES = 8;
export const MAX_FEATURE_CAPTION_WORDS = 6;

const readInterfaceCraft = async () => {
  try {
    const [critique, storyboard] = await Promise.all([
      readFile(interfaceCraftPath("design-critique.md"), "utf-8"),
      readFile(interfaceCraftPath("storyboard-animation.md"), "utf-8"),
    ]);
    return { critique, storyboard };
  } catch (error) {
    throw new Error(
      `Interface Craft isn't installed where the feature audit looks (${interfaceCraftPath()}). Install it there, or set INTERFACE_CRAFT_DIR.`,
      { cause: error }
    );
  }
};

const system = (guides: { critique: string; storyboard: string }) =>
  `You are auditing one craftUI component for a showcase video. Your method is Interface Craft by Josh Puckett: its Design Critique guide (how to look) and its Storyboard Animation guide (how to write a motion down), both below.

Run the critique in reverse. Design Critique finds what is wrong; here you use the same lenses to find what this component gets right that most components don't: the design-engineering decisions a viewer feels but rarely notices. Concretely:
- Step 0 and Step 1 of the critique, briefly, as context and first_impression.
- Walk the lenses (visual design, interface design, consistency, user context) and the component's motion. Use the Noticing, Industry Standards and Uncommon Care frameworks: a feature is a decision that goes past what a typical template or component in this category would do, and you can name the template behaviour it beats.
- Use the critique's voice: specific, decisive, quantitative. Count things, name the values (durations, delays, easing, blur, offsets, radii, breakpoints). No hedging, no praise padding.
- Write each motion as a storyboard in the Storyboard Animation pattern: one line per stage, ms after the trigger, values shown with →, staggers in parentheses. A feature with no motion gets a one-line storyboard of what changes.

Each feature must be:
- true: proved by the source; evidence names the lines or constants and their values;
- visible: it shows on screen when the scene's trigger runs, at phone size, in the real component;
- one thing: one decision per feature, so one scene can show it.

Interactions are where the best features usually live, so look for them first. When an interaction probe is attached, it is ground truth: headless Chrome opened the real component, found every element that reacts to input (grouped as G1, G2…, with their handlers and cursor) and tried each interaction for real, reporting what changed on screen (which elements scaled and by how much, what faded, appeared or went away, whether the text changed) next to what changes on its own when idle. Read the source to explain what the probe saw (the mechanism, the values), and give every interaction that RESPONDS a hard look as a feature: a dock that magnifies under a moving cursor, a tile that springs open, a rail you can drag, a custom cursor that becomes a label.

The trigger is how the scene makes the feature happen:
- "hover" or "click" on a probe group: target is its id ("G2"); the probe must show that action on that group RESPONDS.
- "sweep": the cursor glides across a row, left to right (a dock, a hover trail, anything driven by pointer movement): target is the group whose sweep RESPONDS.
- "drag": press, drag and release on a group: target is the group whose drag RESPONDS.
- "key" with a key whose probe test RESPONDS (or, with no probe, one of the listed keys).
- "resize" (the window is dragged to phone width), "theme" (the same component in the other theme; only if its styles include dark-mode), or "idle" (it moves on its own while the scene holds).
With no probe attached, "hover" and "click" target one of the listed aria-labels, copied exactly. Motion that only plays once on page load can't be filmed yet; leave it out. If the probe says the component draws its own cursor (own_cursor), the video hides its cursor over it, so the component's cursor is part of what viewers see.

focus says where the video's focus mark goes: selector is a CSS selector, written from the source, that matches the element where the motion happens (not the button that triggers it), for example "blockquote" or "section img"; prefer element names, attributes and stable class combinations over long Tailwind chains, and make sure it matches in the rendered markup. label is the value the mark shows beside it, at most 32 characters ("40ms stagger", "blur 4px → 0"). Leave selector empty if no single element carries the motion.

caption is the scene's on-screen line for founders: what the visitor feels, at most ${MAX_FEATURE_CAPTION_WORDS} words, sentence case, no numbers (values belong in the storyboard), no hype. name is the technique in developer words, at most 40 characters.

Score visibility (how clearly it reads at phone size) and rarity (5 = a typical template almost never has it) as whole numbers from 1 to 5, never higher. Return ${MIN_FEATURES} to ${MAX_FEATURES} features, strongest first (visibility × rarity). In do_not_claim, list what the critique finds weak in this component (with the evidence), so the video never features it.

<interface_craft_design_critique>
${guides.critique}
</interface_craft_design_critique>

<interface_craft_storyboard_animation>
${guides.storyboard}
</interface_craft_storyboard_animation>`;

const prompt = (ctx: ComponentContext, probe: ProbeResult | null) => {
  const facts = {
    description: ctx.description,
    interactive_elements: {
      aria_labels: ctx.interactions.ariaLabels,
      keys: ctx.interactions.keys,
    },
    name: ctx.name,
    props: ctx.props,
    styles: ctx.styles,
    title: ctx.title,
    types: ctx.types,
    use_cases: ctx.useCases,
  };
  return `Audit this component and list its features.

<facts>
${JSON.stringify(facts, null, 2)}
</facts>

<source file="${ctx.files[0] ?? ctx.name}">
${ctx.source}
</source>${probe ? `\n\n${probeReport(probe)}` : "\n\nNo interaction probe ran; use the listed aria-labels and keys."}`;
};

/** Visibility and rarity are 1 to 5, whatever scale the model used. */
const score = (n: number) => Math.max(1, Math.min(5, Math.round(n)));

const POINTER_ACTIONS = new Set(["click", "hover", "sweep", "drag"]);

/**
 * Checks a feature's trigger against what the component can really do and
 * turns it into the storyboard's target. Features that fail are left out.
 */
const resolveTrigger = (
  feature: Feature,
  ctx: ComponentContext,
  probe: ProbeResult | null,
  warnings: string[]
): Feature | null => {
  const { action, target } = feature.trigger;
  const fail = (why: string) => {
    warnings.push(`Feature "${feature.name}" left out: ${why}`);
    return null;
  };
  const withTarget = (resolved: string) => ({
    ...feature,
    trigger: { action, target: resolved },
  });
  if (POINTER_ACTIONS.has(action)) {
    if (probe) {
      const group = probe.groups.find((g) => g.id === target);
      const test = probe.tests.find(
        (t) =>
          t.action === action &&
          t.responds === true &&
          (t.group === target || t.across === target)
      );
      if (!group || !test) {
        return fail(
          `the probe didn't see a ${action} on ${target} do anything.`
        );
      }
      // A sweep runs along the row the pointer drives, not its container.
      const row =
        action === "sweep"
          ? (probe.groups.find((g) => g.id === test.across) ?? group)
          : group;
      return withTarget(`css:${row.selector}`);
    }
    if (action === "click" || action === "hover") {
      return ctx.interactions.ariaLabels.includes(target)
        ? withTarget(`aria:${target}`)
        : fail(`no element has the aria-label "${target}".`);
    }
    return fail(`a ${action} needs the interaction probe, which didn't run.`);
  }
  if (action === "key") {
    const known = probe
      ? probeResponds(probe, "key", target)
      : ctx.interactions.keys.includes(target);
    return known
      ? withTarget(target)
      : fail(`pressing "${target}" didn't change anything.`);
  }
  if (action === "theme" && !ctx.styles.includes("dark-mode")) {
    return fail("the component's styles don't include dark-mode.");
  }
  return withTarget("");
};

export const auditFeatures = async ({
  client,
  ctx,
  model,
  probe,
  warnings,
}: {
  client: Anthropic;
  ctx: ComponentContext;
  model: string;
  probe: ProbeResult | null;
  warnings: string[];
}): Promise<Audit> => {
  const guides = await readInterfaceCraft();
  const response = await client.beta.messages.parse({
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 16_000,
    messages: [{ content: prompt(ctx, probe), role: "user" }],
    model,
    output_config: {
      effort: "high",
      format: betaZodOutputFormat(AuditSchema),
    },
    system: system(guides),
  });
  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined the feature audit.");
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new Error("The feature audit was cut off. Try again.");
  }
  const audit = response.parsed_output;
  const features = audit.features
    .map((f) => resolveTrigger(f, ctx, probe, warnings))
    .filter((f): f is Feature => f !== null)
    .map((f) => ({
      ...f,
      rarity: score(f.rarity),
      visibility: score(f.visibility),
    }));
  if (features.length === 0) {
    throw new Error(
      "The feature audit found nothing the video can film for this component."
    );
  }
  return { ...audit, features };
};
