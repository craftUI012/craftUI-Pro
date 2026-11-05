"use client";

/* oxlint-disable func-style, no-inline-comments, max-statements, no-magic-numbers, max-lines-per-function, max-lines, complexity, no-await-in-loop */

import type { Act } from "@/reels/kit/act";
import type { Rect } from "@/reels/kit/measure";
import { Kbd } from "@/reels/kit/parts/Kbd";
import { Stage } from "@/reels/kit/stage";
import { Window } from "@/reels/kit/window";
import type {
  Beat,
  Caption,
  CodeShot,
  EndShot,
  Frame,
  LiveShot,
  Target,
  TerminalShot,
  VideoSpec,
} from "@/reels/spec";
import { PAGE } from "@/reels/spec";
import { groundFor } from "@/reels/video/ground";

import "./reel.css";

// A whole video as one page: every shot of the storyboard played in order
// on one stageshow Stage, 540 × 960 CSS px (filmed at 2x: 1080 × 1920).
//
// Layout (video-director: references/look.md, camera.md, growth.md):
// the ground fills the page; the caption sits in a band on top; the real
// component runs in an iframe of its /preview page, framed as a card, a
// browser window or edge to edge, cropped to its content and centred in
// the media box; the camera pushes into each feature's focus element; a
// ring rides on the element that moves, its value in the label row under
// the frame; the handle sits top right; the end card closes with the sting
// and the ask, then the page loops back to the hook.
//
// While recording, the stage cursor drives Chrome's real mouse through
// window.__reelPointer (the recorder's binding), so the component's own
// hover, press and click handlers run as for a person. Watched in a
// browser, the same pointer events are dispatched instead.

type Theme = "light" | "dark";
type Mode = "live" | "terminal" | "code" | "end";

export type CodeTokens = { color?: string; content: string }[][];

interface Cam {
  s: number;
  x: number;
  y: number;
}

interface S {
  mode: Mode;
  caption: Caption | null;
  captionKey: number;
  captionOut: boolean;
  /** The caption is the hook: its words build in one at a time. */
  captionHook: boolean;
  /** The component's theme now. */
  theme: Theme;
  /** The component's viewport width, CSS px. */
  vw: number;
  /** Stage px per component CSS px. */
  zoom: number;
  /** Frame left edge, and its top inside the media box. */
  x: number;
  fy: number;
  /** Height of the visible part of the component, stage px. */
  fh: number;
  /** Component CSS px hidden above the frame (crop to content). */
  crop: number;
  /** The content runs past the frame's foot (fade crop on). */
  cropped: boolean;
  cam: Cam;
  dragging: boolean;
  sizing: boolean;
  /** The current beat's target, measured from the iframe. */
  hit: Rect;
  mark: { ring: Rect; label: string; key: number } | null;
  keycap: { caps: string[]; key: number } | null;
  /** The media box fades out and back while the frame changes behind it. */
  dip: boolean;
  /** Terminal: characters of the command typed, output lines shown. */
  typed: number;
  lines: number;
  /** Code: the highlight group lit (-1 for none). */
  group: number;
  shot: number;
  /** The component draws its own cursor under the pointer. */
  ownCursor: boolean;
}

type Pointer = (event: {
  type: "move" | "down" | "up";
  x: number;
  y: number;
}) => void;

const host = () =>
  window as unknown as {
    __reel?: { ready?: boolean; fitted?: boolean };
    __reelHold?: boolean;
    __reelPointer?: Pointer;
  };

// Geometry, in stage px.
const MEDIA = PAGE.media;
const BAR = 38;
/** How wide each frame is drawn: a card leaves a margin of ground. */
const FRAME_WIDTH: Record<Frame, number> = {
  bleed: PAGE.width,
  browser: PAGE.width - 48,
  card: Math.round(PAGE.width * 0.88),
};
/** Past a resize, the narrow layout is drawn up to this zoom. */
const ZOOM_MAX = 1.1;
/** The component's viewport height, CSS px: a laptop's. */
const VIEW_H = 900;
const SIZE_PILL = 72;
const FRAME = 1000 / 60;
const IDENTITY: Cam = { s: 1, x: 0, y: 0 };

const KEYCAP: Record<string, string> = {
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  Enter: "↵",
  Escape: "esc",
};

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

const zoomFor = (frame: Frame, vw: number) =>
  Math.min(frame === "bleed" ? 2 : ZOOM_MAX, FRAME_WIDTH[frame] / vw);

const frameEl = () => document.querySelector<HTMLIFrameElement>(".rl-frame");
const frameDoc = () => frameEl()?.contentDocument ?? null;

let pressed = false;
let ownCursor = false;
/** Where the pointer last was in the component, in its CSS px. */
let lastPointer: { x: number; y: number } | null = null;
/** Mirrors S.crop for measuring between renders. */
let currentCrop = 0;

/** Finds a target inside the preview page. */
function resolveTarget(doc: Document, target: Target): HTMLElement | null {
  const [kind, ...rest] = target.split(":");
  const value = rest.join(":");
  if (kind === "aria") {
    return doc.querySelector<HTMLElement>(
      `[aria-label="${CSS.escape(value)}"]`
    );
  }
  if (kind === "css") {
    // The first match that is on screen: a layout can keep hidden copies
    // (a mobile variant, a measuring layer) before the visible one. A
    // group selector (a rail of tiles) takes the member nearest the
    // pointer, so a mark rides along with a sweep; before the pointer has
    // been in the component, the member nearest the middle.
    try {
      const view = doc.defaultView;
      const cx = lastPointer?.x ?? (view?.innerWidth ?? 0) / 2;
      const cy = lastPointer?.y ?? (view?.innerHeight ?? 0) / 2;
      const shown = [...doc.querySelectorAll<HTMLElement>(value)]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && r.height > 0)
        .map(({ el, r }) => ({
          d: Math.hypot(r.x + r.width / 2 - cx, r.y + r.height / 2 - cy),
          el,
        }))
        .toSorted((p, q) => p.d - q.d);
      return shown[0]?.el ?? null;
    } catch {
      return null;
    }
  }
  const wanted = value.trim().toLowerCase();
  const candidates = doc.querySelectorAll<HTMLElement>(
    'button, a, [role="button"], [role="tab"], label, summary'
  );
  for (const el of candidates) {
    if (el.textContent?.trim().toLowerCase().includes(wanted)) {
      return el;
    }
  }
  return null;
}

/** Stage px per component px right now (zoom and camera together). */
function scaleNow(a: Act<S>) {
  const doc = frameDoc();
  const view = a.rect("viewport");
  return {
    k: doc ? view.width / doc.documentElement.clientWidth : 1,
    view,
  };
}

/** An element of the component, in stage px, as drawn. */
function stageRect(a: Act<S>, el: Element): Rect {
  const { k, view } = scaleNow(a);
  const r = el.getBoundingClientRect();
  return {
    height: r.height * k,
    width: r.width * k,
    x: view.x + r.left * k,
    y: view.y + (r.top - currentCrop) * k,
  };
}

/** Every visible match of a css target, as one box in stage px: a
 *  selector that matches each line of a quote frames the whole quote. */
function unionRect(a: Act<S>, target: Target): Rect | null {
  const doc = frameDoc();
  if (!doc) {
    return null;
  }
  const [kind, ...rest] = target.split(":");
  let els: Element[] = [];
  if (kind === "css") {
    try {
      els = [...doc.querySelectorAll(rest.join(":"))];
    } catch {
      els = [];
    }
  } else {
    const one = resolveTarget(doc, target);
    els = one ? [one] : [];
  }
  const vw = doc.documentElement.clientWidth;
  const rects = els
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(
      ({ r }) =>
        r.width > 1 &&
        r.height > 1 &&
        r.right > 0 &&
        r.left < vw &&
        r.bottom > currentCrop &&
        r.top < VIEW_H
    )
    .map(({ el }) => stageRect(a, el));
  if (rects.length === 0) {
    return null;
  }
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { height: bottom - top, width: right - left, x: left, y: top };
}

function measure(a: Act<S>, target: Target) {
  const doc = frameDoc();
  const el = doc ? resolveTarget(doc, target) : null;
  if (!el) {
    throw new Error(`reel: no element for target "${target}"`);
  }
  return { el, rect: stageRect(a, el) };
}

/** The component element under a stage point, and the point in its px. */
function underPoint(a: Act<S>, p: { x: number; y: number }) {
  const doc = frameDoc();
  if (!doc) {
    return null;
  }
  const { k, view } = scaleNow(a);
  const x = (p.x - view.x) / k;
  const y = (p.y - view.y) / k + currentCrop;
  const el = doc.elementFromPoint(x, y);
  return el ? { el, x, y } : null;
}

const POINTER_EVENTS = {
  down: ["pointerdown", "mousedown"],
  move: ["pointermove", "mousemove"],
  up: ["pointerup", "mouseup", "click"],
} as const;

/**
 * Sends the pointer to the component at a stage point. While recording it
 * moves Chrome's real mouse (the recorder's binding), so hover styles and
 * handlers run for real; watched in a browser it dispatches the same
 * pointer and mouse events. Where the component draws its own cursor
 * (cursor: none under the pointer), the stage cursor steps aside.
 */
function pointerAt(
  a: Act<S>,
  type: "move" | "down" | "up",
  p: { x: number; y: number }
) {
  const send = host().__reelPointer;
  if (send) {
    send({ type, x: p.x, y: p.y });
  }
  const hit = underPoint(a, p);
  if (hit) {
    lastPointer = { x: hit.x, y: hit.y };
  }
  if (!send && hit) {
    const win = hit.el.ownerDocument.defaultView;
    const init = {
      bubbles: true,
      button: 0,
      buttons: type === "down" || (pressed && type === "move") ? 1 : 0,
      cancelable: true,
      clientX: hit.x,
      clientY: hit.y,
      isPrimary: true,
      pointerId: 1,
      pointerType: "mouse",
    };
    for (const name of POINTER_EVENTS[type]) {
      const Event = name.startsWith("pointer")
        ? (win?.PointerEvent ?? PointerEvent)
        : (win?.MouseEvent ?? MouseEvent);
      hit.el.dispatchEvent(new Event(name, init));
    }
  }
  if (type === "down") {
    pressed = true;
  } else if (type === "up") {
    pressed = false;
  }
  const own = hit
    ? hit.el.ownerDocument.defaultView?.getComputedStyle(hit.el).cursor ===
      "none"
    : false;
  if (own !== ownCursor) {
    ownCursor = own;
    a.put({ ownCursor: own });
  }
}

/** Moves the stage cursor and the real pointer together, every frame. */
async function glide(a: Act<S>, to: Parameters<Act<S>["move"]>[0]) {
  await a.move(to, { onMove: (at) => pointerAt(a, "move", at) });
}

/** React-controlled inputs need the native setter, then an input event. */
function typeInto(el: HTMLElement, text: string) {
  const input = el as HTMLInputElement;
  const proto = Object.getPrototypeOf(input) as object;
  Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(input, text);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function tween(a: Act<S>, ms: number, fn: (t: number) => void) {
  const frames = Math.max(1, Math.round(ms / FRAME));
  for (let i = 1; i <= frames; i += 1) {
    fn(easeInOutCubic(i / frames));
    await a.wait(FRAME);
  }
}

const read = async (a: Act<S>) => {
  let now: S | null = null;
  await a.set((s) => {
    now = s;
    return {};
  });
  return now as unknown as S;
};

// The component's theme -----------------------------------------------------

let heldTheme: Theme = "dark";

/** Holds the component's theme whatever next-themes sets after hydration. */
function holdTheme(theme: Theme) {
  heldTheme = theme;
  const html = frameDoc()?.documentElement;
  if (!html) {
    return;
  }
  html.classList.toggle("dark", theme === "dark");
  html.classList.toggle("light", theme === "light");
  html.style.colorScheme = theme;
}

async function prepareFrame(frame: HTMLIFrameElement, theme: Theme) {
  const doc = frame.contentDocument;
  if (!doc) {
    return;
  }
  holdTheme(theme);
  new MutationObserver(() => {
    const html = doc.documentElement;
    if (!html.classList.contains(heldTheme)) {
      holdTheme(heldTheme);
    }
  }).observe(doc.documentElement, {
    attributeFilter: ["class"],
    attributes: true,
  });
  // Images decoded before frame 0 (lazy ones off screen never load, so
  // they're left out). No timers or animation frames here: while recording
  // they only run when the recorder steps the clock.
  await Promise.all([
    ...[...doc.images]
      .filter((img) => img.loading !== "lazy")
      .map((img) => img.decode().catch(() => null)),
    doc.fonts?.ready,
    document.fonts?.ready,
  ]);
  host().__reel = { ...host().__reel, ready: true };
}

// Fitting the frame to the content (look.md, Scale) --------------------------

const MEDIA_TAGS = new Set([
  "IMG",
  "SVG",
  "VIDEO",
  "CANVAS",
  "BUTTON",
  "INPUT",
  "TEXTAREA",
  "SELECT",
]);

/** The band of the component that has visible content, in its CSS px. */
function contentBox(doc: Document, vw: number) {
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const el of doc.body.querySelectorAll("*")) {
    if (el.childElementCount > 0 && !MEDIA_TAGS.has(el.tagName.toUpperCase())) {
      continue;
    }
    if (
      !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
    ) {
      continue;
    }
    const r = el.getBoundingClientRect();
    if (
      r.width < 2 ||
      r.height < 2 ||
      r.right <= 0 ||
      r.left >= vw ||
      r.bottom <= 0
    ) {
      continue;
    }
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, Math.min(r.bottom, VIEW_H));
  }
  return Number.isFinite(top) ? { height: bottom - top, top } : null;
}

/** The frame for a viewport width: zoom, position and crop. */
function fitFor(
  frame: Frame,
  vw: number,
  box: { top: number; height: number } | null
) {
  const zoom = zoomFor(frame, vw);
  const bar = frame === "browser" ? BAR : 0;
  const maxBody = MEDIA.height - bar;
  const crop = box ? Math.max(0, box.top - 20) : 0;
  const contentH = box ? (box.height + 40) * zoom : maxBody;
  const fh = Math.min(maxBody, contentH);
  return {
    crop,
    cropped: contentH > maxBody + 1,
    fh,
    fy: (MEDIA.height - (fh + bar)) / 2,
    vw,
    x: (PAGE.width - vw * zoom) / 2,
    zoom,
  };
}

/** Fits the frame to what the component shows now, at this width. */
async function fit(a: Act<S>, frame: Frame, vw: number) {
  // Lay the component out at the width first, then measure it.
  await a.set({ vw, zoom: zoomFor(frame, vw) });
  const doc = frameDoc();
  const next = fitFor(frame, vw, doc ? contentBox(doc, vw) : null);
  currentCrop = next.crop;
  await a.set(next);
}

// The camera (camera.md) -------------------------------------------------------

/** Pushes in on an element so it fills about half the frame's width. */
async function pushIn(a: Act<S>, target: Target) {
  await a.wait(120);
  const r = unionRect(a, target);
  if (!r) {
    return;
  }
  // Fill about half the frame's width, gently: never past 1.6×.
  const s = Math.min(1.6, Math.max(1.15, (0.5 * PAGE.width) / r.width));
  // In the camera's own coordinates (the media box), before any push.
  const fx = r.x + r.width / 2;
  const fy = r.y + r.height / 2 - MEDIA.top;
  const to: Cam = {
    s,
    x: PAGE.width / 2 - s * fx,
    y: MEDIA.height / 2 - s * fy,
  };
  await tween(a, 720, (t) =>
    a.put({
      cam: {
        s: 1 + (to.s - 1) * t,
        x: to.x * t,
        y: to.y * t,
      },
    })
  );
}

async function pullBack(a: Act<S>) {
  const { cam } = await read(a);
  if (cam.s === 1 && cam.x === 0 && cam.y === 0) {
    return;
  }
  await tween(a, 480, (t) =>
    a.put({
      cam: {
        s: cam.s + (1 - cam.s) * t,
        x: cam.x * (1 - t),
        y: cam.y * (1 - t),
      },
    })
  );
  await a.set({ cam: IDENTITY });
}

// Focus mark ------------------------------------------------------------------

let tracking = 0;
const RING_PAD = 8;

/** The ring around a rect, clipped to the visible frame and the media box. */
function ringFor(rect: Rect, view: Rect): Rect {
  const left = Math.max(view.x + 2, 2, rect.x - RING_PAD);
  const top = Math.max(view.y + 2, MEDIA.top + 2, rect.y - RING_PAD);
  const right = Math.min(
    view.x + view.width - 2,
    PAGE.width - 2,
    rect.x + rect.width + RING_PAD
  );
  const bottom = Math.min(
    view.y + view.height - 2,
    MEDIA.top + MEDIA.height - 2,
    rect.y + rect.height + RING_PAD
  );
  return {
    height: Math.max(0, bottom - top),
    width: Math.max(0, right - left),
    x: left,
    y: top,
  };
}

/** Keeps the ring on the element that moves, every frame, until stopped.
 *  The element is looked up each frame: components often replace it (a
 *  keyed AnimatePresence child) when the motion starts. While the pointer
 *  travels (a sweep, a drag) the ring rides on the match under it;
 *  otherwise it frames every visible match together. */
async function track(
  a: Act<S>,
  mark: NonNullable<LiveShot["mark"]>,
  rides: boolean
) {
  tracking += 1;
  const id = tracking;
  let missing = 0;
  const current = () => id === tracking;
  while (current()) {
    const doc = frameDoc();
    const el = doc && rides ? resolveTarget(doc, mark.target) : null;
    let rect: Rect | null = null;
    if (el) {
      rect = stageRect(a, el);
    } else if (!rides) {
      rect = unionRect(a, mark.target);
    }
    if (rect) {
      missing = 0;
      const ring = ringFor(rect, a.rect("viewport"));
      a.put({ mark: { key: id, label: mark.label, ring } });
    } else if ((missing += 1) === 30) {
      // A missing mark is a weaker scene, not a broken video.
      console.warn(`reel mark: nothing matches ${mark.target}`);
    }
    await a.wait(FRAME);
  }
}

const stopTracking = () => {
  tracking += 1;
};

// Shots -----------------------------------------------------------------------

const sameCaption = (a: Caption | null, b: Caption | null | undefined) =>
  JSON.stringify(a) === JSON.stringify(b ?? null);

async function showCaption(
  a: Act<S>,
  caption: Caption | null | undefined,
  hook = false
) {
  const now = await read(a);
  if (sameCaption(now.caption, caption) && now.captionHook === hook) {
    return;
  }
  if (now.caption) {
    await a.set({ captionOut: true });
    await a.wait(160);
  }
  await a.set((s) => ({
    caption: caption ?? null,
    captionHook: hook,
    captionKey: s.captionKey + 1,
    captionOut: false,
  }));
  await a.wait(caption ? 300 : 0);
}

/** Fades the media box out, changes what's behind it, fades it back. */
async function dip(a: Act<S>, change: () => Promise<void> | void) {
  await a.set({ dip: true });
  await a.wait(200);
  await change();
  await a.wait(80);
  await a.set({ dip: false });
  await a.wait(220);
}

async function runBeat(a: Act<S>, frame: Frame, beat: Beat, cause: () => void) {
  switch (beat.do) {
    case "wait": {
      await a.wait(beat.ms);
      return;
    }
    case "hover":
    case "click": {
      const { rect } = measure(a, beat.target);
      await a.set({ hit: rect });
      await glide(a, "hit");
      if (beat.do === "hover") {
        cause();
        await a.wait(beat.ms);
        return;
      }
      await a.wait(220);
      const at = a.center("hit");
      pointerAt(a, "down", at);
      await a.click();
      pointerAt(a, "up", at);
      cause();
      await a.wait(beat.hold);
      return;
    }
    case "type": {
      const { el, rect } = measure(a, beat.target);
      await a.set({ hit: rect });
      await glide(a, "hit");
      const at = a.center("hit");
      pointerAt(a, "down", at);
      await a.click();
      pointerAt(a, "up", at);
      el.focus();
      cause();
      for (let i = 1; i <= beat.text.length; i += 1) {
        typeInto(el, beat.text.slice(0, i));
        await a.wait(45);
      }
      await a.wait(600);
      return;
    }
    case "key": {
      const win = frameEl()?.contentWindow;
      const init = { bubbles: true, cancelable: true, key: beat.key };
      await a.set((s) => ({
        keycap: {
          caps: [KEYCAP[beat.key] ?? beat.key],
          key: (s.keycap?.key ?? 0) + 1,
        },
      }));
      win?.dispatchEvent(new KeyboardEvent("keydown", init));
      win?.dispatchEvent(new KeyboardEvent("keyup", init));
      cause();
      await a.wait(beat.hold);
      return;
    }
    case "sweep": {
      // Glide across the target's row at its height, left to right.
      const { rect } = measure(a, beat.target);
      const view = a.rect("viewport");
      const y = Math.min(
        view.y + view.height - 8,
        Math.max(view.y + 8, rect.y + rect.height / 2)
      );
      await glide(a, { x: view.x + view.width * beat.from, y });
      cause();
      await a.move(
        { x: view.x + view.width * beat.to, y },
        {
          duration: beat.ms,
          onMove: (at) => pointerAt(a, "move", at),
          path: (t, from, to) => ({
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
          }),
        }
      );
      await a.wait(400);
      return;
    }
    case "drag": {
      const { rect } = measure(a, beat.target);
      await a.set({ hit: rect });
      await glide(a, "hit");
      const { k } = scaleNow(a);
      const start = a.center("hit");
      const end = { x: start.x + beat.dx * k, y: start.y };
      await a.wait(200);
      pointerAt(a, "down", start);
      cause();
      await a.drag(end, (at) => pointerAt(a, "move", at), {
        duration: beat.ms,
      });
      pointerAt(a, "up", end);
      await a.wait(500);
      return;
    }
    case "scroll": {
      const win = frameEl()?.contentWindow;
      const doc = frameDoc();
      if (!win || !doc) {
        return;
      }
      const from = win.scrollY;
      const to =
        typeof beat.to === "number"
          ? beat.to
          : (resolveTarget(doc, beat.to)?.getBoundingClientRect().top ?? 0) +
            from -
            24;
      cause();
      await tween(a, beat.ms, (t) => win.scrollTo(0, from + (to - from) * t));
      await a.wait(300);
      return;
    }
    case "resize": {
      // Drag the frame's right edge until the viewport is `to` wide...
      await a.move({ at: "edge", x: 0.5, y: 0.42 });
      await a.wait(200);
      const from = await read(a);
      await a.set({ dragging: true, sizing: true });
      cause();
      const edge = a.center("edge");
      await a.drag(
        { x: edge.x - (from.vw - beat.to) * from.zoom, y: edge.y + 4 },
        (at, origin) => {
          const vw = Math.round(from.vw + (at.x - origin.x) / from.zoom);
          const lo = Math.min(from.vw, beat.to);
          const hi = Math.max(from.vw, beat.to);
          a.put({ vw: Math.max(lo, Math.min(hi, vw)) });
        },
        { cursor: "preserve", duration: beat.ms }
      );
      await a.set({ dragging: false, vw: beat.to });
      await a.wait(300);
      // ...then glide to the centre, zoomed and refitted to the new layout.
      const doc = frameDoc();
      const next = fitFor(
        frame,
        beat.to,
        doc ? contentBox(doc, beat.to) : null
      );
      await tween(a, 800, (t) =>
        a.put({
          fh: from.fh + (next.fh - from.fh) * t,
          fy: from.fy + (next.fy - from.fy) * t,
          x: from.x + (next.x - from.x) * t,
          zoom: from.zoom + (next.zoom - from.zoom) * t,
        })
      );
      currentCrop = next.crop;
      await a.set({ ...next, sizing: false });
      await a.wait(300);
      return;
    }
    default: {
      throw new Error(`reel: unknown beat ${JSON.stringify(beat)}`);
    }
  }
}

/** Beats that move across the component: the camera stays wide for them. */
const WIDE_BEATS = new Set(["sweep", "drag", "resize", "scroll"]);

async function liveShot(
  a: Act<S>,
  shot: LiveShot,
  theme: Theme,
  frame: Frame,
  isHook: boolean
) {
  await pullBack(a);
  const now = await read(a);
  // A new theme, or a width left by a resize: change it behind a dip.
  if (now.mode !== "live" || now.theme !== theme || now.vw !== shot.viewport) {
    await dip(a, async () => {
      holdTheme(theme);
      await a.set({ mode: "live", theme });
      await fit(a, frame, shot.viewport);
    });
  }
  await showCaption(a, shot.caption, isHook);

  // The mark arrives with the cause, and the camera pushes in on it; a
  // beat in when the motion runs on its own.
  const travels = shot.beats.some((b) => WIDE_BEATS.has(b.do));
  const pushes = !isHook && Boolean(shot.mark) && !travels;
  let marked = false;
  const cause = () => {
    if (marked || !shot.mark) {
      return;
    }
    marked = true;
    void track(a, shot.mark, travels);
    if (pushes) {
      void pushIn(a, shot.mark.target);
    }
  };
  if (shot.beats.every((b) => b.do === "wait")) {
    void (async () => {
      await a.wait(400);
      cause();
    })();
  }
  for (const beat of shot.beats) {
    await runBeat(a, frame, beat, cause);
  }
  stopTracking();
  await a.set({ keycap: null, mark: null });
}

async function terminalShot(a: Act<S>, shot: TerminalShot) {
  await pullBack(a);
  await dip(a, () => a.set({ lines: 0, mode: "terminal", typed: 0 }));
  await showCaption(a, shot.caption);
  for (let i = 1; i <= shot.command.length; i += 1) {
    a.put({ typed: i });
    await a.wait(22);
  }
  await a.wait(350);
  for (let i = 1; i <= shot.output.length; i += 1) {
    await a.set({ lines: i });
    await a.wait(300);
  }
  await a.wait(1500);
}

async function codeShot(a: Act<S>, shot: CodeShot) {
  await pullBack(a);
  await dip(a, () => a.set({ group: -1, mode: "code" }));
  await showCaption(a, shot.caption);
  const groups = shot.highlight.length;
  const step = groups > 0 ? shot.ms / (groups + 1) : shot.ms;
  await a.wait(step);
  for (let g = 0; g < groups; g += 1) {
    await a.set({ group: g });
    await a.wait(step);
  }
}

async function endShot(a: Act<S>, shot: EndShot, hook: Caption | null) {
  await pullBack(a);
  await showCaption(a, null);
  await a.set({ mode: "end" });
  await a.wait(shot.ms);
  // Loop: the end card gives way to the hook's frame, so a replay is seamless.
  await a.set((s) => ({
    caption: hook,
    captionHook: false,
    captionKey: s.captionKey + 1,
    mode: "live",
  }));
  await a.wait(600);
}

// The page ----------------------------------------------------------------------

const initialFor = (spec: VideoSpec, theme: Theme): S => {
  const first = spec.shots.find((s): s is LiveShot => s.kind === "live");
  const vw = first?.viewport ?? 768;
  return {
    ...fitFor(spec.look.frame, vw, null),
    cam: IDENTITY,
    caption: null,
    captionHook: false,
    captionKey: 0,
    captionOut: false,
    dip: false,
    dragging: false,
    group: -1,
    hit: { height: 0, width: 0, x: 0, y: 0 },
    keycap: null,
    lines: 0,
    mark: null,
    mode: "live",
    ownCursor: false,
    shot: 0,
    sizing: false,
    theme,
    typed: 0,
  };
};

/** A caption's lines; the hook's words each rise in, 80ms apart. */
function CaptionLines({ caption, hook }: { caption: Caption; hook: boolean }) {
  let word = 0;
  return (
    <>
      {caption.eyebrow && (
        <p className="rl-caption__eyebrow">{caption.eyebrow}</p>
      )}
      {caption.lines.map((line, i) => (
        <p
          key={line}
          className="rl-caption__line"
          style={hook ? undefined : { animationDelay: `${80 + i * 60}ms` }}
        >
          {hook
            ? line.split(" ").map((w, j) => {
                word += 1;
                return (
                  <span
                    key={`${w}-${j}`}
                    className="rl-word"
                    style={{ animationDelay: `${100 + word * 80}ms` }}
                  >
                    {w}{" "}
                  </span>
                );
              })
            : line}
        </p>
      ))}
    </>
  );
}

export function Reel({
  code,
  spec,
}: {
  code: Record<number, CodeTokens>;
  spec: VideoSpec;
}) {
  const firstLive = spec.shots.find((s): s is LiveShot => s.kind === "live");
  const firstTheme = firstLive?.theme ?? spec.theme;
  const { frame } = spec.look;
  const initial = initialFor(spec, firstTheme);
  heldTheme = firstTheme;
  const hook = firstLive?.caption ?? null;

  async function script(a: Act<S>) {
    while (host().__reel?.ready !== true) {
      await a.wait(100);
    }
    // Pre-roll (unfilmed while recording): let the component settle, frame
    // it to its content, then wait for the recorder to start filming.
    await a.wait(400);
    await fit(a, frame, firstLive?.viewport ?? 768);
    host().__reel = { ...host().__reel, fitted: true };
    while (host().__reelHold === true) {
      await a.wait(FRAME);
    }
    for (const [index, shot] of spec.shots.entries()) {
      a.mark(`shot-${index}`);
      await a.set({ shot: index });
      if (shot.kind === "live") {
        await liveShot(
          a,
          shot,
          shot.theme ?? spec.theme,
          frame,
          shot === firstLive
        );
      } else if (shot.kind === "terminal") {
        await terminalShot(a, shot);
      } else if (shot.kind === "code") {
        await codeShot(a, shot);
      } else {
        await endShot(a, shot, hook);
      }
    }
    a.mark("end");
    await a.wait(100);
  }

  const terminal = spec.shots.find(
    (s): s is TerminalShot => s.kind === "terminal"
  );
  const end = spec.shots.find((s): s is EndShot => s.kind === "end");

  return (
    <Stage<S>
      width={PAGE.width}
      height={PAGE.height}
      initial={initial}
      poster={initial}
      script={script}
      play="once"
      theme={spec.theme}
      tokens={{
        "--ss-font": "var(--font-sans), system-ui, sans-serif",
        "--ss-mono": "var(--font-mono), ui-monospace, monospace",
      }}
      cursor={{ at: { x: 470, y: 700 }, idle: 2200, style: "large" }}
      className="rl"
    >
      {(s) => {
        const shot = spec.shots[s.shot];
        const codeView = shot?.kind === "code" ? shot : null;
        const ground = groundFor(spec.look, s.theme);
        const width = s.vw * s.zoom;
        // The label row rides just under the frame's visible foot (camera
        // included), never lower than the safe row.
        const frameFoot =
          MEDIA.top +
          s.cam.y +
          s.cam.s * (s.fy + (frame === "browser" ? BAR : 0) + s.fh);
        const labelTop = Math.min(PAGE.label, frameFoot + 14);
        const viewport = (
          <div
            className="rl-viewport"
            data-target="viewport"
            data-cropped={s.cropped || undefined}
            style={{ height: s.fh, width }}
          >
            <iframe
              title={spec.item}
              src={`/preview/${spec.item}`}
              className="rl-frame"
              tabIndex={-1}
              onLoad={(e) => void prepareFrame(e.currentTarget, firstTheme)}
              style={{
                height: VIEW_H,
                transform: `translateY(${-s.crop * s.zoom}px) scale(${s.zoom})`,
                width: s.vw,
              }}
            />
          </div>
        );
        return (
          <div
            className="rl-ground"
            data-tone={ground.tone}
            data-own-cursor={s.ownCursor || undefined}
          >
            {/* The ground: depth behind the product (look.md) */}
            <div
              className="rl-backdrop"
              data-ground={ground.kind}
              style={ground.style}
            >
              {ground.layers.map((layer) => (
                <i
                  key={layer.key}
                  className={layer.className}
                  style={layer.style}
                />
              ))}
            </div>

            {/* The handle, top right, the whole video (growth.md) */}
            {spec.handle && (
              <span className="rl-handle" style={{ top: PAGE.handle }}>
                {spec.handle}
              </span>
            )}

            {/* Caption band, on top */}
            <div
              className="rl-caption"
              data-out={s.captionOut || undefined}
              style={{ height: PAGE.caption.height, top: PAGE.caption.top }}
            >
              {s.caption && (
                <div
                  key={s.captionKey}
                  className="rl-caption__inner"
                  data-hook={s.captionHook || undefined}
                >
                  <CaptionLines caption={s.caption} hook={s.captionHook} />
                </div>
              )}
            </div>

            {/* Media box: the camera looks at the frame */}
            <div
              className="rl-cameraport"
              data-dip={s.dip || undefined}
              data-end={s.mode === "end" || undefined}
              style={{ height: MEDIA.height, top: MEDIA.top }}
            >
              <div
                className="rl-camera"
                style={{
                  transform: `translate(${s.cam.x}px, ${s.cam.y}px) scale(${s.cam.s})`,
                }}
              >
                {frame === "browser" ? (
                  <Window
                    url={firstLive?.url ?? "yourstartup.com"}
                    urlShape="pill"
                    className="rl-browser"
                    data-dragging={s.dragging || undefined}
                    data-hidden={s.mode !== "live" || undefined}
                    style={{ left: s.x, top: s.fy, width }}
                  >
                    {viewport}
                    <i
                      className="rl-edge"
                      data-target="edge"
                      data-cursor="resize-ew"
                    />
                  </Window>
                ) : (
                  <div
                    className="rl-card"
                    data-frame={frame}
                    data-hidden={s.mode !== "live" || undefined}
                    style={{ left: s.x, top: s.fy, width }}
                  >
                    {viewport}
                    <i
                      className="rl-edge"
                      data-target="edge"
                      data-cursor="resize-ew"
                    />
                  </div>
                )}

                {terminal && (
                  <Window
                    chrome="terminal"
                    title={terminal.path}
                    className="rl-terminal"
                    data-hidden={s.mode !== "terminal" || undefined}
                  >
                    <p className="rl-terminal__line">
                      <span className="rl-terminal__prompt">
                        {terminal.path} ❯
                      </span>{" "}
                      {terminal.command.slice(0, s.typed)}
                      {s.mode === "terminal" &&
                        s.typed < terminal.command.length && (
                          <span className="rl-terminal__caret" />
                        )}
                    </p>
                    {terminal.output.slice(0, s.lines).map((line) => (
                      <p key={line} className="rl-terminal__out">
                        {line}
                      </p>
                    ))}
                  </Window>
                )}

                {codeView && (
                  <div
                    className="rl-code"
                    data-hidden={s.mode !== "code" || undefined}
                  >
                    <p className="rl-code__file">{codeView.file}</p>
                    <pre>
                      {(code[s.shot] ?? []).map((line, n) => {
                        const lit =
                          s.group >= 0 &&
                          codeView.highlight[s.group]?.includes(n + 1);
                        return (
                          <span
                            key={`${n}-${line.map((t) => t.content).join("")}`}
                            className="rl-code__line"
                            data-lit={lit || undefined}
                            data-dim={(s.group >= 0 && !lit) || undefined}
                          >
                            {line.map((t, i) => (
                              <span
                                key={`${i}-${t.content}`}
                                style={{ color: t.color }}
                              >
                                {t.content}
                              </span>
                            ))}
                            {"\n"}
                          </span>
                        );
                      })}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* The live width beside the dragged edge */}
            <span
              className="rl-size"
              data-show={
                (s.sizing && s.x + width + 14 + SIZE_PILL <= PAGE.width - 12) ||
                undefined
              }
              style={{
                left: s.x + width + 14,
                top: MEDIA.top + s.fy + s.fh / 2,
                width: SIZE_PILL,
              }}
            >
              {Math.round(s.vw)}px
            </span>

            {/* Focus mark: a ring on what moves, its value under the frame */}
            {s.mark && (
              <div key={s.mark.key} className="rl-mark">
                <svg
                  className="rl-mark__ring"
                  width={PAGE.width}
                  height={PAGE.height}
                  aria-hidden="true"
                >
                  <rect
                    x={s.mark.ring.x}
                    y={s.mark.ring.y}
                    width={s.mark.ring.width}
                    height={s.mark.ring.height}
                    rx={12}
                    pathLength={1}
                  />
                </svg>
                <span
                  className="rl-mark__label"
                  style={{
                    left: Math.min(
                      Math.max(s.mark.ring.x, 24),
                      PAGE.width - 224
                    ),
                    top: labelTop,
                  }}
                >
                  {s.mark.label}
                </span>
              </div>
            )}

            {/* Keycaps for a key press, on the label row */}
            {s.keycap && (
              <Kbd
                key={s.keycap.key}
                keys={s.keycap.caps}
                className="rl-keycap"
                style={{ top: labelTop }}
              />
            )}

            {/* End card: the sting, craftUI, the tagline, the ask */}
            {end && (
              <div className="rl-end" data-show={s.mode === "end" || undefined}>
                {/* oxlint-disable-next-line next/no-img-element -- a filmed page: the logo must be decoded before frame 0, never lazy. */}
                <img
                  src="/logo/logo-mark-256.png"
                  alt=""
                  width={88}
                  height={88}
                  className="rl-end__logo"
                />
                <p className="rl-end__headline">{end.headline}</p>
                <p className="rl-end__tagline">{end.tagline}</p>
                {end.ask && <p className="rl-end__ask">{end.ask}</p>}
                <p className="rl-end__cta">{end.cta}</p>
                {end.note && <p className="rl-end__note">{end.note}</p>}
              </div>
            )}

            <span
              className="rl-hit"
              data-target="hit"
              data-cursor="pointer"
              style={{
                height: s.hit.height,
                left: s.hit.x,
                top: s.hit.y,
                width: s.hit.width,
              }}
            />
          </div>
        );
      }}
    </Stage>
  );
}
