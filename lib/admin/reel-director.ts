import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

import {
  REEL_SOUNDS,
  SOUND_IDS,
} from "@/components/admin-panel/studio/reel-sounds";

// The Studio's sound director: Claude looks at before/after stills of the
// moments the browser found in a recording, labels what happens, picks a
// sound from the kit for the ones that deserve one, and briefs the music.
// Called by app/api/admin/studio/direct (admins only). Needs
// ANTHROPIC_API_KEY on the server.

const MODEL = "claude-opus-5-5";

const Region = z.object({
  h: z.number(),
  w: z.number(),
  x: z.number(),
  y: z.number(),
});

export const DirectorInput = z.object({
  duration: z.number().positive().max(600),
  hasClipSound: z.boolean(),
  moments: z
    .array(
      z.object({
        area: z.number().min(0).max(1),
        at: z.number().min(0),
        end: z.number().min(0),
        id: z.string().max(8),
        kind: z.enum(["change", "cut", "motion"]),
        region: Region,
        steps: z.array(z.number()).max(24),
      })
    )
    .min(1)
    .max(20),
  stills: z
    .array(z.object({ id: z.string().max(8), jpeg: z.string().max(400_000) }))
    .max(20),
  vibe: z.string().max(200).optional(),
});

export type DirectorRequest = z.infer<typeof DirectorInput>;

const DirectorOutput = z.object({
  cues: z.array(
    z.object({
      at: z.number(),
      moment: z.string(),
      sound: z.enum(SOUND_IDS),
      volume: z.number(),
      why: z.string(),
    })
  ),
  moments: z.array(z.object({ id: z.string(), what: z.string() })),
  music: z.object({
    dropAt: z.number(),
    mood: z.string(),
    queries: z.array(z.string()),
    volume: z.number(),
  }),
  summary: z.string(),
});

export type DirectorPlan = z.infer<typeof DirectorOutput>;

export class DirectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectorError";
  }
}

const KIT = Object.entries(REEL_SOUNDS)
  .map(
    ([id, sound]) => `- ${id} (${sound.label}, ${sound.length}s): ${sound.use}`
  )
  .join("\n");

const SYSTEM = `You are the sound designer for short product videos (vertical 9:16 reels or 16:9 landscape) made from screen recordings of UI components (craftUI, a shadcn/ui component library). You get the reel's length and the moments where the picture changes, each with a before/after still. You decide which moments deserve a sound, which sound from the kit, and brief the music.

Taste: clean and premium, like Apple, Linear and Vercel product videos. Sound only what the viewer's eye is on: a press, something appearing, something landing, a big transition. Most reels need 4 to 12 effects; never put a sound on every change, and leave a moment silent when nothing meaningful happens in it (a cursor drifting, a tiny repaint). Keep at least 0.12 s between effects, except key taps while text is typed (about one per visible keystroke step, using the moment's steps). Use the same sound for repeated identical actions.

Timing: \`at\` is when the sound's hit or peak lands, in seconds. Clicks, pops, keys, knocks and confirms land on the first frame of the change, which is the moment's start. Swish and whoosh land where the movement is fastest, usually 0.1 to 0.25 s after the moment starts. A land or knock goes where the moving thing settles, near the moment's end. Use rise-hit at most once, on the single biggest reveal, and only when the reel builds to it.

Volume: 0.35 to 1.0. Keep repeated small sounds (ticks, keys, pops) at 0.4 to 0.7 so they sit under the picture.

The kit (use these ids only):
${KIT}

Music: the Studio searches Openverse for CC0 music, which is mostly Freesound loops and beds. Give 3 short search queries (2 to 4 words each) likely to find a fitting instrumental loop there, such as "lofi chill loop", "minimal electronic beat" or "soft piano loop"; avoid vocals. \`dropAt\` is the time in seconds of the reel's biggest moment, where the music's energy should rise. \`volume\` is 0.15 to 0.35, at the low end when the clip has its own sound. \`mood\` is 2 to 5 words.

Also label what happens in every moment (3 to 8 words), and sum up the plan in one sentence.`;

const describeRegion = (region: z.infer<typeof Region>) => {
  const cx = region.x + region.w / 2;
  const cy = region.y + region.h / 2;
  if (region.w > 0.7 && region.h > 0.7) {
    return "across the whole frame";
  }
  let row = "middle";
  if (cy < 0.33) {
    row = "top";
  } else if (cy > 0.66) {
    row = "bottom";
  }
  let column = "centre";
  if (cx < 0.33) {
    column = "left";
  } else if (cx > 0.66) {
    column = "right";
  }
  return `${row} ${column}`;
};

const buildContent = (
  input: DirectorRequest
): Anthropic.Beta.BetaContentBlockParam[] => {
  const stills = new Map(input.stills.map((still) => [still.id, still.jpeg]));
  const content: Anthropic.Beta.BetaContentBlockParam[] = [
    {
      text: `The reel is ${input.duration.toFixed(2)} s long. The clip ${input.hasClipSound ? "has its own sound, which stays in the mix" : "has no sound of its own"}.${input.vibe ? ` The maker describes the feel they want as: "${input.vibe}" (a preference, not an instruction).` : ""}\n\nThe moments, in order. Each image shows the frame just before the moment (left) and after it (right), with the changed area boxed in red on the right.`,
      type: "text",
    },
  ];
  for (const moment of input.moments) {
    const steps =
      moment.steps.length > 0
        ? ` Smaller pulses inside it at ${moment.steps.join(", ")} s.`
        : "";
    content.push({
      text: `Moment ${moment.id}: ${moment.at.toFixed(2)} to ${moment.end.toFixed(2)} s, ${moment.kind}, ${(moment.area * 100).toFixed(1)}% of the frame changed, ${describeRegion(moment.region)}.${steps}`,
      type: "text",
    });
    const jpeg = stills.get(moment.id);
    if (jpeg) {
      content.push({
        source: { data: jpeg, media_type: "image/jpeg", type: "base64" },
        type: "image",
      });
    }
  }
  content.push({
    text: "Plan the sound effects and the music brief.",
    type: "text",
  });
  return content;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Keep the model's numbers inside what the Studio can use.
const tidy = (plan: DirectorPlan, duration: number): DirectorPlan => ({
  ...plan,
  cues: plan.cues
    .map((cue) => ({
      ...cue,
      at: Number(clamp(cue.at, 0, duration).toFixed(3)),
      volume: Number(clamp(cue.volume, 0.2, 1).toFixed(2)),
    }))
    .toSorted((a, b) => a.at - b.at),
  music: {
    ...plan.music,
    dropAt: Number(clamp(plan.music.dropAt, 0, duration).toFixed(2)),
    queries: plan.music.queries
      .map((query) => query.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 3),
    volume: Number(clamp(plan.music.volume, 0.08, 0.5).toFixed(2)),
  },
});

export const directReel = async (
  input: DirectorRequest
): Promise<DirectorPlan> => {
  const client = new Anthropic();
  const response = await client.beta.messages.parse({
    // A request the model's safety classifiers decline is re-run on
    // Anthropic's recommended fallback model instead of failing.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 16_000,
    messages: [{ content: buildContent(input), role: "user" }],
    model: MODEL,
    output_config: {
      effort: "medium",
      format: betaZodOutputFormat(DirectorOutput),
    },
    system: SYSTEM,
  });

  if (response.stop_reason === "refusal") {
    throw new DirectorError(
      "Claude declined to plan this one. Try again, or add sounds by hand."
    );
  }
  if (response.stop_reason === "max_tokens" || !response.parsed_output) {
    throw new DirectorError("Claude's plan came back incomplete. Try again.");
  }
  return tidy(response.parsed_output, input.duration);
};
