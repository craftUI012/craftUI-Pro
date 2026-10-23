"use client";

import { useReducedMotion } from "motion/react";
import Link from "next/link";
import type * as React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  CARD_FRAME,
  CARD_SURFACE,
  CardCaption,
  PREVIEW_CLASS,
  PreviewImage,
} from "@/components/new-hero-section/browse/browse-card-parts";
import type {
  ShowcaseItem,
  ShowcaseVideo,
} from "@/components/new-hero-section/data/home-types";
import { cn } from "@/lib/utils";

// A browse card for an item with a video. At rest it looks like any other
// card (its screenshot), plus a fine ruler in the bottom padding: that ruler
// is the hint that there's footage.
//
// - Hover (or keyboard focus) plays the video, muted and looping, over the
//   screenshot, after a short intent delay so sweeping across the grid
//   doesn't. Leaving pauses it and keeps the position; the next hover
//   carries on from the same frame.
// - The pointer is the timeline. Moving across the screenshot, the ruler, or
//   just under the card scrubs; holding still plays on from there.
// - The ruler magnifies under the pointer like the macOS dock, and the part
//   you've watched stays bright, so progress needs no coloured line.
// - Touch screens have no hover: the card plays while it's mostly in view
//   (not with reduced motion).
//
// The video is preload="none" until the first hover, so cards cost nothing
// until someone shows interest. Files come from Cloudflare R2
// (content/video-manifest.json, `pnpm media`).

// Hover long enough to mean it.
const INTENT_MS = 150;
// Pointer travel (px) before a move counts as scrubbing, not a jittery hover.
const SCRUB_THRESHOLD = 4;
// How long the pointer rests before playback picks up from the playhead.
const SETTLE_MS = 300;

// The ruler: a tall tick every STEPS ticks. A fixed count, so it draws before
// the video (and its length) has loaded.
const STEPS = 4;
const TICKS = 12 * STEPS + 1;
// The dock lens: how far it reaches either side of the pointer (px, so it
// feels the same on every card size) and how tall the tick under the pointer
// grows (× its resting height).
const REACH_PX = 56;
const MAGNIFY = 3.5;
// The ruler strip under the screenshot, and how far below the card the
// pointer still drives it (px).
const RULER_HEIGHT = 22;
const HIT_BELOW = 32;

// Fades both ends, so the ruler never runs into the card's rounded corners.
const FADE_ENDS =
  "[mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]";

// play() rejects when a quick leave pauses before it settles; that's fine.
const playQuietly = async (video: HTMLVideoElement) => {
  try {
    await video.play();
  } catch {
    // Interrupted by pause().
  }
};

const isHoverPointer = (event: React.PointerEvent) =>
  event.pointerType === "mouse" || event.pointerType === "pen";

export const BrowseVideoCard = ({
  eager,
  item,
  video,
}: {
  eager: boolean;
  item: ShowcaseItem;
  video: ShowcaseVideo;
}) => {
  const cardRef = useRef<HTMLAnchorElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const ticks = useRef<(HTMLSpanElement | null)[]>([]);
  const intent = useRef(0);
  const settle = useRef(0);
  const enterX = useRef<number | null>(null);
  // Hovered (or focused, or in view on touch), and whether the video has
  // shown a frame yet. The video is visible while both hold, also when it's
  // paused mid-scrub, so you see the frame you're scrubbing to.
  const [engaged, setEngaged] = useState(false);
  const [ready, setReady] = useState(false);
  const reduce = useReducedMotion();

  const start = useCallback(() => {
    setEngaged(true);
    window.clearTimeout(intent.current);
    intent.current = window.setTimeout(() => {
      const element = videoRef.current;
      if (element) {
        element.preload = "auto";
        playQuietly(element);
      }
    }, INTENT_MS);
  }, []);

  const stop = useCallback(() => {
    setEngaged(false);
    window.clearTimeout(intent.current);
    window.clearTimeout(settle.current);
    videoRef.current?.pause();
  }, []);

  // Play state, the watched part of the ruler (every frame while playing,
  // once on pause and seek), and play-while-in-view on touch screens.
  useEffect(() => {
    const element = videoRef.current;
    const card = cardRef.current;
    if (!element || !card) {
      return;
    }
    const markWatched = () => {
      if (!element.duration) {
        return;
      }
      const watched = element.currentTime / element.duration;
      for (const [index, tick] of ticks.current.entries()) {
        tick?.toggleAttribute("data-on", index / (TICKS - 1) <= watched);
      }
    };
    let raf = 0;
    const loop = () => {
      markWatched();
      raf = requestAnimationFrame(loop);
    };
    const onPlaying = () => {
      setReady(true);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(loop);
    };
    const onPause = () => {
      cancelAnimationFrame(raf);
      markWatched();
    };
    element.addEventListener("playing", onPlaying);
    element.addEventListener("pause", onPause);
    element.addEventListener("seeked", markWatched);

    let observer: IntersectionObserver | undefined;
    if (!reduce && window.matchMedia("(hover: none)").matches) {
      observer = new IntersectionObserver(
        ([entry]) => (entry?.isIntersecting ? start() : stop()),
        { threshold: 0.6 }
      );
      observer.observe(card);
    }
    return () => {
      cancelAnimationFrame(raf);
      element.removeEventListener("playing", onPlaying);
      element.removeEventListener("pause", onPause);
      element.removeEventListener("seeked", markWatched);
      observer?.disconnect();
      window.clearTimeout(intent.current);
      window.clearTimeout(settle.current);
    };
  }, [reduce, start, stop]);

  // Magnify around the pointer (0–1 across the frame); null puts every tick
  // back to rest. A cosine bell: full size under the pointer, easing to
  // nothing at REACH_PX, brighter as it grows.
  const lens = (pointer: number | null) => {
    const width = frameRef.current?.clientWidth ?? 0;
    for (const [index, tick] of ticks.current.entries()) {
      if (tick) {
        const distance =
          pointer === null
            ? Number.POSITIVE_INFINITY
            : Math.abs(index / (TICKS - 1) - pointer) * width;
        const lift =
          distance < REACH_PX
            ? (1 + Math.cos((Math.PI * distance) / REACH_PX)) / 2
            : 0;
        tick.style.scale = `1 ${1 + (MAGNIFY - 1) * lift}`;
        // At rest the watched/unwatched classes set the opacity.
        tick.style.opacity = lift > 0.05 ? String(Math.max(0.35, lift)) : "";
      }
    }
  };

  // Shared by the screenshot and the ruler's hover zone, which is exactly as
  // wide as the screenshot, so x means the same time on both. Entering
  // doesn't move the video (a plain hover resumes); a deliberate move scrubs.
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const element = videoRef.current;
    const frame = frameRef.current;
    if (!element || !frame || !isHoverPointer(event)) {
      return;
    }
    const rect = frame.getBoundingClientRect();
    const pointer = Math.min(
      Math.max((event.clientX - rect.left) / rect.width, 0),
      1
    );
    lens(pointer);
    enterX.current ??= event.clientX;
    if (Math.abs(event.clientX - enterX.current) < SCRUB_THRESHOLD) {
      return;
    }
    if (!element.duration) {
      // Not loaded yet: start, but only when nothing is loading, so the
      // hover's own play() isn't cancelled.
      if (
        element.readyState === 0 &&
        element.networkState !== element.NETWORK_LOADING
      ) {
        element.preload = "auto";
        element.load();
      }
      return;
    }
    element.pause();
    element.currentTime = pointer * element.duration;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      playQuietly(element);
    }, SETTLE_MS);
  };

  const onPointerLeave = () => {
    enterX.current = null;
    window.clearTimeout(settle.current);
    lens(null);
  };

  return (
    <Link
      ref={cardRef}
      href={item.href}
      className="group flex flex-col gap-4 rounded-3xl outline-none"
      onBlur={stop}
      onFocus={start}
      onPointerEnter={(event) => {
        if (isHoverPointer(event)) {
          start();
        }
      }}
      onPointerLeave={(event) => {
        if (isHoverPointer(event)) {
          stop();
        }
      }}
    >
      <div className={CARD_SURFACE}>
        <div className="relative">
          <div
            ref={frameRef}
            className={CARD_FRAME}
            onPointerLeave={onPointerLeave}
            onPointerMove={onPointerMove}
          >
            <PreviewImage eager={eager} preview={item.preview} />
            {/* Fades in once it has played a frame (no black flash) and out
                when the card is left, back to the screenshot. */}
            <video
              ref={videoRef}
              muted
              loop
              playsInline
              preload="none"
              aria-hidden
              tabIndex={-1}
              className={cn(
                "absolute inset-0 size-full",
                PREVIEW_CLASS,
                // After PREVIEW_CLASS, so the fade isn't overridden.
                "transition-[opacity,scale]",
                engaged && ready ? "opacity-100" : "opacity-0"
              )}
            >
              <source src={video.src} type={video.type} />
            </video>
          </div>
          {/* The ruler's hover zone: the bottom padding and HIT_BELOW px past
              the card, so the lens follows a pointer that drifts under it. */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-full z-10"
            style={{ height: RULER_HEIGHT + HIT_BELOW }}
            onPointerLeave={onPointerLeave}
            onPointerMove={onPointerMove}
          />
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-full flex items-end justify-between px-px",
              FADE_ENDS
            )}
            style={{ height: RULER_HEIGHT }}
          >
            {Array.from({ length: TICKS }, (_, index) => (
              <span
                // oxlint-disable-next-line react/no-array-index-key -- A fixed row of ticks.
                key={index}
                ref={(element) => {
                  ticks.current[index] = element;
                }}
                className={cn(
                  "bg-foreground w-px origin-bottom transition-[scale,opacity] duration-150 ease-out motion-reduce:transition-none",
                  index % STEPS === 0
                    ? "h-1.5 opacity-45 data-[on]:opacity-100"
                    : "h-0.5 opacity-20 data-[on]:opacity-60"
                )}
              />
            ))}
          </div>
        </div>
      </div>
      <CardCaption item={item} />
    </Link>
  );
};
