"use client";

import {
  Add01Icon,
  Delete02Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { Video } from "@remotion/media";
import type { PlayerRef } from "@remotion/player";
import { Player } from "@remotion/player";
import type { CSSProperties, RefObject } from "react";
import { useRef, useState } from "react";
import { AbsoluteFill, Img } from "remotion";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ReelClip } from "./reel-clip";
import { useFit } from "./reel-fit";
import type { ReelCue, ReelMusic } from "./reel-scene";
import { CueSound, MusicBed } from "./reel-scene";

// The Studio's Grid board: a square 1080×1080 post with four screen
// recordings playing at once in a 2×2 grid, each with a caption, between a
// header (logo, name, a label) and a big serif headline over a footer (two
// short lines). Laid out after a launch-board post the admin liked, measured
// from its pixels: 40px edges, 492×311 tiles 16px apart in rows at 113 and
// 489, small text (captions, label, footer) in Inter Tight sized to the
// post's widths, and a Crimson Pro headline sized to its 486px.
//
// The board itself never moves; only the tiles play. They're muted and
// loop, so a short clip keeps playing until the longest one ends. The sound
// is the Studio's music bed and effects. Like the single-clip reel
// (reel-scene.tsx), this is what the player previews and the export renders,
// so it keeps to the CSS Remotion's web renderer draws.

export const BOARD = { height: 1080, width: 1080 } as const;
export const TILE_COUNT = 4;

const PAD = 40;
const TILE = { gap: 16, h: 311, w: 492 };
const ROWS = [113, 489];
// The small text's size, and box tops that put its letters where the
// post's are.
const SMALL = 24.5;
const CAPTION_GAP = 12;
const HEADER = { logo: 28, name: 30, top: 44 };
const FOOTER_TOP = 1009;
// The headline's line box is 1.4 lines tall so letters that hang below
// the baseline (J, p, g, y) aren't clipped; `top` places its letters 18px
// above the post's, clear of the footer even with deep descenders. Its
// text starts on the margin like the captions, and the box reaches
// `overhang` px further left so a J's tail (7.6px in Crimson Pro) hangs
// into the margin instead of being cut.
const HEADING = { lineHeight: 1.4, overhang: 20, size: 100.5, top: 840 };

const LOGO_SRC = "/logo/logo-mark-256.png";

export const tileBox = (index: number) => ({
  h: TILE.h,
  w: TILE.w,
  x: PAD + (index % 2) * (TILE.w + TILE.gap),
  y: ROWS[Math.floor(index / 2)] ?? ROWS[0],
});

// The board's words. Captions run left to right, top to bottom.
export interface BoardText {
  brand: string;
  captions: string[];
  footerLeft: string;
  footerRight: string;
  heading: string;
  label: string;
}

export const DEFAULT_BOARD_TEXT: BoardText = {
  brand: "craftUI",
  captions: ["", "", "", ""],
  footerLeft: "craftui.space",
  footerRight: "Browse the library",
  heading: "Just shipped",
  label: "New this week",
};

const isString = (value: unknown): value is string => typeof value === "string";

export const isBoardText = (value: unknown): value is BoardText => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const text = value as Record<string, unknown>;
  return (
    ["brand", "footerLeft", "footerRight", "heading", "label"].every((key) =>
      isString(text[key])
    ) &&
    Array.isArray(text.captions) &&
    text.captions.length === TILE_COUNT &&
    text.captions.every(isString)
  );
};

// Light or dark, to pick ink that reads on it.
export const isDark = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) =>
    Number.parseInt(hex.slice(i, i + 2), 16)
  );
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
};

// A type, not an interface: Remotion wants props assignable to
// Record<string, unknown>.
// oxlint-disable-next-line typescript/consistent-type-definitions
export type BoardSceneProps = {
  background: string;
  cues: ReelCue[];
  music: ReelMusic | null;
  /** The small text's font family (Inter Tight), as next/font resolved it. */
  sans: string;
  /** The headline's font family (Crimson Pro), as next/font resolved it. */
  serif: string;
  sfxVolume: number;
  text: BoardText;
  /** Each tile's video (a blob URL), or null for an empty tile. */
  tiles: (string | null)[];
};

const line = (
  family: string,
  size: number,
  weight: 400 | 500,
  color: string
): CSSProperties => ({
  color,
  fontFamily: family,
  fontSize: size,
  fontWeight: weight,
  letterSpacing: "-0.01em",
  lineHeight: 1.15,
  overflow: "hidden",
  position: "absolute",
  whiteSpace: "nowrap",
});

export const BoardScene = ({
  background,
  cues,
  music,
  sans,
  serif,
  sfxVolume,
  text,
  tiles,
}: BoardSceneProps) => {
  const dark = isDark(background);
  const ink = dark ? "#F2F2EE" : "#141414";
  const emptyTile = dark ? "#1E1E1B" : "#111210";
  const half = BOARD.width / 2 - PAD;
  const small = line(sans, SMALL, 400, ink);
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: 10,
          height: HEADER.logo,
          left: PAD,
          maxWidth: half,
          position: "absolute",
          top: HEADER.top,
        }}
      >
        <Img
          src={LOGO_SRC}
          style={{ height: HEADER.logo, width: HEADER.logo }}
        />
        <span
          style={{
            ...line(sans, HEADER.name, 500, ink),
            letterSpacing: "-0.02em",
            position: "static",
          }}
        >
          {text.brand}
        </span>
      </div>
      <div
        style={{
          ...small,
          maxWidth: half,
          right: PAD,
          textAlign: "right",
          top: HEADER.top,
        }}
      >
        {text.label}
      </div>

      {Array.from({ length: TILE_COUNT }, (_, index) => {
        const box = tileBox(index);
        const src = tiles[index] ?? null;
        const caption = text.captions[index] ?? "";
        return (
          // Positions never change, so the index is a stable key.
          // oxlint-disable-next-line react/no-array-index-key
          <div key={index}>
            <div
              style={{
                backgroundColor: emptyTile,
                height: box.h,
                left: box.x,
                overflow: "hidden",
                position: "absolute",
                top: box.y,
                width: box.w,
              }}
            >
              {src ? (
                <Video
                  disallowFallbackToOffthreadVideo
                  loop
                  muted
                  objectFit="cover"
                  src={src}
                  style={{ height: "100%", width: "100%" }}
                />
              ) : null}
            </div>
            {caption ? (
              <div
                style={{
                  ...small,
                  left: box.x,
                  top: box.y + box.h + CAPTION_GAP,
                  width: box.w,
                }}
              >
                {caption}
              </div>
            ) : null}
          </div>
        );
      })}

      <div
        style={{
          ...line(serif, HEADING.size, 400, ink),
          left: PAD - HEADING.overhang,
          letterSpacing: "-0.02em",
          lineHeight: HEADING.lineHeight,
          maxWidth: BOARD.width - PAD * 2 + HEADING.overhang,
          paddingLeft: HEADING.overhang,
          top: HEADING.top,
        }}
      >
        {text.heading}
      </div>
      <div style={{ ...small, left: PAD, maxWidth: half, top: FOOTER_TOP }}>
        {text.footerLeft}
      </div>
      <div
        style={{
          ...small,
          maxWidth: half,
          right: PAD,
          textAlign: "right",
          top: FOOTER_TOP,
        }}
      >
        {text.footerRight}
      </div>

      {music ? <MusicBed music={music} /> : null}
      {cues.map((cue) => (
        <CueSound cue={cue} gain={sfxVolume} key={cue.id} />
      ))}
    </AbsoluteFill>
  );
};

const pct = (value: number, of: number) => `${(value / of) * 100}%`;

// One tile's layer over the player: a drop target, "Add video" while it's
// empty, and Replace and Remove on hover once it has one.
const TileLayer = ({
  clip,
  index,
  onChoose,
  onFile,
  onRemove,
}: {
  clip: ReelClip | null;
  index: number;
  onChoose: (index: number) => void;
  onFile: (index: number, file: File) => void;
  onRemove: (index: number) => void;
}) => {
  const [over, setOver] = useState(false);
  const box = tileBox(index);
  const name = `tile ${index + 1}`;
  return (
    <div
      className={cn(
        "group/tile absolute flex items-center justify-center",
        over && "ring-primary ring-2"
      )}
      onDragLeave={() => setOver(false)}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setOver(false);
        const [file] = event.dataTransfer.files;
        if (file) {
          onFile(index, file);
        }
      }}
      style={{
        height: pct(box.h, BOARD.height),
        left: pct(box.x, BOARD.width),
        top: pct(box.y, BOARD.height),
        width: pct(box.w, BOARD.width),
      }}
    >
      {clip ? (
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 transition-opacity group-hover/tile:opacity-100 focus-within:opacity-100">
          <Button
            aria-label={`Replace the video in ${name}`}
            className="size-7"
            onClick={() => onChoose(index)}
            size="icon"
            type="button"
            variant="secondary"
          >
            <Icon icon={RefreshIcon} />
          </Button>
          <Button
            aria-label={`Remove the video from ${name}`}
            className="size-7"
            onClick={() => onRemove(index)}
            size="icon"
            type="button"
            variant="secondary"
          >
            <Icon icon={Delete02Icon} />
          </Button>
        </div>
      ) : (
        <Button
          aria-label={`Add a video to ${name}`}
          className="h-7 px-2 text-xs"
          onClick={() => onChoose(index)}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Icon icon={Add01Icon} />
          Add video
        </Button>
      )}
    </div>
  );
};

// The board in the centre column: the player, fitted to the space, with a
// layer per tile. A video dropped on a tile goes there; dropped anywhere
// else on the board it fills the first empty tile.
export const BoardStage = ({
  clips,
  durationInFrames,
  fps,
  onChoose,
  onFile,
  onRemove,
  playerRef,
  scene,
}: {
  clips: (ReelClip | null)[];
  durationInFrames: number;
  fps: number;
  onChoose: (index: number) => void;
  onFile: (index: number | null, file: File) => void;
  onRemove: (index: number) => void;
  playerRef: RefObject<PlayerRef | null>;
  scene: BoardSceneProps;
}) => {
  const area = useRef<HTMLDivElement>(null);
  const fit = useFit(area, BOARD);
  const [over, setOver] = useState(false);

  return (
    <div
      className="flex h-[70svh] min-h-0 w-full items-center justify-center lg:h-auto lg:flex-1"
      ref={area}
    >
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
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          const [file] = event.dataTransfer.files;
          if (file) {
            onFile(null, file);
          }
        }}
        style={{ height: fit?.h ?? 0, width: fit?.w ?? 0 }}
      >
        <Player
          acknowledgeRemotionLicense
          clickToPlay={false}
          component={BoardScene}
          compositionHeight={BOARD.height}
          compositionWidth={BOARD.width}
          doubleClickToFullscreen={false}
          durationInFrames={durationInFrames}
          fps={fps}
          inputProps={scene}
          loop
          ref={playerRef}
          spaceKeyToPlayOrPause={false}
          style={{ height: "100%", width: "100%" }}
        />
        {Array.from({ length: TILE_COUNT }, (_, index) => (
          <TileLayer
            clip={clips[index] ?? null}
            index={index}
            // oxlint-disable-next-line react/no-array-index-key
            key={index}
            onChoose={onChoose}
            onFile={onFile}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
};
