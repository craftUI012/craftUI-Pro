import type * as React from "react";

import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Server component, CSS only. The brand name in brand blue with a glint that
// travels across it: each letter lifts slightly and brightens in turn
// (`.hero-eyebrow-letter` + `hero-eyebrow-glint` in globals.css). Reduced
// motion keeps the static brand-blue text.
//
// The letters are split for the animation, so assistive tech reads the
// sr-only copy instead of letter-by-letter spans.
export const HeroEyebrow = ({ children }: { children: string }) => (
  <span className={cn(TYPE.cardEyebrow, "text-brand-text")}>
    <span className="sr-only">{children}</span>
    <span aria-hidden className="inline-flex">
      {[...children].map((letter, index) => (
        <span
          // The text is static; position is the letter's identity.
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed string
          key={`${index}-${letter}`}
          className="hero-eyebrow-letter"
          style={{ "--i": index } as React.CSSProperties}
        >
          {letter === " " ? " " : letter}
        </span>
      ))}
    </span>
  </span>
);
