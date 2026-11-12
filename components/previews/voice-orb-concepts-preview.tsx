"use client";

import { useCallback, useEffect, useState } from "react";
import { TextMorph } from "torph/react";

import { ConceptOrb } from "@/components/previews/voice-orb-concepts/concept-orb";
import { createMurmuration } from "@/components/previews/voice-orb-concepts/murmuration";
import { createOrbitals } from "@/components/previews/voice-orb-concepts/orbitals";
import type { Sim } from "@/components/previews/voice-orb-concepts/shared";
import { cn } from "@/lib/utils";
import { MembraneOrb } from "@/registry/blocks/voice-membrane/voice-membrane";
import {
  ParticleOrb,
  musicLevel,
  speechLevel,
} from "@/registry/blocks/voice-orb/voice-orb";
import type { VoiceState } from "@/registry/blocks/voice-orb/voice-orb";

// Concept board for the voice orb's motion (/preview/voice-orb-concepts,
// not a docs page; kept while choosing more directions): the current orb and the physics-led variations kept from
// the first round (Cymatics and Magnetosphere were dropped) side by side, all driven by one state picked in the bar at the bottom. "Auto"
// steps through the states so the transitions can be compared too. The
// picked state makes up its own voice: speech while listening or speaking,
// music while playing.

// The two shipped blocks' orbs, and the concepts still being explored.
const BLOCK_ORBS = { current: ParticleOrb, membrane: MembraneOrb };

const CONCEPTS: {
  /** A shipped block's orb… */
  block?: keyof typeof BLOCK_ORBS;
  /** …or a concept's simulation. */
  create?: () => Sim;
  idea: string;
  name: string;
  /** The number it had on the first board, kept so feedback still matches. */
  number: number;
}[] = [
  {
    block: "current",
    idea: "A noise-bent shell of points, rim lit. The Voice orb block.",
    name: "Current",
    number: 0,
  },
  {
    block: "membrane",
    idea: "Points on springs; syllables drop ripples. Soap-film colour from film thickness. The Voice membrane block.",
    name: "Membrane",
    number: 2,
  },
  {
    create: createMurmuration,
    idea: "A flock holding a ball. A falcon crosses on each syllable and the turn ripples through.",
    name: "Murmuration",
    number: 4,
  },
  {
    create: createOrbitals,
    idea: "Hydrogen orbitals: 1s, 2s, 2p, 3d, 4f. A quantum jump between states; colour is ψ's sign.",
    name: "Orbitals",
    number: 5,
  },
];

const STATES: { label: string; value: VoiceState }[] = [
  { label: "Idle", value: "idle" },
  { label: "Listening", value: "listening" },
  { label: "Thinking", value: "thinking" },
  { label: "Speaking", value: "speaking" },
  { label: "Now playing", value: "playing" },
];

const WORDS: Record<VoiceState, string> = {
  idle: "Ask me anything",
  listening: "Listening…",
  playing: "Now playing",
  speaking: "Speaking",
  thinking: "Thinking…",
};

/** Seconds each state holds in Auto. */
const AUTO_HOLD = 4.5;

const chipClass = (on: boolean) =>
  cn(
    "h-7 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
    "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
    on
      ? "bg-foreground text-background border-transparent"
      : "bg-background text-muted-foreground hover:text-foreground border-border"
  );

/** The orb for one card: a shipped block's, or a concept simulation. */
const ConceptCard = ({
  concept,
  level,
  state,
}: {
  concept: (typeof CONCEPTS)[number];
  level: () => number;
  state: VoiceState;
}) => {
  if (concept.create) {
    return (
      <ConceptOrb
        className="absolute inset-0"
        create={concept.create}
        level={level}
        state={state}
      />
    );
  }
  const Orb = BLOCK_ORBS[concept.block ?? "current"];
  return <Orb className="absolute inset-0" level={level} state={state} />;
};

const VoiceOrbConceptsPreview = () => {
  const [state, setState] = useState<VoiceState>("idle");
  const [auto, setAuto] = useState(false);

  useEffect(() => {
    if (!auto) {
      return;
    }
    const timer = setInterval(() => {
      setState((current) => {
        const at = STATES.findIndex((s) => s.value === current);
        return STATES[(at + 1) % STATES.length].value;
      });
    }, AUTO_HOLD * 1000);
    return () => clearInterval(timer);
  }, [auto]);

  const level = useCallback(() => {
    const t = performance.now() / 1000;
    if (state === "listening") {
      return speechLevel(t * 0.9) * 0.7;
    }
    if (state === "speaking") {
      return speechLevel(t);
    }
    return state === "playing" ? musicLevel(t) : 0;
  }, [state]);

  return (
    <div className="bg-muted min-h-svh px-4 pt-8 pb-28 sm:px-8">
      <div className="mx-auto grid max-w-4xl gap-x-8 gap-y-10 sm:grid-cols-2">
        {CONCEPTS.map((concept) => (
          <figure className="flex flex-col" key={concept.name}>
            <div className="text-foreground relative aspect-square w-full">
              <ConceptCard concept={concept} level={level} state={state} />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <TextMorph
                  as="p"
                  className="text-foreground text-sm whitespace-nowrap"
                  duration={320}
                  ease="cubic-bezier(0.23, 1, 0.32, 1)"
                  respectReducedMotion
                >
                  {WORDS[state]}
                </TextMorph>
              </div>
            </div>
            <figcaption className="mt-2 px-1">
              <p className="text-foreground text-sm font-medium">
                <span className="text-muted-foreground me-2 font-mono text-xs">
                  {concept.number}
                </span>
                {concept.name}
              </p>
              <p className="text-muted-foreground mt-1 text-xs text-pretty">
                {concept.idea}
              </p>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div
          aria-label="Orb state"
          className="bg-background/90 border-border flex flex-wrap justify-center gap-1.5 rounded-full border p-1.5 shadow-sm backdrop-blur"
          role="group"
        >
          <button
            aria-pressed={auto}
            className={chipClass(auto)}
            onClick={() => setAuto((on) => !on)}
            type="button"
          >
            Auto
          </button>
          {STATES.map((chip) => (
            <button
              aria-pressed={state === chip.value}
              className={chipClass(state === chip.value)}
              key={chip.value}
              onClick={() => {
                setAuto(false);
                setState(chip.value);
              }}
              type="button"
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default VoiceOrbConceptsPreview;
