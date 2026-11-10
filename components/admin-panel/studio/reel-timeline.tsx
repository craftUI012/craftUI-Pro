"use client";

import type { PlayerRef } from "@remotion/player";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { REEL_SOUNDS } from "./reel-sounds";
import type { StudioCue } from "./reel-soundtrack";

// The sound lane under the player: a mark for each effect (drag to move it,
// arrow keys nudge a frame, Delete removes it), the music bed with its drop
// (drag the diamond to move where the music lifts), and the playhead. Click
// the empty lane to jump there.

type Drag = { id: string } | { drop: true };

export const ReelTimeline = ({
  cues,
  dropAt,
  duration,
  fps,
  hasMusic,
  onDropAt,
  onMove,
  onRemove,
  onSelect,
  playerRef,
  selected,
}: {
  cues: StudioCue[];
  dropAt: number | null;
  duration: number;
  fps: number;
  hasMusic: boolean;
  onDropAt: (at: number) => void;
  onMove: (id: string, at: number) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  playerRef: RefObject<PlayerRef | null>;
  selected: string | null;
}) => {
  const lane = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }
    const onFrame = (event: { detail: { frame: number } }) =>
      setFrame(event.detail.frame);
    player.addEventListener("frameupdate", onFrame);
    return () => player.removeEventListener("frameupdate", onFrame);
  }, [playerRef]);

  const percent = (seconds: number) =>
    `${Math.min(100, Math.max(0, (seconds / Math.max(duration, 0.001)) * 100))}%`;

  const timeAt = (clientX: number) => {
    const rect = lane.current?.getBoundingClientRect();
    if (!rect) {
      return 0;
    }
    const share = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    return Math.round(share * duration * fps) / fps;
  };

  const grab =
    (target: Drag) => (event: React.PointerEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = target;
      if ("id" in target) {
        onSelect(target.id);
      }
    };

  const move = (event: React.PointerEvent<HTMLElement>) => {
    const target = drag.current;
    if (!target) {
      return;
    }
    const at = timeAt(event.clientX);
    if ("id" in target) {
      onMove(target.id, at);
    } else {
      onDropAt(at);
    }
  };

  const nudge =
    (cue: StudioCue) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onRemove(cue.id);
        return;
      }
      const step = event.shiftKey ? 0.1 : 1 / fps;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        const at = cue.at + (event.key === "ArrowLeft" ? -step : step);
        onMove(cue.id, Math.min(duration, Math.max(0, at)));
      }
    };

  return (
    // Clicking the empty lane moves the playhead; the marks and the player's
    // own controls are the keyboard route.
    // oxlint-disable-next-line jsx-a11y/no-static-element-interactions
    <div
      className="bg-background relative h-12 touch-none rounded-md border select-none"
      onLostPointerCapture={() => {
        drag.current = null;
      }}
      onPointerDown={(event) => {
        playerRef.current?.seekTo(Math.round(timeAt(event.clientX) * fps));
      }}
      onPointerMove={move}
      onPointerUp={() => {
        drag.current = null;
      }}
      ref={lane}
    >
      {hasMusic ? (
        <div className="bg-primary/15 absolute inset-x-1 bottom-2 h-1.5 rounded-full" />
      ) : null}
      {hasMusic && dropAt !== null ? (
        <button
          aria-label={`Music lifts at ${dropAt.toFixed(2)}s: drag to move`}
          className="bg-background border-primary absolute bottom-[0.3rem] size-3 -translate-x-1/2 rotate-45 cursor-ew-resize rounded-[2px] border-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onPointerDown={grab({ drop: true })}
          style={{ left: percent(dropAt) }}
          title="Music lifts here"
          type="button"
        />
      ) : null}
      {/* A fixed order: re-sorting by time while dragging would move the
          mark in the DOM and drop its pointer capture. */}
      {cues
        .toSorted((a, b) => a.id.localeCompare(b.id))
        .map((cue) => (
          <button
            aria-label={`${REEL_SOUNDS[cue.sound].label} at ${cue.at.toFixed(2)}s${cue.note ? `: ${cue.note}` : ""}`}
            aria-pressed={selected === cue.id}
            className={cn(
              "bg-primary absolute top-1.5 h-5 w-1.5 -translate-x-1/2 cursor-ew-resize rounded-full outline-none",
              "focus-visible:ring-[3px] focus-visible:ring-ring/50",
              selected === cue.id && "ring-primary/40 ring-[3px]"
            )}
            key={cue.id}
            onKeyDown={nudge(cue)}
            onPointerDown={grab({ id: cue.id })}
            style={{ left: percent(cue.at) }}
            title={`${REEL_SOUNDS[cue.sound].label} · ${cue.at.toFixed(2)}s`}
            type="button"
          />
        ))}
      <div
        aria-hidden="true"
        className="bg-foreground/70 pointer-events-none absolute inset-y-0 w-px"
        style={{ left: percent(frame / fps) }}
      />
    </div>
  );
};
