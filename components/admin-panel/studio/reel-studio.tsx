"use client";

import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  Download04Icon,
  ImageAdd02Icon,
  RecordIcon,
  RefreshIcon,
  Upload04Icon,
} from "@hugeicons/core-free-icons";
import type { PlayerRef } from "@remotion/player";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import type { ReelClip, ReelImage } from "./reel-clip";
import {
  boardFileName,
  codecLabel,
  exportBoard,
  exportReel,
  fitBox,
  formatBytes,
  formatTime,
  framesFor,
  readClip,
  readImage,
  reelFileName,
  saveBlob,
} from "./reel-clip";
import type { ComponentTheme, StudioComponent } from "./reel-components";
import { ComponentPicker, isComponentTheme } from "./reel-components";
import type { DeviceId } from "./reel-devices";
import {
  DEVICE_KINDS,
  DEVICES,
  fitDevice,
  isDeviceId,
  kindOf,
} from "./reel-devices";
import type { BoardSceneProps, BoardText } from "./reel-grid";
import {
  BOARD,
  BoardStage,
  DEFAULT_BOARD_TEXT,
  isBoardText,
  isDark,
  TILE_COUNT,
} from "./reel-grid";
import { canRecordElements, RecordView } from "./reel-recorder";
import type {
  ReelBackdrop,
  ReelBox,
  ReelFormat,
  ReelSceneProps,
  ReelText,
} from "./reel-scene";
import { FORMATS, isReelFormat } from "./reel-scene";
import { SoundPanel, useSoundtrack } from "./reel-soundtrack";
import { ReelStage, ReelTransport } from "./reel-stage";
import { ReelTimeline } from "./reel-timeline";

// The admin Studio: put a screen recording on a 9:16 frame (Reels, TikTok,
// Shorts) or a 16:9 one (YouTube, X, LinkedIn), pick the background, move
// and size the clip, export an MP4. Or switch to the Grid board: four
// recordings in a 2×2 grid on a square post (reel-grid.tsx). All in the
// browser; nothing is uploaded.

type Fps = 30 | 60;
type Layout = "grid" | "single";
interface Look {
  background: string;
  /** The Grid board's background colour. */
  boardBackground: string;
  /** The board's length in seconds, or null for its longest clip's. */
  boardLength: number | null;
  /** The board's words: header, captions, headline, footer. */
  boardText: BoardText;
  /** One clip on a frame, or the Grid board. */
  layout: Layout;
  /** How the background image sits: fill the frame or show all of it. */
  backdropFit: ReelBackdrop["fit"];
  /** Black laid over the background image, 0–0.8. */
  backdropDim: number;
  /** A live component (its registry name) for the device's screen. */
  component: string | null;
  /** The live component's theme, independent of the admin's. */
  componentTheme: ComponentTheme;
  /** The device mockup the clip plays in, or none. */
  device: DeviceId | null;
  /** What the device's screen shows: the clip, or a live component. */
  screen: "component" | "video";
  format: ReelFormat;
  fps: Fps;
  guides: boolean;
  radius: number;
  shadow: boolean;
}

const DEFAULT_LOOK: Look = {
  backdropDim: 0,
  backdropFit: "cover",
  background: "#F3F3F1",
  boardBackground: "#E8E8E1",
  boardLength: null,
  boardText: DEFAULT_BOARD_TEXT,
  component: null,
  componentTheme: "light",
  device: null,
  format: "9:16",
  fps: 60,
  guides: true,
  layout: "single",
  radius: 40,
  screen: "video",
  shadow: false,
};

const BACKGROUNDS = [
  { label: "Off-white", value: "#F3F3F1" },
  { label: "Paper", value: "#E8E8E1" },
  { label: "White", value: "#FFFFFF" },
  { label: "Stone", value: "#E7E5E0" },
  { label: "Black", value: "#0A0A0A" },
];

const TEXT_COLOURS = [
  { label: "Ink", value: "#0A0A0A" },
  { label: "Grey", value: "#8A8A8A" },
  { label: "White", value: "#FFFFFF" },
];

const HEX = /^#[0-9a-f]{6}$/i;

const LOOK_KEY = "craftui:reel-studio";

// A clip's length in seconds, 0 without one (framesFor makes that 1 frame).
const secondsOf = (clip: ReelClip | null) => clip?.duration ?? 0;

// The Grid board's part of a saved look, keeping only what checks out.
const boardLook = (saved: Record<string, unknown>): Partial<Look> => {
  const look: Partial<Look> = {};
  if (
    typeof saved.boardBackground === "string" &&
    HEX.test(saved.boardBackground)
  ) {
    look.boardBackground = saved.boardBackground;
  }
  const length = saved.boardLength;
  if (
    length === null ||
    (typeof length === "number" && length > 0 && length <= 120)
  ) {
    look.boardLength = length;
  }
  if (isBoardText(saved.boardText)) {
    look.boardText = saved.boardText;
  }
  if (saved.layout === "single" || saved.layout === "grid") {
    look.layout = saved.layout;
  }
  return look;
};

// The look is remembered in this browser (a convenience; the clip isn't).
const useLook = () => {
  const [look, setLook] = useState(DEFAULT_LOOK);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LOOK_KEY) ?? "{}");
      setLook((current) => ({
        ...current,
        ...(HEX.test(saved.background) && { background: saved.background }),
        ...boardLook(saved),
        ...((saved.backdropFit === "cover" ||
          saved.backdropFit === "contain") && {
          backdropFit: saved.backdropFit,
        }),
        ...(Number.isFinite(saved.backdropDim) && {
          backdropDim: Math.min(Math.max(saved.backdropDim, 0), 0.8),
        }),
        ...(isReelFormat(saved.format) && { format: saved.format }),
        ...((saved.device === null || isDeviceId(saved.device)) && {
          device: saved.device,
        }),
        ...((saved.screen === "video" || saved.screen === "component") && {
          screen: saved.screen,
        }),
        ...((saved.component === null ||
          typeof saved.component === "string") && {
          component: saved.component,
        }),
        ...(isComponentTheme(saved.componentTheme) && {
          componentTheme: saved.componentTheme,
        }),
        ...((saved.fps === 30 || saved.fps === 60) && { fps: saved.fps }),
        ...(typeof saved.guides === "boolean" && { guides: saved.guides }),
        ...(Number.isFinite(saved.radius) && { radius: saved.radius }),
        ...(typeof saved.shadow === "boolean" && { shadow: saved.shadow }),
      }));
    } catch {
      // Private window or blocked storage: keep the defaults.
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) {
      return;
    }
    try {
      localStorage.setItem(LOOK_KEY, JSON.stringify(look));
    } catch {
      // Not saved; the Studio still works.
    }
  }, [look]);

  const update = useCallback(
    (patch: Partial<Look>) => setLook((current) => ({ ...current, ...patch })),
    []
  );
  return [look, update] as const;
};

// ⌘V anywhere on the page with a video (the clip) or an image (the
// background) on the clipboard.
const usePasteFile = (onFile: (file: File) => void) => {
  useEffect(() => {
    const paste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find(
        (item) =>
          item.type.startsWith("video/") || item.type.startsWith("image/")
      );
      if (file) {
        event.preventDefault();
        onFile(file);
      }
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
  }, [onFile]);
};

// On a desktop the Studio fills the window below the admin bar, so nothing
// needs the page to scroll; on a phone it stacks and scrolls as usual.
const useFillHeight = (ref: React.RefObject<HTMLDivElement | null>) => {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      const node = ref.current;
      if (!(node && desktop.matches)) {
        setHeight(null);
        return;
      }
      const top = node.getBoundingClientRect().top + window.scrollY;
      // 32px: the page's bottom padding.
      setHeight(Math.max(560, Math.floor(window.innerHeight - top - 32)));
    };
    update();
    window.addEventListener("resize", update);
    desktop.addEventListener("change", update);
    return () => {
      window.removeEventListener("resize", update);
      desktop.removeEventListener("change", update);
    };
  }, [ref]);
  return height;
};

const Group = ({
  action,
  children,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  title: string;
}) => (
  <section className="flex flex-col gap-3">
    <div className="flex h-7 items-center justify-between gap-2">
      <h2 className="text-muted-foreground text-xs font-medium">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

// The selected text's controls: words, size, weight, colour.
const TextEditor = ({
  frameWidth,
  item,
  onChange,
}: {
  frameWidth: number;
  item: ReelText;
  onChange: (patch: Partial<ReelText>) => void;
}) => (
  <div className="flex flex-col gap-3 rounded-lg border p-3">
    <Textarea
      aria-label="Text"
      className="min-h-0 resize-none text-sm"
      onChange={(event) => onChange({ text: event.target.value })}
      rows={2}
      value={item.text}
    />
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-4">
        <Label className="text-xs" htmlFor="text-size">
          Size
        </Label>
        <span className="text-muted-foreground text-xs tabular-nums">
          {item.size}px
        </span>
      </div>
      <Slider
        id="text-size"
        max={160}
        min={20}
        onValueChange={(size) => typeof size === "number" && onChange({ size })}
        step={1}
        value={item.size}
      />
    </div>
    <ToggleGroup
      aria-label="Weight"
      className="w-full"
      onValueChange={([value = ""]) =>
        value && onChange({ weight: Number(value) as ReelText["weight"] })
      }
      size="sm"
      value={[String(item.weight)]}
      variant="outline"
    >
      <ToggleGroupItem className="flex-1" value="400">
        Regular
      </ToggleGroupItem>
      <ToggleGroupItem className="flex-1" value="500">
        Medium
      </ToggleGroupItem>
    </ToggleGroup>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs">Colour</span>
      <div className="flex items-center gap-1.5">
        {TEXT_COLOURS.map((colour) => (
          <button
            aria-label={`${colour.label} text`}
            aria-pressed={
              item.color.toLowerCase() === colour.value.toLowerCase()
            }
            className={cn(
              "size-6 rounded-full border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              item.color.toLowerCase() === colour.value.toLowerCase() &&
                "ring-primary ring-2 ring-offset-2 ring-offset-background"
            )}
            key={colour.value}
            onClick={() => onChange({ color: colour.value })}
            style={{ backgroundColor: colour.value }}
            type="button"
          />
        ))}
        <label className="relative size-6 cursor-pointer overflow-hidden rounded-full border">
          <span className="sr-only">Custom text colour</span>
          <input
            className="absolute -inset-2 size-10 cursor-pointer"
            onChange={(event) =>
              onChange({ color: event.target.value.toUpperCase() })
            }
            type="color"
            value={item.color}
          />
        </label>
      </div>
    </div>
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs tabular-nums">
        at {item.x}, {item.y}
      </span>
      <Button
        className="h-7 px-2 text-xs"
        onClick={() => onChange({ x: frameWidth / 2 })}
        size="sm"
        type="button"
        variant="outline"
      >
        Centre across
      </Button>
    </div>
  </div>
);

const BackgroundPicker = ({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) => {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        {BACKGROUNDS.map((swatch) => (
          <button
            aria-label={swatch.label}
            aria-pressed={value.toLowerCase() === swatch.value.toLowerCase()}
            className={cn(
              "size-7 rounded-full border outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
              value.toLowerCase() === swatch.value.toLowerCase() &&
                "ring-primary ring-2 ring-offset-2 ring-offset-background"
            )}
            key={swatch.value}
            onClick={() => onChange(swatch.value)}
            style={{ backgroundColor: swatch.value }}
            type="button"
          />
        ))}
        <label className="relative size-7 cursor-pointer overflow-hidden rounded-full border">
          <span className="sr-only">Custom colour</span>
          <input
            className="absolute -inset-2 size-11 cursor-pointer"
            onChange={(event) => onChange(event.target.value.toUpperCase())}
            type="color"
            value={value}
          />
        </label>
      </div>
      <Input
        aria-label="Background colour (hex)"
        className="h-8 font-mono text-xs uppercase"
        maxLength={7}
        onChange={(event) => {
          const next = event.target.value.trim();
          setDraft(next);
          if (HEX.test(next)) {
            onChange(next.toUpperCase());
          }
        }}
        spellCheck={false}
        value={draft}
      />
    </div>
  );
};

// The background image: add one, then fill or fit it and darken it. The
// colour above stays underneath (it shows around a fitted image).
const BackdropPicker = ({
  dim,
  disabled,
  fit,
  image,
  onAdd,
  onDim,
  onFit,
  onRemove,
}: {
  dim: number;
  disabled: boolean;
  fit: ReelBackdrop["fit"];
  image: ReelImage | null;
  onAdd: () => void;
  onDim: (dim: number) => void;
  onFit: (fit: ReelBackdrop["fit"]) => void;
  onRemove: () => void;
}) => {
  if (!image) {
    return (
      <Button
        disabled={disabled}
        onClick={onAdd}
        size="sm"
        type="button"
        variant="outline"
      >
        <Icon icon={ImageAdd02Icon} />
        Add an image
      </Button>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center gap-2.5">
        {/* oxlint-disable-next-line nextjs/no-img-element -- a local blob: URL, not an optimisable asset */}
        <img
          alt=""
          className="size-9 shrink-0 rounded-md border object-cover"
          src={image.src}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs" title={image.name}>
            {image.name}
          </p>
          <p className="text-muted-foreground text-xs tabular-nums">
            {image.width}×{image.height} · {formatBytes(image.size)}
          </p>
        </div>
        <Button
          aria-label="Replace the background image"
          className="size-7"
          disabled={disabled}
          onClick={onAdd}
          size="icon"
          title="Replace"
          type="button"
          variant="ghost"
        >
          <Icon icon={Upload04Icon} />
        </Button>
        <Button
          aria-label="Remove the background image"
          className="size-7"
          disabled={disabled}
          onClick={onRemove}
          size="icon"
          type="button"
          variant="ghost"
        >
          <Icon icon={Delete02Icon} />
        </Button>
      </div>
      <ToggleGroup
        aria-label="Image fit"
        className="w-full"
        onValueChange={([value = ""]) =>
          (value === "cover" || value === "contain") && onFit(value)
        }
        size="sm"
        value={[fit]}
        variant="outline"
      >
        <ToggleGroupItem className="flex-1" value="cover">
          Fill
        </ToggleGroupItem>
        <ToggleGroupItem className="flex-1" value="contain">
          Fit
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-4">
          <Label className="text-xs" htmlFor="backdrop-dim">
            Darken
          </Label>
          <span className="text-muted-foreground text-xs tabular-nums">
            {Math.round(dim * 100)}%
          </span>
        </div>
        <Slider
          id="backdrop-dim"
          max={80}
          min={0}
          onValueChange={(value) =>
            typeof value === "number" && onDim(value / 100)
          }
          step={1}
          value={Math.round(dim * 100)}
        />
      </div>
    </div>
  );
};

// The device the clip plays in (none, a phone or a desktop) and, for a
// device with more than one, its view (the phone: front-on or tilted).
const DevicePicker = ({
  disabled,
  onChange,
  value,
}: {
  disabled: boolean;
  onChange: (device: DeviceId | null) => void;
  value: DeviceId | null;
}) => {
  const current = value ? kindOf(value) : null;
  return (
    <div className="flex flex-col gap-2">
      <ToggleGroup
        aria-label="Device"
        className="w-full"
        disabled={disabled}
        onValueChange={([next = ""]) => {
          const kind = DEVICE_KINDS.find((entry) => entry.kind === next);
          if (next === "none") {
            onChange(null);
          } else if (kind && kind !== current) {
            onChange(kind.views[0].id);
          }
        }}
        size="sm"
        value={[current?.kind ?? "none"]}
        variant="outline"
      >
        <ToggleGroupItem className="flex-1" value="none">
          None
        </ToggleGroupItem>
        {DEVICE_KINDS.map((entry) => (
          <ToggleGroupItem
            className="flex-1"
            key={entry.kind}
            value={entry.kind}
          >
            {entry.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {current && current.views.length > 1 ? (
        <ToggleGroup
          aria-label="View"
          className="w-full"
          disabled={disabled}
          onValueChange={([next = ""]) => isDeviceId(next) && onChange(next)}
          size="sm"
          value={value ? [value] : []}
          variant="outline"
        >
          {current.views.map((view) => (
            <ToggleGroupItem className="flex-1" key={view.id} value={view.id}>
              {view.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
    </div>
  );
};

// What the device's screen shows: the clip, or a live craftUI component
// (picked from a searchable list), with its theme and a reload.
const ScreenSource = ({
  canRecord,
  viewportWidth,
  component,
  disabled,
  onChoose,
  onRecord,
  onReload,
  onScreen,
  onTheme,
  screen,
  theme,
}: {
  /** Whether this browser can record one element (Chrome). */
  canRecord: boolean;
  /** The device's CSS width, which decides the component's layout. */
  viewportWidth: number;
  component: StudioComponent | null;
  disabled: boolean;
  onChoose: () => void;
  onRecord: () => void;
  onReload: () => void;
  onScreen: (screen: Look["screen"]) => void;
  onTheme: (theme: ComponentTheme) => void;
  screen: Look["screen"];
  theme: ComponentTheme;
}) => (
  <div className="flex flex-col gap-2">
    <span className="text-xs">Screen</span>
    <ToggleGroup
      aria-label="Screen"
      className="w-full"
      disabled={disabled}
      onValueChange={([value = ""]) =>
        (value === "video" || value === "component") && onScreen(value)
      }
      size="sm"
      value={[screen]}
      variant="outline"
    >
      <ToggleGroupItem className="flex-1" value="video">
        Video
      </ToggleGroupItem>
      <ToggleGroupItem className="flex-1" value="component">
        Component
      </ToggleGroupItem>
    </ToggleGroup>
    {screen === "component" ? (
      <div className="flex flex-col gap-2 rounded-lg border p-2.5">
        <div className="flex items-center gap-1.5">
          <Button
            className="min-w-0 flex-1 justify-start"
            disabled={disabled}
            onClick={onChoose}
            size="sm"
            type="button"
            variant="outline"
          >
            <span className="truncate">
              {component ? component.title : "Choose a component"}
            </span>
          </Button>
          <Button
            aria-label="Reload the component"
            className="size-8"
            disabled={disabled || !component}
            onClick={onReload}
            size="icon"
            title="Reload"
            type="button"
            variant="ghost"
          >
            <Icon icon={RefreshIcon} />
          </Button>
        </div>
        <ToggleGroup
          aria-label="Component theme"
          className="w-full"
          disabled={disabled}
          onValueChange={([value = ""]) =>
            isComponentTheme(value) && onTheme(value)
          }
          size="sm"
          value={[theme]}
          variant="outline"
        >
          <ToggleGroupItem className="flex-1" value="light">
            Light
          </ToggleGroupItem>
          <ToggleGroupItem className="flex-1" value="dark">
            Dark
          </ToggleGroupItem>
        </ToggleGroup>
        <Button
          disabled={disabled || !component || !canRecord}
          onClick={onRecord}
          size="sm"
          title={canRecord ? undefined : "Recording needs Chrome"}
          type="button"
        >
          <Icon icon={RecordIcon} />
          Record
        </Button>
        <p className="text-muted-foreground text-xs">
          {canRecord
            ? `Live at the device's real width (${viewportWidth}px), so you get that layout. Record it to make the clip you export.`
            : `Live at the device's real width (${viewportWidth}px). Recording needs Chrome.`}
        </p>
      </div>
    ) : null}
  </div>
);

const SwitchRow = ({
  checked,
  disabled,
  id,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  id: string;
  label: string;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex items-center justify-between gap-4">
    <Label className="text-xs" htmlFor={id}>
      {label}
    </Label>
    <Switch
      checked={checked}
      disabled={disabled}
      id={id}
      onCheckedChange={onChange}
    />
  </div>
);

// Centre, Fit to frame and the safe-zone guides; `box` is what they move
// (the device, or the clip), `label` names it when it isn't the clip.
const PositionGroup = ({
  box,
  guides,
  label,
  onCentre,
  onFit,
  onGuides,
}: {
  box: ReelBox | null;
  guides: boolean;
  label: string | null;
  onCentre: () => void;
  onFit: () => void;
  onGuides: (guides: boolean) => void;
}) => (
  <Group title="Position">
    <div className="grid grid-cols-2 gap-2">
      <Button
        disabled={!box}
        onClick={onCentre}
        size="sm"
        type="button"
        variant="outline"
      >
        Centre
      </Button>
      <Button
        disabled={!box}
        onClick={onFit}
        size="sm"
        type="button"
        variant="outline"
      >
        Fit to frame
      </Button>
    </div>
    {box ? (
      <p className="text-muted-foreground text-xs tabular-nums">
        {label ? `${label} ` : ""}
        {box.w}×{box.h} at {box.x}, {box.y}
      </p>
    ) : null}
    <SwitchRow
      checked={guides}
      id="reel-guides"
      label="Safe-zone guides"
      onChange={onGuides}
    />
  </Group>
);

// The Text section: add, pick and edit the lines of text on the frame.
const TextGroup = ({
  frameWidth,
  onAdd,
  onChange,
  onRemove,
  onSelect,
  selected,
  texts,
}: {
  frameWidth: number;
  onAdd: () => void;
  onChange: (id: string, patch: Partial<ReelText>) => void;
  onRemove: (id: string) => void;
  onSelect: (id: string) => void;
  selected: string | null;
  texts: ReelText[];
}) => {
  const selectedItem = texts.find((item) => item.id === selected) ?? null;
  return (
    <Group
      action={
        <Button
          aria-label="Add text"
          className="size-7"
          onClick={onAdd}
          size="icon"
          title="Add text"
          type="button"
          variant="outline"
        >
          <Icon icon={Add01Icon} />
        </Button>
      }
      title="Text"
    >
      {texts.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add a title or a line, then drag it on the frame.
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {texts.map((item) => (
            <li className="flex items-center gap-1" key={item.id}>
              <button
                aria-pressed={selected === item.id}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-xs",
                  selected === item.id
                    ? "bg-accent font-medium"
                    : "hover:bg-accent/60"
                )}
                onClick={() => onSelect(item.id)}
                type="button"
              >
                {item.text.trim() || "Empty text"}
              </button>
              <Button
                aria-label={`Delete “${item.text}”`}
                className="size-7"
                onClick={() => onRemove(item.id)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Icon icon={Delete02Icon} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {selectedItem ? (
        <TextEditor
          frameWidth={frameWidth}
          item={selectedItem}
          onChange={(patch) => onChange(selectedItem.id, patch)}
        />
      ) : null}
    </Group>
  );
};

// The top bar's frame picker: 9:16 or 16:9, with the size it exports at.
const FrameToggle = ({
  disabled,
  format,
  grid,
  onFormat,
}: {
  disabled: boolean;
  format: ReelFormat;
  /** The Grid board is always square, so there's nothing to pick. */
  grid: boolean;
  onFormat: (format: ReelFormat) => void;
}) =>
  grid ? (
    <span className="text-muted-foreground text-xs tabular-nums">
      1:1 · {BOARD.width}×{BOARD.height}
    </span>
  ) : (
    <div className="flex items-center gap-2">
      <ToggleGroup
        aria-label="Frame"
        disabled={disabled}
        onValueChange={([value = ""]) => isReelFormat(value) && onFormat(value)}
        size="sm"
        value={[format]}
        variant="outline"
      >
        {(["9:16", "16:9"] as const).map((value) => (
          <ToggleGroupItem
            key={value}
            title={`${FORMATS[value].width}×${FORMATS[value].height} · ${FORMATS[value].use}`}
            value={value}
          >
            {value}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <span className="text-muted-foreground hidden text-xs tabular-nums sm:inline">
        {FORMATS[format].width}×{FORMATS[format].height}
      </span>
    </div>
  );

// One clip on a frame, or the Grid board. The board is always 1:1.
const LayoutToggle = ({
  disabled,
  layout,
  onLayout,
}: {
  disabled: boolean;
  layout: Layout;
  onLayout: (layout: Layout) => void;
}) => (
  <ToggleGroup
    aria-label="Layout"
    disabled={disabled}
    onValueChange={([value = ""]) =>
      (value === "single" || value === "grid") && onLayout(value)
    }
    size="sm"
    value={[layout]}
    variant="outline"
  >
    <ToggleGroupItem
      title="One recording on a 9:16 or 16:9 frame"
      value="single"
    >
      Single clip
    </ToggleGroupItem>
    <ToggleGroupItem title="Four recordings in a 2×2 grid, 1:1" value="grid">
      Grid
    </ToggleGroupItem>
  </ToggleGroup>
);

// The board's four tiles: a caption each, and its video (add, replace,
// remove). Captions are saved with the look; the videos aren't.
const BoardTiles = ({
  captions,
  clips,
  disabled,
  onCaption,
  onChoose,
  onRemove,
  reading,
}: {
  captions: string[];
  clips: (ReelClip | null)[];
  disabled: boolean;
  onCaption: (index: number, caption: string) => void;
  onChoose: (index: number) => void;
  onRemove: (index: number) => void;
  reading: number | null;
}) => (
  <Group title="Tiles">
    <ol className="flex flex-col gap-3">
      {clips.map((clip, index) => {
        const name = `tile ${index + 1}`;
        let status = "Empty";
        if (reading === index) {
          status = "Reading the video…";
        } else if (clip) {
          status = `${clip.name} · ${formatTime(clip.duration)}`;
        }
        return (
          // The four tiles never reorder.
          // oxlint-disable-next-line react/no-array-index-key
          <li className="flex flex-col gap-1" key={index}>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground w-3 shrink-0 text-xs tabular-nums">
                {index + 1}
              </span>
              <Input
                aria-label={`Caption for ${name}`}
                className="h-8 text-xs"
                maxLength={60}
                onChange={(event) => onCaption(index, event.target.value)}
                placeholder="Caption"
                value={captions[index] ?? ""}
              />
              <Button
                aria-label={
                  clip
                    ? `Replace the video in ${name}`
                    : `Add a video to ${name}`
                }
                className="size-8 shrink-0"
                disabled={disabled || reading !== null}
                onClick={() => onChoose(index)}
                size="icon"
                title={clip ? "Replace the video" : "Add a video"}
                type="button"
                variant="outline"
              >
                <Icon icon={clip ? RefreshIcon : Upload04Icon} />
              </Button>
              {clip ? (
                <Button
                  aria-label={`Remove the video from ${name}`}
                  className="size-8 shrink-0"
                  disabled={disabled}
                  onClick={() => onRemove(index)}
                  size="icon"
                  type="button"
                  variant="ghost"
                >
                  <Icon icon={Delete02Icon} />
                </Button>
              ) : null}
            </div>
            <p
              className="text-muted-foreground truncate pl-4.5 text-xs tabular-nums"
              title={clip?.name}
            >
              {status}
            </p>
          </li>
        );
      })}
    </ol>
    <p className="text-muted-foreground text-xs">
      Drop a video on a tile, or paste with ⌘V to fill the next empty one.
      Shorter clips loop.
    </p>
  </Group>
);

const BOARD_FIELDS: {
  field: Exclude<keyof BoardText, "captions">;
  label: string;
  max: number;
}[] = [
  { field: "brand", label: "Name (next to the logo)", max: 40 },
  { field: "label", label: "Top right", max: 40 },
  { field: "heading", label: "Headline", max: 40 },
  { field: "footerLeft", label: "Footer left", max: 40 },
  { field: "footerRight", label: "Footer right", max: 40 },
];

// The board's other words. Sizes and places are fixed by the layout.
const BoardWords = ({
  onChange,
  text,
}: {
  onChange: (patch: Partial<BoardText>) => void;
  text: BoardText;
}) => (
  <Group title="Words">
    {BOARD_FIELDS.map(({ field, label, max }) => (
      <div className="flex flex-col gap-1.5" key={field}>
        <Label className="text-xs" htmlFor={`board-${field}`}>
          {label}
        </Label>
        <Input
          className="h-8 text-xs"
          id={`board-${field}`}
          maxLength={max}
          onChange={(event) => onChange({ [field]: event.target.value })}
          value={text[field]}
        />
      </div>
    ))}
  </Group>
);

// How long the board runs: its longest clip by default, or a set number of
// seconds (clips loop to fill it, or are cut short).
const BoardLength = ({
  auto,
  onChange,
  value,
}: {
  auto: number;
  onChange: (value: number | null) => void;
  value: number | null;
}) => {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  useEffect(() => setDraft(value === null ? "" : String(value)), [value]);
  let note = "1–120 seconds. Clear it to follow the longest clip.";
  if (value === null) {
    note =
      auto > 0
        ? `Auto: the longest clip, ${formatTime(auto)}.`
        : "Auto: as long as the longest clip.";
  }
  return (
    <Group title="Length">
      <div className="flex items-center gap-2">
        <Input
          aria-label="Length in seconds"
          className="h-8 w-24 text-xs tabular-nums"
          inputMode="decimal"
          onChange={(event) => {
            const next = event.target.value;
            setDraft(next);
            const seconds = Number(next);
            if (next.trim() === "") {
              onChange(null);
            } else if (
              Number.isFinite(seconds) &&
              seconds >= 1 &&
              seconds <= 120
            ) {
              onChange(Math.round(seconds * 10) / 10);
            }
          }}
          placeholder="Auto"
          value={draft}
        />
        <span className="text-muted-foreground text-xs">seconds</span>
      </div>
      <p className="text-muted-foreground text-xs tabular-nums">{note}</p>
    </Group>
  );
};

// The top bar's right side: frame rate and Export, or the export's progress.
const ExportBar = ({
  blocked,
  clip,
  exporting,
  fps,
  onCancel,
  onExport,
  onFps,
}: {
  /** Why Export can't run right now, if it can't. */
  blocked: string | null;
  clip: ReelClip | null;
  exporting: number | null;
  fps: Fps;
  onCancel: () => void;
  onExport: () => void;
  onFps: (fps: Fps) => void;
}) => (
  <div className="flex items-center gap-2">
    <ToggleGroup
      aria-label="Frame rate"
      disabled={exporting !== null}
      onValueChange={([value = ""]) => value && onFps(Number(value) as Fps)}
      size="sm"
      value={[String(fps)]}
      variant="outline"
    >
      <ToggleGroupItem value="30">30 fps</ToggleGroupItem>
      <ToggleGroupItem value="60">60 fps</ToggleGroupItem>
    </ToggleGroup>
    {exporting === null ? (
      <Button
        disabled={!clip || blocked !== null}
        onClick={onExport}
        size="sm"
        title={blocked ?? undefined}
        type="button"
      >
        <Icon icon={Download04Icon} />
        Export MP4
      </Button>
    ) : (
      <div className="flex items-center gap-2">
        <Progress
          aria-label="Export progress"
          className="w-28"
          value={exporting * 100}
        />
        <span className="text-muted-foreground w-9 text-xs tabular-nums">
          {Math.round(exporting * 100)}%
        </span>
        <Button onClick={onCancel} size="sm" type="button" variant="ghost">
          <Icon icon={Cancel01Icon} />
          Cancel
        </Button>
      </div>
    )}
  </div>
);

// The Device section: the phone, and (with a phone) what its screen shows.
const DeviceGroup = ({
  components,
  disabled,
  look,
  onRecorded,
  onReload,
  picked,
  setLook,
}: {
  components: StudioComponent[];
  disabled: boolean;
  look: Look;
  /** A finished recording of the live component, to become the clip. */
  onRecorded: (file: File) => void;
  onReload: () => void;
  picked: StudioComponent | null;
  setLook: (patch: Partial<Look>) => void;
}) => {
  const [picking, setPicking] = useState(false);
  const [recording, setRecording] = useState(false);
  // Read after mount: the server can't know the browser.
  const [canRecord, setCanRecord] = useState(false);
  useEffect(() => setCanRecord(canRecordElements()), []);
  return (
    <Group title="Device">
      <DevicePicker
        disabled={disabled}
        onChange={(device) => setLook({ device })}
        value={look.device}
      />
      {look.device ? (
        <ScreenSource
          canRecord={canRecord}
          viewportWidth={DEVICES[look.device].viewport.width}
          component={picked}
          disabled={disabled}
          onChoose={() => setPicking(true)}
          onRecord={() => setRecording(true)}
          onReload={onReload}
          onScreen={(screen) => {
            setLook({ screen });
            if (screen === "component" && !picked) {
              setPicking(true);
            }
          }}
          onTheme={(componentTheme) => setLook({ componentTheme })}
          screen={look.screen}
          theme={look.componentTheme}
        />
      ) : null}
      <ComponentPicker
        components={components}
        onOpenChange={setPicking}
        onPick={(component) => setLook({ component, screen: "component" })}
        open={picking}
      />
      {recording && picked ? (
        <RecordView
          name={picked.name}
          viewport={
            look.device
              ? DEVICES[look.device].viewport
              : { height: 844, width: 390 }
          }
          onClose={() => setRecording(false)}
          onDone={(file) => {
            setRecording(false);
            setLook({ screen: "video" });
            onRecorded(file);
          }}
          theme={look.componentTheme}
          title={picked.title}
        />
      ) : null}
    </Group>
  );
};

// The live component on the stage: shown when there's a device, its screen
// is set to Component and a known component is picked.
const useLiveComponent = (
  look: Look,
  components: StudioComponent[],
  reload: number
) => {
  const picked =
    components.find((item) => item.name === look.component) ?? null;
  const showing =
    look.layout === "single" &&
    look.device &&
    look.screen === "component" &&
    picked;
  return {
    /** Export can't draw a live component: it's recorded into a clip first. */
    blocked: showing ? "Record the live component to export it" : null,
    picked,
    stage: showing
      ? { name: picked.name, reload, theme: look.componentTheme }
      : null,
  };
};

// Where the device sits, and what Centre and Fit move: the device when
// there is one, else the clip. A device (re)fits whenever it's picked, its
// view changes or the frame changes (including when the saved look loads).
const useDevicePlacement = ({
  box,
  clip,
  device,
  format,
  setBox,
}: {
  box: ReelBox;
  clip: ReelClip | null;
  device: DeviceId | null;
  format: ReelFormat;
  setBox: React.Dispatch<React.SetStateAction<ReelBox>>;
}) => {
  const [deviceBox, setDeviceBox] = useState<ReelBox>({
    h: 0,
    w: 0,
    x: 0,
    y: 0,
  });
  const frame = FORMATS[format];

  useEffect(() => {
    if (device) {
      setDeviceBox(fitDevice(device, format));
    }
  }, [device, format]);

  const centre = () =>
    (device ? setDeviceBox : setBox)((current) => ({
      ...current,
      x: Math.round((frame.width - current.w) / 2),
      y: Math.round((frame.height - current.h) / 2),
    }));
  const fit = () => {
    if (device) {
      setDeviceBox(fitDevice(device, format));
    } else if (clip) {
      setBox(fitBox(clip, format));
    }
  };
  let positioned: ReelBox | null = null;
  if (device) {
    positioned = deviceBox;
  } else if (clip) {
    positioned = box;
  }
  return {
    centre,
    fit,
    /** What Position shows and moves, and its name (the clip has none). */
    label: device ? kindOf(device).label : null,
    positioned,
    scene: device ? { box: deviceBox, id: device } : null,
    setDeviceBox,
  };
};

// The Grid board's four tile videos: read into a given tile or the first
// empty one, replaced, removed. Kept for the session only, like the clip.
const useBoardTiles = ({
  length,
  setProblem,
  setResult,
}: {
  /** The set length in seconds, or null for the longest clip's. */
  length: number | null;
  setProblem: (problem: string | null) => void;
  setResult: (result: string | null) => void;
}) => {
  const [tiles, setTiles] = useState<(ReelClip | null)[]>(() =>
    Array.from({ length: TILE_COUNT }, () => null)
  );
  const [readingTile, setReadingTile] = useState<number | null>(null);
  const tileInput = useRef<HTMLInputElement>(null);
  const choosingTile = useRef(0);
  const longestTile = Math.max(0, ...tiles.map((tile) => tile?.duration ?? 0));
  const firstTile = tiles.find((tile) => tile !== null) ?? null;
  // How long the board runs (0 with no clips and no set length).
  const duration = length ?? longestTile;

  // A video for a board tile: the one given, or the first empty one.
  const loadTile = useCallback(
    async (index: number | null, file: File) => {
      setProblem(null);
      setResult(null);
      if (file.type.startsWith("image/")) {
        setProblem("Board tiles take videos, not images.");
        return;
      }
      const target = index ?? tiles.indexOf(null);
      if (target === -1) {
        setProblem(
          "All four tiles have a video. Drop it on a tile to replace that one."
        );
        return;
      }
      setReadingTile(target);
      try {
        const next = await readClip(file);
        setTiles((current) =>
          current.map((tile, position) => {
            if (position !== target) {
              return tile;
            }
            if (tile) {
              setTimeout(() => URL.revokeObjectURL(tile.src), 1000);
            }
            return next;
          })
        );
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error));
      } finally {
        setReadingTile(null);
      }
    },
    [setProblem, setResult, tiles]
  );

  const removeTile = (index: number) =>
    setTiles((current) =>
      current.map((tile, position) => {
        if (position === index && tile) {
          URL.revokeObjectURL(tile.src);
          return null;
        }
        return tile;
      })
    );

  const chooseTile = (index: number) => {
    choosingTile.current = index;
    tileInput.current?.click();
  };

  return {
    chooseTile,
    choosingTile,
    duration,
    firstTile,
    loadTile,
    longestTile,
    readingTile,
    removeTile,
    tileInput,
    tiles,
  };
};

// The left column for the Grid board: tiles, words, background, length.
const BoardPanel = ({
  board,
  disabled,
  look,
  onText,
  problem,
  setLook,
}: {
  board: ReturnType<typeof useBoardTiles>;
  disabled: boolean;
  look: Look;
  onText: (patch: Partial<BoardText>) => void;
  problem: string | null;
  setLook: (patch: Partial<Look>) => void;
}) => (
  <>
    <BoardTiles
      captions={look.boardText.captions}
      clips={board.tiles}
      disabled={disabled}
      onCaption={(index, caption) =>
        onText({
          captions: look.boardText.captions.map((item, position) =>
            position === index ? caption : item
          ),
        })
      }
      onChoose={board.chooseTile}
      onRemove={board.removeTile}
      reading={board.readingTile}
    />
    <input
      accept="video/*,.mov,.mp4,.m4v,.webm,.mkv"
      className="hidden"
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) {
          board.loadTile(board.choosingTile.current, file);
        }
      }}
      ref={board.tileInput}
      type="file"
    />
    {problem ? (
      <p className="text-destructive text-xs" role="alert">
        {problem}
      </p>
    ) : null}
    <BoardWords onChange={onText} text={look.boardText} />
    <Group title="Background">
      <BackgroundPicker
        onChange={(boardBackground) => setLook({ boardBackground })}
        value={look.boardBackground}
      />
    </Group>
    <BoardLength
      auto={board.longestTile}
      onChange={(boardLength) => setLook({ boardLength })}
      value={look.boardLength}
    />
  </>
);

export const ReelStudio = ({
  components,
  fonts,
}: {
  /** The live components a device's screen can show. */
  components: StudioComponent[];
  /** The Grid board's font families (next/font, loaded by the page). */
  fonts: { sans: string; serif: string };
}) => {
  const [look, setLook] = useLook();
  const [clip, setClip] = useState<ReelClip | null>(null);
  const [box, setBox] = useState<ReelBox>({ h: 0, w: 0, x: 0, y: 0 });
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [exporting, setExporting] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const [backdrop, setBackdrop] = useState<ReelImage | null>(null);
  const playerRef = useRef<PlayerRef>(null);
  const shell = useRef<HTMLDivElement>(null);
  const [texts, setTexts] = useState<ReelText[]>([]);
  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const height = useFillHeight(shell);
  const frame = FORMATS[look.format];
  const live = useLiveComponent(look, components, reload);
  const placement = useDevicePlacement({
    box,
    clip,
    device: look.device,
    format: look.format,
    setBox,
  });

  const grid = look.layout === "grid";
  const board = useBoardTiles({
    length: look.boardLength,
    setProblem,
    setResult,
  });
  const { duration: boardDuration, firstTile, loadTile, tiles } = board;

  // What the sound tools work against: the clip, or for the board a
  // stand-in as long as the board (the tiles themselves are muted).
  const soundClip = useMemo<ReelClip | null>(() => {
    if (!grid) {
      return clip;
    }
    return firstTile && boardDuration > 0
      ? { ...firstTile, duration: boardDuration, hasAudio: false }
      : null;
  }, [grid, clip, firstTile, boardDuration]);

  const soundtrack = useSoundtrack(soundClip);
  const { reset: resetSound } = soundtrack;

  const loadFile = useCallback(
    async (file: File) => {
      setProblem(null);
      setResult(null);
      setReading(true);
      try {
        const next = await readClip(file);
        setClip((previous) => {
          if (previous) {
            setTimeout(() => URL.revokeObjectURL(previous.src), 1000);
          }
          return next;
        });
        setBox(fitBox(next, look.format));
        resetSound();
      } catch (error) {
        setProblem(error instanceof Error ? error.message : String(error));
      } finally {
        setReading(false);
      }
    },
    [look.format, resetSound]
  );

  const loadImage = useCallback(async (file: File) => {
    setProblem(null);
    try {
      const next = await readImage(file);
      setBackdrop((previous) => {
        if (previous) {
          setTimeout(() => URL.revokeObjectURL(previous.src), 1000);
        }
        return next;
      });
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    }
  }, []);

  // One way in for files (paste, drop, the pickers). Single clip: images
  // become the background, anything else is read as the clip. Board: a
  // video fills the next empty tile.
  const takeFile = useCallback(
    (file: File) => {
      if (grid) {
        return loadTile(null, file);
      }
      return file.type.startsWith("image/") ? loadImage(file) : loadFile(file);
    },
    [grid, loadFile, loadImage, loadTile]
  );

  // The sound belongs to what's on screen, so switching layouts clears it.
  const changeLayout = (layout: Layout) => {
    if (layout === look.layout) {
      return;
    }
    playerRef.current?.pause();
    setLook({ layout });
    setProblem(null);
    setResult(null);
    resetSound();
  };

  const changeBoardText = (patch: Partial<BoardText>) =>
    setLook({ boardText: { ...look.boardText, ...patch } });

  usePasteFile(takeFile);

  const removeBackdrop = () => {
    if (backdrop) {
      URL.revokeObjectURL(backdrop.src);
    }
    setBackdrop(null);
  };

  // Switching frames re-fits the clip to the new frame and keeps each
  // text where it was relative to the frame (a title near the top stays
  // near the top).
  const changeFormat = (format: ReelFormat) => {
    if (format === look.format) {
      return;
    }
    const to = FORMATS[format];
    setLook({ format });
    if (clip) {
      setBox(fitBox(clip, format));
    }
    setTexts((current) =>
      current.map((item) => ({
        ...item,
        x: Math.round((item.x / frame.width) * to.width),
        y: Math.round((item.y / frame.height) * to.height),
      }))
    );
  };

  // A first text is a title; later ones are smaller grey lines under it.
  const addText = () => {
    const last = texts.at(-1);
    const first = !last;
    const titleColour = isDark(look.background) ? "#FFFFFF" : "#0A0A0A";
    const item: ReelText = {
      color: first ? titleColour : "#8A8A8A",
      id: crypto.randomUUID(),
      size: first ? 72 : 40,
      text: first ? "Your title" : "craftui.space",
      weight: first ? 500 : 400,
      x: frame.width / 2,
      // The title a fifth of the way down (380px on 9:16).
      y: last
        ? Math.min(
            Math.round(frame.height * 0.9),
            last.y + Math.round(last.size * 1.15 + 36)
          )
        : Math.round(frame.height * 0.2),
    };
    setTexts((current) => [...current, item]);
    setSelectedText(item.id);
  };

  const changeText = (id: string, patch: Partial<ReelText>) =>
    setTexts((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );

  const removeText = (id: string) => {
    setTexts((current) => current.filter((item) => item.id !== id));
    setSelectedText((current) => (current === id ? null : current));
  };

  const scene: ReelSceneProps = {
    backdrop: backdrop
      ? { dim: look.backdropDim, fit: look.backdropFit, src: backdrop.src }
      : null,
    background: look.background,
    box,
    ...soundtrack.sceneAudio,
    device: placement.scene,
    format: look.format,
    muted: !(clip?.hasAudio && soundtrack.mix.clip > 0),
    radius: look.radius,
    shadow: look.shadow,
    src: clip?.src ?? "",
    texts,
  };
  const durationInFrames = framesFor(secondsOf(soundClip), look.fps);

  const boardScene: BoardSceneProps = {
    background: look.boardBackground,
    cues: soundtrack.sceneAudio.cues,
    music: soundtrack.sceneAudio.music,
    sans: fonts.sans,
    serif: fonts.serif,
    sfxVolume: soundtrack.sceneAudio.sfxVolume,
    text: look.boardText,
    tiles: tiles.map((tile) => tile?.src ?? null),
  };

  const runExport = async () => {
    if (!soundClip) {
      return;
    }
    const { duration } = soundClip;
    const controller = new AbortController();
    abort.current = controller;
    playerRef.current?.pause();
    setProblem(null);
    setResult(null);
    setExporting(0);
    const started = performance.now();
    try {
      const blob = grid
        ? await exportBoard({
            fps: look.fps,
            onProgress: setExporting,
            props: { ...boardScene, duration },
            signal: controller.signal,
          })
        : await exportReel({
            fps: look.fps,
            onProgress: setExporting,
            props: { ...scene, duration },
            signal: controller.signal,
          });
      const name = grid ? boardFileName() : reelFileName(look.format);
      saveBlob(blob, name);
      const seconds = Math.max(
        1,
        Math.round((performance.now() - started) / 1000)
      );
      setResult(`Saved ${name} · ${formatBytes(blob.size)} · took ${seconds}s`);
    } catch (error) {
      if (!controller.signal.aborted) {
        setProblem(
          `The export failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    } finally {
      abort.current = null;
      setExporting(null);
    }
  };

  const remove = () => {
    if (clip) {
      URL.revokeObjectURL(clip.src);
    }
    setClip(null);
    setResult(null);
    resetSound();
  };

  return (
    <div
      className="bg-background mx-auto flex w-full max-w-[90rem] flex-col overflow-hidden rounded-xl border"
      ref={shell}
      style={height ? { height } : undefined}
    >
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold">Studio</h1>
          <LayoutToggle
            disabled={exporting !== null}
            layout={look.layout}
            onLayout={changeLayout}
          />
          <FrameToggle
            disabled={exporting !== null}
            format={look.format}
            grid={grid}
            onFormat={changeFormat}
          />
        </div>
        <p
          className="text-muted-foreground ml-auto min-w-0 truncate text-xs"
          role="status"
        >
          {result ?? ""}
        </p>
        <ExportBar
          blocked={live.blocked}
          clip={soundClip}
          exporting={exporting}
          fps={look.fps}
          onCancel={() => abort.current?.abort()}
          onExport={runExport}
          onFps={(fps) => setLook({ fps })}
        />
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-[15.5rem_minmax(0,1fr)_21.5rem]">
        {/* Centre on a phone too: the frame comes first. */}
        <div className="bg-muted/40 flex min-h-0 flex-col items-center gap-3 p-4 lg:order-2 lg:px-6 lg:py-5">
          {grid ? (
            <BoardStage
              clips={tiles}
              durationInFrames={durationInFrames}
              fps={look.fps}
              onChoose={board.chooseTile}
              onFile={loadTile}
              onRemove={board.removeTile}
              playerRef={playerRef}
              scene={boardScene}
            />
          ) : (
            <ReelStage
              box={box}
              clip={clip}
              durationInFrames={durationInFrames}
              fps={look.fps}
              guides={look.guides}
              live={live.stage}
              onBoxChange={setBox}
              onChoose={() => fileInput.current?.click()}
              onDeviceChange={placement.setDeviceBox}
              onFile={takeFile}
              onRemoveText={removeText}
              onSelectText={setSelectedText}
              onTextChange={changeText}
              playerRef={playerRef}
              scene={scene}
              selectedText={selectedText}
            />
          )}
          <div className="flex w-full max-w-xl flex-col gap-2">
            <ReelTransport
              disabled={!soundClip}
              durationInFrames={durationInFrames}
              fps={look.fps}
              key={look.layout}
              playerRef={playerRef}
            />
            {soundClip ? (
              <ReelTimeline
                cues={soundtrack.cues}
                dropAt={soundtrack.music?.dropAt ?? null}
                duration={soundClip.duration}
                fps={look.fps}
                hasMusic={soundtrack.music !== null}
                onDropAt={soundtrack.moveDrop}
                onMove={(id, at) => soundtrack.updateCue(id, { at })}
                onRemove={soundtrack.removeCue}
                onSelect={soundtrack.setSelected}
                playerRef={playerRef}
                selected={soundtrack.selected}
              />
            ) : null}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-6 overflow-y-auto border-t p-4 lg:order-1 lg:border-t-0 lg:border-r">
          {grid ? (
            <BoardPanel
              board={board}
              disabled={exporting !== null}
              look={look}
              onText={changeBoardText}
              problem={problem}
              setLook={setLook}
            />
          ) : (
            <>
              <Group title="Clip">
                {clip ? (
                  <div className="flex flex-col gap-0.5">
                    <p className="truncate text-sm" title={clip.name}>
                      {clip.name}
                    </p>
                    <p className="text-muted-foreground text-xs tabular-nums">
                      {clip.width}×{clip.height} · {formatTime(clip.duration)} ·{" "}
                      {codecLabel(clip.codec)} · {formatBytes(clip.size)}
                    </p>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {reading
                      ? "Reading the video…"
                      : "No video yet. Paste with ⌘V or drop it on the frame. Images dropped or pasted become the background."}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={reading || exporting !== null}
                    onClick={() => fileInput.current?.click()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <Icon icon={Upload04Icon} />
                    {clip ? "Replace" : "Choose a video"}
                  </Button>
                  {clip ? (
                    <Button
                      aria-label="Remove the video"
                      disabled={exporting !== null}
                      onClick={remove}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <Icon icon={Delete02Icon} />
                    </Button>
                  ) : null}
                </div>
                <input
                  accept="video/*,.mov,.mp4,.m4v,.webm,.mkv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) {
                      loadFile(file);
                    }
                  }}
                  ref={fileInput}
                  type="file"
                />
                {problem ? (
                  <p className="text-destructive text-xs" role="alert">
                    {problem}
                  </p>
                ) : null}
              </Group>

              <Group title="Background">
                <BackgroundPicker
                  onChange={(background) => setLook({ background })}
                  value={look.background}
                />
                <BackdropPicker
                  dim={look.backdropDim}
                  disabled={exporting !== null}
                  fit={look.backdropFit}
                  image={backdrop}
                  onAdd={() => imageInput.current?.click()}
                  onDim={(backdropDim) => setLook({ backdropDim })}
                  onFit={(backdropFit) => setLook({ backdropFit })}
                  onRemove={removeBackdrop}
                />
                <input
                  accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) {
                      loadImage(file);
                    }
                  }}
                  ref={imageInput}
                  type="file"
                />
              </Group>

              <DeviceGroup
                components={components}
                disabled={exporting !== null}
                look={look}
                onRecorded={takeFile}
                onReload={() => setReload((count) => count + 1)}
                picked={live.picked}
                setLook={setLook}
              />

              {look.device ? null : (
                <Group title="Clip style">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-4">
                      <Label className="text-xs" htmlFor="reel-radius">
                        Corner radius
                      </Label>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {look.radius}px
                      </span>
                    </div>
                    <Slider
                      id="reel-radius"
                      max={120}
                      min={0}
                      onValueChange={(radius) =>
                        typeof radius === "number" && setLook({ radius })
                      }
                      step={1}
                      value={look.radius}
                    />
                  </div>
                  <SwitchRow
                    checked={look.shadow}
                    id="reel-shadow"
                    label="Shadow"
                    onChange={(shadow) => setLook({ shadow })}
                  />
                </Group>
              )}

              <PositionGroup
                box={placement.positioned}
                guides={look.guides}
                label={placement.label}
                onCentre={placement.centre}
                onFit={placement.fit}
                onGuides={(guides) => setLook({ guides })}
              />

              <TextGroup
                frameWidth={frame.width}
                onAdd={addText}
                onChange={changeText}
                onRemove={removeText}
                onSelect={setSelectedText}
                selected={selectedText}
                texts={texts}
              />
            </>
          )}
        </aside>

        {/* On a short screen this column scrolls on its own; the page never does. */}
        <aside className="flex min-h-0 flex-col border-t lg:order-3 lg:overflow-y-auto lg:border-t-0 lg:border-l">
          <SoundPanel
            autoSync={!grid}
            clip={soundClip}
            fps={look.fps}
            playerRef={playerRef}
            soundtrack={soundtrack}
          />
        </aside>
      </div>
    </div>
  );
};
