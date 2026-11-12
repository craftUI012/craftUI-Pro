"use client";

import { PauseIcon, PlayIcon, PreviousIcon } from "@hugeicons/core-free-icons";
import type { PlayerRef } from "@remotion/player";
import { Player } from "@remotion/player";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

import type { ReelClip } from "./reel-clip";
import { formatTime } from "./reel-clip";
import type { ComponentTheme } from "./reel-components";
import { LiveScreen } from "./reel-components";
import { DEVICES } from "./reel-devices";
import type {
  ReelBox,
  ReelFormat,
  ReelSceneProps,
  ReelText,
} from "./reel-scene";
import { FORMATS, ReelScene, textStyle } from "./reel-scene";

// The frame (9:16 or 16:9): Remotion's player shows the reel, and a layer on
// top lets you drag the clip to move it and pull a corner to resize it.
// Everything is stored in the frame's own pixels (1080x1920 or 1920x1080);
// the layer converts with the frame's on-screen scale.

type Size = (typeof FORMATS)[ReelFormat];

type Corner = "ne" | "nw" | "se" | "sw";
interface Snap {
  x: boolean;
  y: boolean;
}

const CORNERS: { corner: Corner; className: string; label: string }[] = [
  {
    className: "-top-1.5 -left-1.5 cursor-nwse-resize",
    corner: "nw",
    label: "top left",
  },
  {
    className: "-top-1.5 -right-1.5 cursor-nesw-resize",
    corner: "ne",
    label: "top right",
  },
  {
    className: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
    corner: "sw",
    label: "bottom left",
  },
  {
    className: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
    corner: "se",
    label: "bottom right",
  },
];

// Snap the clip's centre to the frame's centre lines within this many
// screen pixels.
const SNAP_PX = 6;
const MIN_WIDTH = 160;

// What to keep clear of anything that must be read. 9:16: where Instagram's
// own buttons and caption sit over a reel (Meta's Reels guidance: the top
// 14%, the bottom 35% and 6% each side). 16:9: YouTube, X and LinkedIn
// don't lay buttons over the picture while it plays, so an even 5%
// title-safe margin, which also survives a player's rounded corners and
// a slight crop. Shown while arranging, never exported. Guides and snap
// lines draw in white with mix-blend-difference, so they stay visible on
// any background or clip.
const SAFE: Record<ReelFormat, { bottom: string; side: string; top: string }> =
  {
    "16:9": { bottom: "5%", side: "5%", top: "5%" },
    "9:16": { bottom: "35%", side: "6%", top: "14%" },
  };

const moveBox = (
  start: ReelBox,
  dx: number,
  dy: number,
  threshold: number,
  size: Size
) => {
  let x = start.x + dx;
  let y = start.y + dy;
  const snap: Snap = {
    x: Math.abs(x + start.w / 2 - size.width / 2) < threshold,
    y: Math.abs(y + start.h / 2 - size.height / 2) < threshold,
  };
  if (snap.x) {
    x = (size.width - start.w) / 2;
  }
  if (snap.y) {
    y = (size.height - start.h) / 2;
  }
  return { box: { ...start, x: Math.round(x), y: Math.round(y) }, snap };
};

// Resize from a corner with the clip's shape kept and the opposite corner
// held still. The bigger of the two pulls (across or down) wins.
const resizeBox = (
  start: ReelBox,
  corner: Corner,
  dx: number,
  dy: number,
  aspect: number
): ReelBox => {
  const east = corner.endsWith("e");
  const south = corner.startsWith("s");
  const across = east ? dx : -dx;
  const down = (south ? dy : -dy) * aspect;
  const grow = Math.abs(across) > Math.abs(down) ? across : down;
  const w = Math.max(MIN_WIDTH, start.w + grow);
  const h = w / aspect;
  return {
    h: Math.round(h),
    w: Math.round(w),
    x: Math.round(east ? start.x : start.x + start.w - w),
    y: Math.round(south ? start.y : start.y + start.h - h),
  };
};

const useScale = (
  ref: RefObject<HTMLDivElement | null>,
  frameWidth: number
) => {
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / frameWidth);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, frameWidth]);
  return scale;
};

// The biggest frame of this shape that fits the area it sits in.
const useFit = (ref: RefObject<HTMLDivElement | null>, frame: Size) => {
  const [fit, setFit] = useState<{ h: number; w: number } | null>(null);
  const { height: frameHeight, width: frameWidth } = frame;
  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      const { height, width } = entry.contentRect;
      const w = Math.floor(
        Math.min(width, (height * frameWidth) / frameHeight)
      );
      setFit(
        w > 0 ? { h: Math.round((w * frameHeight) / frameWidth), w } : null
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, frameHeight, frameWidth]);
  return fit;
};

const NUDGE: Record<string, [number, number]> = {
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
};

const ClipLayer = ({
  aspect,
  box,
  onBoxChange,
  onGrab,
  onSnap,
  scale,
  size,
}: {
  aspect: number;
  box: ReelBox;
  onBoxChange: (box: ReelBox) => void;
  onGrab: () => void;
  onSnap: (snap: Snap) => void;
  scale: number;
  size: Size;
}) => {
  const drag = useRef<{
    box: ReelBox;
    corner: Corner | null;
    x: number;
    y: number;
  } | null>(null);
  const [active, setActive] = useState(false);

  const start =
    (corner: Corner | null) => (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { box, corner, x: event.clientX, y: event.clientY };
      setActive(true);
      onGrab();
    };

  const move = (event: React.PointerEvent<HTMLElement>) => {
    const { current } = drag;
    if (!current || scale === 0) {
      return;
    }
    const dx = (event.clientX - current.x) / scale;
    const dy = (event.clientY - current.y) / scale;
    if (current.corner) {
      onBoxChange(resizeBox(current.box, current.corner, dx, dy, aspect));
      return;
    }
    const moved = moveBox(current.box, dx, dy, SNAP_PX / scale, size);
    onBoxChange(moved.box);
    onSnap(moved.snap);
  };

  const end = () => {
    drag.current = null;
    setActive(false);
    onSnap({ x: false, y: false });
  };

  const nudge = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const step = NUDGE[event.key];
    if (!step) {
      return;
    }
    event.preventDefault();
    const by = event.shiftKey ? 10 : 1;
    onBoxChange({ ...box, x: box.x + step[0] * by, y: box.y + step[1] * by });
  };

  return (
    <div
      className="group absolute"
      onLostPointerCapture={end}
      onPointerCancel={end}
      onPointerMove={move}
      onPointerUp={end}
      style={{
        height: box.h * scale,
        left: box.x * scale,
        top: box.y * scale,
        width: box.w * scale,
      }}
    >
      <button
        aria-label="Clip: drag to move, arrow keys to nudge (Shift for 10px)"
        className={cn(
          "absolute inset-0 cursor-move touch-none outline-none",
          "ring-primary/70 group-hover:ring-1 focus-visible:ring-2",
          active && "ring-1"
        )}
        onKeyDown={nudge}
        onPointerDown={start(null)}
        type="button"
      />
      {CORNERS.map((handle) => (
        <button
          aria-label={`Resize from the ${handle.label} corner`}
          className={cn(
            "bg-background border-primary absolute size-3 touch-none rounded-[2px] border opacity-0 transition-opacity",
            "group-focus-within:opacity-100 group-hover:opacity-100",
            active && "opacity-100",
            handle.className
          )}
          key={handle.corner}
          onPointerDown={start(handle.corner)}
          tabIndex={-1}
          type="button"
        />
      ))}
    </div>
  );
};

// Handles for the text: the same text, invisible, laid out at full reel size
// in a layer scaled like the player, so each handle is exactly its text's
// box. Drag to move (snaps to the centre lines), arrow keys nudge, Delete
// removes.
const TextLayer = ({
  onChange,
  onRemove,
  onSelect,
  onSnap,
  scale,
  selected,
  size,
  texts,
}: {
  onChange: (id: string, patch: Partial<ReelText>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  onSnap: (snap: Snap) => void;
  scale: number;
  selected: string | null;
  size: Size;
  texts: ReelText[];
}) => {
  const drag = useRef<{
    id: string;
    pointerX: number;
    pointerY: number;
    x: number;
    y: number;
  } | null>(null);

  const start =
    (item: ReelText) => (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        id: item.id,
        pointerX: event.clientX,
        pointerY: event.clientY,
        x: item.x,
        y: item.y,
      };
      onSelect(item.id);
    };

  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    const { current } = drag;
    if (!current || scale === 0) {
      return;
    }
    let x = current.x + (event.clientX - current.pointerX) / scale;
    let y = current.y + (event.clientY - current.pointerY) / scale;
    const snap = {
      x: Math.abs(x - size.width / 2) < SNAP_PX / scale,
      y: Math.abs(y - size.height / 2) < SNAP_PX / scale,
    };
    if (snap.x) {
      x = size.width / 2;
    }
    if (snap.y) {
      y = size.height / 2;
    }
    onSnap(snap);
    onChange(current.id, { x: Math.round(x), y: Math.round(y) });
  };

  const end = () => {
    drag.current = null;
    onSnap({ x: false, y: false });
  };

  const keys =
    (item: ReelText) => (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        onRemove(item.id);
        return;
      }
      const step = NUDGE[event.key];
      if (!step) {
        return;
      }
      event.preventDefault();
      const by = event.shiftKey ? 10 : 1;
      onChange(item.id, {
        x: item.x + step[0] * by,
        y: item.y + step[1] * by,
      });
    };

  return (
    <div
      className="pointer-events-none absolute top-0 left-0 origin-top-left"
      style={{
        height: size.height,
        transform: `scale(${scale})`,
        width: size.width,
      }}
    >
      {texts.map((item) => (
        <button
          aria-label={`Text “${item.text}”: drag to move, arrow keys to nudge, Delete to remove`}
          aria-pressed={selected === item.id}
          className={cn(
            "outline-primary pointer-events-auto cursor-move touch-none text-transparent select-none",
            "hover:outline-dashed focus-visible:outline-solid",
            selected === item.id && "outline-solid"
          )}
          key={item.id}
          onKeyDown={keys(item)}
          onLostPointerCapture={end}
          onPointerCancel={end}
          onPointerDown={start(item)}
          onPointerMove={move}
          onPointerUp={end}
          style={{
            ...textStyle(item, size.width),
            outlineOffset: 8 / Math.max(scale, 0.01),
            outlineWidth: 1.5 / Math.max(scale, 0.01),
          }}
          type="button"
        >
          {item.text}
        </button>
      ))}
    </div>
  );
};

// Shown until there's a clip: how to bring one in. Over a device it sits at
// the bottom of the frame so the phone stays visible and draggable.
const EmptyPrompt = ({
  onChoose,
  overDevice,
}: {
  onChoose: () => void;
  overDevice: boolean;
}) => (
  <div
    className={cn(
      "pointer-events-none absolute inset-x-0 flex flex-col items-center gap-3 p-6 text-center",
      overDevice ? "bottom-0" : "inset-y-0 justify-center"
    )}
  >
    <p
      className={cn(
        "text-sm text-balance",
        overDevice
          ? "bg-background/85 rounded-md px-2 py-1"
          : "text-muted-foreground"
      )}
    >
      Paste a recording with ⌘V, drop it here, or
    </p>
    <Button
      className="pointer-events-auto"
      onClick={onChoose}
      size="sm"
      type="button"
      variant="outline"
    >
      Choose a video
    </Button>
  </div>
);

export const ReelStage = ({
  box,
  clip,
  durationInFrames,
  fps,
  guides,
  live,
  onBoxChange,
  onChoose,
  onDeviceChange,
  onFile,
  onRemoveText,
  onSelectText,
  onTextChange,
  playerRef,
  scene,
  selectedText,
}: {
  box: ReelBox;
  clip: ReelClip | null;
  durationInFrames: number;
  fps: number;
  guides: boolean;
  /** A live component in the device's screen (`reload` remounts it). */
  live: { name: string; reload: number; theme: ComponentTheme } | null;
  onBoxChange: (box: ReelBox) => void;
  onChoose: () => void;
  onDeviceChange: (box: ReelBox) => void;
  onFile: (file: File) => void;
  onRemoveText: (id: string) => void;
  onSelectText: (id: string | null) => void;
  onTextChange: (id: string, patch: Partial<ReelText>) => void;
  playerRef: RefObject<PlayerRef | null>;
  scene: ReelSceneProps;
  selectedText: string | null;
}) => {
  const area = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const size = FORMATS[scene.format];
  const safe = SAFE[scene.format];
  const fit = useFit(area, size);
  const scale = useScale(frame, size.width);
  const [snap, setSnap] = useState<Snap>({ x: false, y: false });
  const [over, setOver] = useState(false);

  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    setOver(false);
    const [file] = event.dataTransfer.files;
    if (file) {
      onFile(file);
    }
  };

  return (
    // The area the frame fits into: the whole centre column on a desktop, a
    // tall box on a phone.
    <div
      className="flex h-[70svh] min-h-0 w-full items-center justify-center lg:h-auto lg:flex-1"
      ref={area}
    >
      {/* A drop target for a video file; "Choose a video" is the keyboard
          route. */}
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-lg border shadow-sm select-none",
          !fit && "invisible",
          over && "ring-primary ring-2"
        )}
        onDragLeave={() => setOver(false)}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDrop={drop}
        ref={frame}
        style={{ height: fit?.h ?? 0, width: fit?.w ?? 0 }}
      >
        <Player
          acknowledgeRemotionLicense
          clickToPlay={false}
          component={ReelScene}
          compositionHeight={size.height}
          compositionWidth={size.width}
          doubleClickToFullscreen={false}
          durationInFrames={durationInFrames}
          fps={fps}
          inputProps={scene}
          loop
          ref={playerRef}
          spaceKeyToPlayOrPause={false}
          style={{ height: "100%", width: "100%" }}
        />

        {guides ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute border border-dashed border-white/70 mix-blend-difference"
            style={{
              bottom: safe.bottom,
              left: safe.side,
              right: safe.side,
              top: safe.top,
            }}
          />
        ) : null}
        {snap.x ? (
          <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-white mix-blend-difference" />
        ) : null}
        {snap.y ? (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-white mix-blend-difference" />
        ) : null}

        {/* With a device, the device is what you move (the clip plays in
            its screen); otherwise the clip itself. */}
        {scene.device ? (
          <ClipLayer
            aspect={
              DEVICES[scene.device.id].body.w / DEVICES[scene.device.id].body.h
            }
            box={scene.device.box}
            onBoxChange={onDeviceChange}
            onGrab={() => onSelectText(null)}
            onSnap={setSnap}
            scale={scale}
            size={size}
          />
        ) : null}
        {clip && !scene.device ? (
          <ClipLayer
            aspect={clip.width / clip.height}
            box={box}
            onBoxChange={onBoxChange}
            onGrab={() => onSelectText(null)}
            onSnap={setSnap}
            scale={scale}
            size={size}
          />
        ) : null}
        {scene.device && live ? (
          <LiveScreen
            device={scene.device}
            frame={{ h: size.height, w: size.width }}
            key={`${live.name}-${live.reload}`}
            name={live.name}
            scale={scale}
            theme={live.theme}
          />
        ) : null}
        {clip || (scene.device && live) ? null : (
          <EmptyPrompt onChoose={onChoose} overDevice={Boolean(scene.device)} />
        )}
        {scene.texts.length > 0 ? (
          <TextLayer
            onChange={onTextChange}
            onRemove={onRemoveText}
            onSelect={onSelectText}
            onSnap={setSnap}
            scale={scale}
            selected={selectedText}
            size={size}
            texts={scene.texts}
          />
        ) : null}
      </div>
    </div>
  );
};

// Play, pause and scrub under the frame.
export const ReelTransport = ({
  disabled,
  durationInFrames,
  fps,
  playerRef,
}: {
  disabled: boolean;
  durationInFrames: number;
  fps: number;
  playerRef: RefObject<PlayerRef | null>;
}) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }
    const onFrame = (event: { detail: { frame: number } }) =>
      setFrame(event.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [playerRef]);

  return (
    <div className="flex items-center gap-2">
      <Button
        aria-label="Play from the start"
        disabled={disabled}
        onClick={() => {
          playerRef.current?.seekTo(0);
          playerRef.current?.play();
        }}
        size="icon"
        title="Play the full reel from the start"
        type="button"
        variant="ghost"
      >
        <Icon icon={PreviousIcon} />
      </Button>
      <Button
        aria-label={playing ? "Pause" : "Play"}
        disabled={disabled}
        onClick={() => playerRef.current?.toggle()}
        size="icon"
        type="button"
        variant="outline"
      >
        <Icon icon={playing ? PauseIcon : PlayIcon} />
      </Button>
      <Slider
        aria-label="Time"
        className="flex-1"
        disabled={disabled}
        max={Math.max(1, durationInFrames - 1)}
        min={0}
        onValueChange={([value]) => playerRef.current?.seekTo(value)}
        step={1}
        value={[Math.min(frame, durationInFrames - 1)]}
      />
      <span className="text-muted-foreground w-20 shrink-0 text-right text-xs tabular-nums">
        {formatTime(frame / fps)} / {formatTime(durationInFrames / fps)}
      </span>
    </div>
  );
};
