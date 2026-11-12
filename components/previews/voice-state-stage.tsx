"use client";

import { useCallback, useState } from "react";
import type { ComponentType } from "react";

import { cn } from "@/lib/utils";
import { musicLevel, speechLevel } from "@/registry/blocks/voice-orb/voice-orb";
import type { VoiceState } from "@/registry/blocks/voice-orb/voice-orb";

// The docs stage for the voice blocks (Voice orb, Voice membrane). Chips
// on the stage's bottom edge pick a state, so each look can be seen and
// held; the orb eases from one to the next as it would in an app. The
// block's own talk button is hidden: the chips drive it. Picked states make up
// their own voice: speech while listening or speaking, music while
// playing. Nothing on the stage comes or goes, so the chips sit right under
// the orb and the docs box keeps one height.

interface VoiceBlockProps {
  showControls?: boolean;
  eyebrow?: string;
  label?: string;
  level?: () => number;
  state?: VoiceState;
}

const CHIPS: { label: string; value: VoiceState }[] = [
  { label: "Idle", value: "idle" },
  { label: "Listening", value: "listening" },
  { label: "Thinking", value: "thinking" },
  { label: "Speaking", value: "speaking" },
  { label: "Now playing", value: "playing" },
];

export const VoiceStateStage = ({
  Block,
}: {
  Block: ComponentType<VoiceBlockProps>;
}) => {
  const [picked, setPicked] = useState<VoiceState>("idle");

  const level = useCallback(() => {
    const t = performance.now() / 1000;
    if (picked === "listening") {
      return speechLevel(t * 0.9) * 0.7;
    }
    if (picked === "speaking") {
      return speechLevel(t);
    }
    return picked === "playing" ? musicLevel(t) : 0;
  }, [picked]);

  return (
    <div className="bg-muted flex min-h-[32rem] flex-col items-center justify-center gap-8 px-4 py-12 sm:min-h-[36rem] sm:px-6">
      <Block
        eyebrow={picked === "playing" ? "Now playing" : undefined}
        label={picked === "playing" ? "Rain on Glass" : undefined}
        level={level}
        showControls={false}
        state={picked}
      />
      <div
        aria-label="Orb state"
        className="flex flex-wrap justify-center gap-1.5"
        role="group"
      >
        {CHIPS.map((chip) => (
          <button
            aria-pressed={picked === chip.value}
            className={cn(
              "h-7 rounded-full border px-3 text-xs font-medium transition-colors duration-150",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              picked === chip.value
                ? "bg-foreground text-background border-transparent"
                : "bg-background text-muted-foreground hover:text-foreground border-border"
            )}
            key={chip.value}
            onClick={() => setPicked(chip.value)}
            type="button"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
};
