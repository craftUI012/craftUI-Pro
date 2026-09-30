"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import * as React from "react";

import type { PreviewView, PreviewWidth } from "@/components/preview-toolbar";
import { PreviewToolbar } from "@/components/preview-toolbar";
import { cn } from "@/lib/utils";

// Container width per toolbar selection. "desktop" removes the max-width so
// the preview goes back to filling the box.
const WIDTH_CLASS: Record<PreviewWidth, string> = {
  desktop: "max-w-full",
  mobile: "max-w-[24rem]",
  tablet: "max-w-[48rem]",
};

// No easing, no duration: both clip-paths cut straight to their target state
// (transition: { duration: 0 } on every variant below). No stagger either —
// curtain and card switch in the same instant.
const INSTANT = { duration: 0 };

// clip-path insets, expressed as (top right bottom left). The curtain sweeps
// along x, the card along y — perpendicular to each other. The card is a DOM
// child of the curtain rather than a sibling: an element's clip-path also
// clips its descendants, so the card can only ever be visible where the
// curtain itself is already visible — never leaking onto the raw,
// un-blurred preview outside it.
//
// Curtain: a 0-width sliver pinned to the left edge (negative x), growing
// rightward to full width.
// Every value is a percentage — never a bare 0 — so each corresponding
// token across the hidden/visible pair shares one unit type. Motion tweens
// clipPath by interpolating the string's own numeric tokens; mix units on
// one of them (e.g. a bare `0` next to a `100%`) and it can't, so it just
// snaps to the end value instead of animating.
const CURTAIN_HIDDEN = "inset(0% 100% 0% 0%)";
const CURTAIN_VISIBLE = "inset(0% 0% 0% 0%)";
// Card: a 0-height sliver pinned to the bottom edge, growing upward to full
// height — perpendicular to the curtain's x sweep.
const CARD_HIDDEN = "inset(100% 0% 0% 0%)";
const CARD_VISIBLE = "inset(0% 0% 0% 0%)";

// The preview box: PreviewToolbar pinned to the top, then the live demo (or,
// for mock items, a screenshot) scaled to the picked device width. Reload
// remounts it instead of actually reloading anything — there's nothing to
// re-fetch for a static screenshot, but it's the same affordance an
// iframe-backed preview would use later.
//
// Switching to Code doesn't swap the preview out. A padded "frame" div sits
// on top of the preview — the padding leaves the real, un-blurred preview
// visible as a margin all around. Inside it, the curtain covers the x axis,
// the card covers y, nested inside the curtain so it's confined to the
// curtain's own reveal. Both cut in/out instantly (see INSTANT above).
//
// `copyValue` is the source "Copy for AI" copies; `locked` (a pro item)
// swaps that for a jump to the Code view, where the paywall is. `installName`
// also ids the box, so a shared link (toolbar Share) scrolls to this card.
export const PreviewFrame = ({
  children,
  copyValue,
  installName,
  locked = false,
  source,
  title,
}: {
  children: React.ReactNode;
  copyValue?: string | null;
  installName?: string;
  locked?: boolean;
  source?: React.ReactNode;
  title?: string;
}) => {
  const [width, setWidth] = React.useState<PreviewWidth>("desktop");
  const [view, setView] = React.useState<PreviewView>("preview");
  const [reloadKey, setReloadKey] = React.useState(0);
  const boxRef = React.useRef<HTMLDivElement>(null);

  const curtainVariants = {
    hidden: { clipPath: CURTAIN_HIDDEN, transition: INSTANT },
    visible: { clipPath: CURTAIN_VISIBLE, transition: INSTANT },
  };
  const cardVariants = {
    hidden: { clipPath: CARD_HIDDEN, transition: INSTANT },
    visible: { clipPath: CARD_VISIBLE, transition: INSTANT },
  };

  const onFullscreen = () => {
    const node = boxRef.current;

    if (!node) {
      return;
    }

    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }

    node.requestFullscreen();
  };

  return (
    <div
      className="not-prose bg-card shadow-card scroll-mt-20 overflow-hidden rounded-lg [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:justify-center"
      id={installName}
      ref={boxRef}
    >
      <PreviewToolbar
        copyValue={copyValue}
        installName={installName}
        locked={locked}
        onLockedCopy={() => setView("code")}
        title={title}
        onFullscreen={onFullscreen}
        onReload={() => setReloadKey((key) => key + 1)}
        onViewChange={setView}
        onWidthChange={setWidth}
        showViewToggle={Boolean(source)}
        view={view}
        width={width}
      />
      <div className="relative">
        <div className="flex justify-center overflow-auto p-6">
          <div
            className={cn(
              "w-full transition-[max-width] duration-300 ease-out",
              WIDTH_CLASS[width]
            )}
            key={reloadKey}
          >
            {children}
          </div>
        </div>

        <LazyMotion features={domAnimation}>
          <AnimatePresence>
            {view === "code" && source ? (
              // The frame: sized to the preview behind it (inset-0) but
              // padded — grid, not absolute+inset-0, because a positioned
              // child's inset-0 measures against the parent's padding edge
              // and ignores the parent's own padding. Grid items respect it.
              <div
                className="absolute inset-0 z-10 grid grid-cols-1 grid-rows-1 p-4 sm:p-6"
                key="reveal"
              >
                <m.div
                  animate="visible"
                  // Transparent on purpose: backdrop-blur alone is the
                  // curtain. A tinted bg here would double-tone on top of
                  // the blur; Paywall/ComponentSource already bring their
                  // own background for the card layer nested inside.
                  className="bg-transparent relative col-start-1 row-start-1 overflow-hidden rounded-xl backdrop-blur-lg"
                  exit="hidden"
                  initial="hidden"
                  variants={curtainVariants}
                >
                  <m.div
                    animate="visible"
                    className="absolute inset-0 overflow-auto"
                    exit="hidden"
                    initial="hidden"
                    variants={cardVariants}
                  >
                    {source}
                  </m.div>
                </m.div>
              </div>
            ) : null}
          </AnimatePresence>
        </LazyMotion>
      </div>
    </div>
  );
};
