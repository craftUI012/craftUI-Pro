/* ─────────────────────────────────────────────────────────
 * BILLING MOTION: every duration and curve in this block, in one place. Built on the checkout
 * button's model: springs for anything that changes size or place
 * (they retarget mid-flight), a blur cross-fade for content swaps.
 *
 *   dialog   open 250ms / close 150ms, ease-out (CSS, in the dialog)
 *   morph    height follows content: react-use-measure (offsetSize)
 *            on the inner div, the outer animates to it; spring,
 *            visualDuration 0.23s, bounce 0 (tuned by eye: 0.18 read as
 *            a jump on ~390px tab switches, 0.3 as slow). Held at "auto" until the dialog has
 *            finished opening, and always "auto" under reduced motion.
 *   step     content swaps (method panels, card ↔ editor, summary ↔
 *            form) in popLayout: in = opacity + blur 6px → 0, 300ms
 *            ease-out-cubic; out = the reverse on a 0.25s spring.
 *            The blur hides the moment the two overlap.
 *   layout   slots reflow after add / remove / undo: spring 0.25 b0
 *   enter    small things arriving (new card, toast), 200ms out
 *   exit     small things leaving, 150ms out
 *   leave    a removed card: fade, scale 0.92, blur 4px, 180ms out
 *   swap     icon cross-fade (dot ↔ ✎🗑, brand logo while typing):
 *            scale 0.25 → 1, opacity, blur 4px → 0, spring 0.3 b0
 *   roll     a line of text that changes rolls up, 200ms out
 *   undo     the undo bar empties over 5s, linear (it's a clock)
 *   verify   "Verifying with your bank…" holds 1.2s, then ✓ 0.5s
 * ───────────────────────────────────────────────────────── */

export const EASE = {
  inOut: [0.645, 0.045, 0.355, 1] as const,
  out: [0.23, 1, 0.32, 1] as const,
  outCubic: [0.215, 0.61, 0.355, 1] as const,
  /** Speed falls in a straight line: rolls and counters, no tail. */
  outQuad: [0.5, 1, 0.89, 1] as const,
};

export const MOTION = {
  enter: { duration: 0.2, ease: EASE.out },
  exit: { duration: 0.15, ease: EASE.out },
  layout: { bounce: 0, duration: 0.25, type: "spring" as const },
  leave: { duration: 0.18, ease: EASE.out },
  morph: { bounce: 0, type: "spring" as const, visualDuration: 0.23 },
  roll: { duration: 0.2, ease: EASE.out },
  swap: { bounce: 0, duration: 0.3, type: "spring" as const },
};

/** Wait, for the beats between steps (e.g. ✓ before a slot turns). */
export const hold = async (ms: number) => {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

export const TIMING = {
  doneHold: 500,
  undoFor: 5000,
  verify: 1200,
};

export const SWAP_IN = {
  animate: { filter: "blur(0px)", opacity: 1, scale: 1 },
  exit: { filter: "blur(4px)", opacity: 0, scale: 0.25 },
  initial: { filter: "blur(4px)", opacity: 0, scale: 0.25 },
};

export const FADE_ONLY = {
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  initial: { opacity: 0 },
};

/** Content swaps: blur cross-fade; opacity only under reduced motion
 *  (blur and scale are the vestibular triggers, the fade carries the
 *  meaning). Use inside AnimatePresence mode="popLayout". */
export const stepVariants = (reduce: boolean) =>
  reduce
    ? {
        animate: { opacity: 1, transition: { duration: 0.15 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
        initial: { opacity: 0 },
      }
    : {
        animate: {
          filter: "blur(0px)",
          opacity: 1,
          transition: { duration: 0.3, ease: EASE.outCubic },
        },
        exit: {
          filter: "blur(6px)",
          opacity: 0,
          transition: { bounce: 0, duration: 0.25, type: "spring" as const },
        },
        initial: { filter: "blur(6px)", opacity: 0 },
      };
