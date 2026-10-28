"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ComponentProps,
  KeyboardEvent,
  ReactNode,
  RefObject,
} from "react";

import { cn } from "@/lib/utils";

import { createSphereRenderer } from "./image-sphere-gl";
import type { SphereRenderer } from "./image-sphere-gl";
import { CLUSTER_MAX, SphereScene } from "./image-sphere-scene";

/* ─────────────────────────────────────────────────────────────────────────
 * Image sphere. Your images on a globe you can hold, drawn with WebGL:
 * grab it and fling it, click an image and its group
 * gathers into a pile. Click empty space (or press Escape) to put it back.
 *
 *   image-sphere-scene.ts   the physics: where every card is, frame by frame
 *   image-sphere-gl.ts      draws them: one draw call, one texture atlas
 *   this file               props, input, and the HTML over the canvas: the
 *                           hover tag, group buttons for keyboards, and a
 *                           plain grid for browsers without WebGL2
 *
 * Images load straight into the GPU, so they must be same-origin or served
 * with CORS headers (Unsplash, Cloudinary, imgix, S3/R2 with CORS all are).
 * The frame loop only runs while the sphere is on screen and something is
 * moving; with reduced motion nothing moves by itself, nothing flings, and
 * every change is instant.
 * ───────────────────────────────────────────────────────────────────────── */

export interface ImageSphereItem {
  src: string;
  alt: string;
  /** A group's `id`. Items without one stay on the sphere. */
  group?: string;
}

export interface ImageSphereGroup {
  id: string;
  label: string;
}

export interface ImageSphereProps extends Omit<
  ComponentProps<"section">,
  "children"
> {
  items?: ImageSphereItem[];
  groups?: ImageSphereGroup[];
  /**
   * Cards on the sphere; items repeat round it to fill them. Defaults to
   * 240, or 140 on screens narrower than 40rem. Never fewer than items.
   */
  count?: number;
  /** Turns slowly while nobody's using it and no group is open. */
  autoRotate?: boolean;
  /** The group open at first, by id. */
  defaultGroup?: string | null;
  /**
   * The open group, when the parent decides it (e.g. from scroll). Clicks
   * then only report through `onGroupChange`, and the block's own
   * keyboard buttons are left out: the parent's controls take their place.
   */
  group?: string | null;
  onGroupChange?: (group: string | null) => void;
  /** The keyboard button that closes the open group. */
  allLabel?: string;
  /** The line in the top corner, until the first touch. Pass null to hide it. */
  hint?: ReactNode;
  /** Seconds the globe takes for one full turn when idle. Defaults to 45. */
  turnDuration?: number;
  /** Most images a group's pile shows. Defaults to 12. */
  pileSize?: number;
  /**
   * How curved the pile's images are, from 0 (flat) to 1 (most curved).
   * Defaults to 0.6.
   */
  pileCurve?: number;
}

/** A pile curve of 0–1 as the radius its cards are bent round (globe radii). */
const bendFor = (curve: number) =>
  curve <= 0.01 ? 1000 : 0.45 / Math.min(curve, 1);

/** The props that tune the scene, applied to it as they change. */
const applySettings = (
  scene: SphereScene,
  settings: {
    autoRotate: boolean;
    pileCurve: number;
    pileSize: number;
    turnDuration: number;
  }
) => {
  scene.autoRotate = settings.autoRotate;
  scene.idleSpin = (2 * Math.PI) / Math.max(settings.turnDuration, 1);
  scene.pileMax = Math.max(Math.round(settings.pileSize), 1);
  scene.pileBend = bendFor(settings.pileCurve);
};

/** Pixels a press can wander before it becomes a drag. */
const TAP_SLOP = 6;
/** A release this long after the last move is a stop, not a fling. */
const FLING_WINDOW = 80;

const unsplash = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=360&q=70`;

const photos = (group: string, list: [id: string, alt: string][]) =>
  list.map(([id, alt]): ImageSphereItem => ({ alt, group, src: unsplash(id) }));

const DEFAULT_GROUPS: ImageSphereGroup[] = [
  { id: "architecture", label: "Architecture" },
  { id: "aviation", label: "Aviation" },
  { id: "energy", label: "Energy" },
  { id: "healthcare", label: "Healthcare" },
  { id: "technology", label: "Technology" },
  { id: "products", label: "Products" },
  { id: "design", label: "Design" },
];

const DEFAULT_ITEMS: ImageSphereItem[] = [
  ...photos("architecture", [
    ["1486406146926-c627a92ad1ab", "Glass towers seen from street level"],
    ["1487958449943-2429e8be8625", "White angular building against the sky"],
    ["1449157291145-7efd050a4d0e", "Skyscrapers converging overhead"],
    ["1511818966892-d7d671e672a2", "Office towers under a grey sky"],
    ["1479839672679-a46483c0e7c8", "Stacked white apartment blocks"],
    ["1494526585095-c41746248156", "House lit up at dusk"],
    ["1600585154340-be6161a56a0c", "Modern house and lawn at twilight"],
    ["1600607687939-ce8a6c25118c", "Bright open-plan living room"],
    ["1518005020951-eccb494ad742", "Curving blue and white facade"],
    ["1477959858617-67f85cf4f1df", "City skyline beside a lake"],
    ["1480714378408-67cf0d13bc1b", "Downtown towers at sunset"],
    ["1496568816309-51d7c20e3b21", "City lights at night"],
  ]),
  ...photos("aviation", [
    ["1436491865332-7a61a109cc05", "Aircraft wing above the clouds"],
    ["1529074963764-98f45c47344b", "Airliner in a blue sky"],
    ["1474302770737-173ee21bab63", "Private jet on the tarmac at sunset"],
    ["1569154941061-e231b4725ef1", "Airliner parked at the gate"],
    ["1556388158-158ea5ccacbd", "Plane coming in to land"],
    ["1488085061387-422e29b40080", "Wing at sunset through a cabin window"],
    ["1507812984078-917a274065be", "Wing over a dusk horizon"],
    ["1544016768-982d1554f0b9", "Airliner climbing overhead"],
    ["1530521954074-e64f6810b32d", "Traveller waiting at the airport"],
    ["1517479149777-5f3b1511d5ad", "Wingtip over pink clouds"],
  ]),
  ...photos("energy", [
    ["1509391366360-2e959784a276", "Solar panels in a green field"],
    ["1466611653911-95081537e5b7", "Wind turbines at sunrise"],
    ["1532601224476-15c79f2f7a51", "Wind turbines on rolling hills"],
    ["1497440001374-f26997328c1b", "Solar panels on grass"],
    ["1473341304170-971dccb5ac1e", "Power lines at sunset"],
    ["1508514177221-188b1cf16e9d", "Rows of solar panels under a blue sky"],
    ["1548337138-e87d889cc369", "Offshore wind farm"],
    ["1513828583688-c52646db42da", "Pipes and pumps in a plant room"],
    ["1497435334941-8c899ee9e8e9", "Solar farm from above"],
  ]),
  ...photos("healthcare", [
    ["1532094349884-543bc11b234d", "Glassware on a lab bench"],
    ["1576086213369-97a306d36557", "Cells under a fluorescence microscope"],
    ["1579154204601-01588f351e67", "Empty hospital laboratory"],
    ["1581093450021-4a7360e9a6b5", "Scientists at work in a lab"],
    ["1530026405186-ed1f139313f8", "Anatomical model of a heart"],
    ["1559757175-5700dde675bc", "Model of a brain and a neuron"],
    ["1576091160399-112ba8d25d1d", "Doctor checking a phone"],
    ["1584036561566-baf8f5f1b144", "Illustration of a virus"],
    ["1582719471384-894fbb16e074", "Researcher at a microscope"],
    ["1631549916768-4119b2e5f926", "Blister packs of pills"],
  ]),
  ...photos("technology", [
    ["1518770660439-4636190af475", "Close-up of a circuit board"],
    ["1550751827-4bd374c3f58b", "Glowing circuit traces"],
    ["1526374965328-7f61d4dc18c5", "Green code running down a screen"],
    ["1451187580459-43490279c0fa", "Earth at night from orbit"],
    ["1488590528505-98d2b5aba04b", "Code on a laptop screen"],
    ["1531297484001-80022131f5a1", "Laptop glowing in the dark"],
    ["1555066931-4365d14bab8c", "Code editor on a laptop"],
    ["1550745165-9bc0b252726f", "Retro computers in neon light"],
    ["1563986768609-322da13575f3", "Working on a laptop and phone"],
    ["1517694712202-14dd9538aa97", "Laptop with code on a desk"],
    ["1558494949-ef010cbdcc31", "Server rack cabling"],
  ]),
  ...photos("products", [
    ["1523275335684-37898b6baf30", "White smartwatch"],
    ["1505740420928-5e560c06d30e", "Headphones on yellow"],
    ["1542291026-7eec264c27ff", "Red running shoe"],
    ["1526170375885-4d8ecf77b99f", "Instant camera"],
    ["1572635196237-14b3f281503f", "Black sunglasses"],
    ["1491553895911-0055eca6402d", "Black trainer on white"],
    ["1560343090-f0409e92791a", "Teal leather shoe"],
    ["1546868871-7041f2a55e12", "Smartwatch with a fiery face"],
  ]),
  ...photos("design", [
    ["1586717791821-3f44a563fa4c", "Sketching on a tablet"],
    ["1561070791-2526d30994b5", "Colour swatches and charts"],
    ["1581291518857-4e27b48ff24e", "Sketching wireframes on paper"],
    ["1559028012-481c04fa702d", "Design tool on a large monitor"],
  ]),
];

/**
 * A CSS colour (any syntax the browser knows, oklch included) as 0–1 RGBA,
 * by painting one pixel of it.
 */
const toRgba = (color: string): [number, number, number, number] => {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return [0.5, 0.5, 0.5, 1];
  }
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255, a / 255];
};

/** The colour actually behind an element: the nearest painted background. */
const surfaceBehind = (element: HTMLElement): [number, number, number] => {
  for (
    let node: HTMLElement | null = element;
    node;
    node = node.parentElement
  ) {
    const [r, g, b, a] = toRgba(getComputedStyle(node).backgroundColor);
    if (a > 0.01) {
      return [r, g, b];
    }
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? [0, 0, 0]
    : [1, 1, 1];
};

/* ── Overlay ──────────────────────────────────────────────────────────────
 * Plain HTML over the canvas. The block's frame loop moves these through
 * their refs, so they track the physics without a React render per frame. */

const TAG =
  "rounded-md bg-neutral-600/70 font-mono text-[0.6875rem] leading-snug tracking-[0.08em] text-white uppercase backdrop-blur-md";

/** The group of the card under the mouse. */
const HoverTag = ({
  group,
  tagRef,
}: {
  group?: ImageSphereGroup;
  tagRef: RefObject<HTMLDivElement | null>;
}) => (
  <div
    ref={tagRef}
    aria-hidden
    className={cn(
      TAG,
      "pointer-events-none absolute top-0 left-0 px-2 py-1 whitespace-nowrap transition-opacity duration-150",
      group ? "opacity-100" : "opacity-0"
    )}
  >
    {group?.label}
  </div>
);

/**
 * One button per group, plus one that closes the open group: the way in
 * for keyboards and screen readers, as the canvas can't be tabbed into.
 * Out of sight until one of them has focus.
 */
const GroupButtons = ({
  active,
  allLabel,
  groups,
  onSelect,
}: {
  active: string | null;
  allLabel: string;
  groups: ImageSphereGroup[];
  onSelect: (group: string | null) => void;
}) => (
  <div
    aria-label="Groups"
    className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:inset-x-4 focus-within:bottom-4 focus-within:flex focus-within:flex-wrap focus-within:justify-center focus-within:gap-1.5"
    role="group"
  >
    {[{ id: null, label: allLabel }, ...groups].map((group) => (
      <button
        key={group.id ?? "all"}
        aria-pressed={active === group.id}
        className="border-border bg-background/80 text-muted-foreground hover:text-foreground aria-pressed:border-foreground aria-pressed:bg-foreground aria-pressed:text-background focus-visible:outline-foreground rounded-full border px-3 py-1.5 font-mono text-[0.6875rem] tracking-[0.08em] uppercase backdrop-blur-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
        onClick={() => onSelect(group.id)}
        type="button"
      >
        {group.label}
      </button>
    ))}
  </div>
);

/** Without WebGL2: the open group's images (or the first of all) in a grid. */
const FallbackGrid = ({ items }: { items: ImageSphereItem[] }) => (
  <ul className="absolute inset-0 grid grid-cols-3 content-start gap-2 overflow-y-auto p-4 sm:grid-cols-4 lg:grid-cols-6">
    {items.slice(0, 24).map((item) => (
      <li key={item.src}>
        {/* oxlint-disable-next-line nextjs/no-img-element -- Any URL the host passes, with no next.config image domains to set up. */}
        <img
          alt={item.alt}
          className="bg-muted aspect-[4/3] w-full rounded-md object-cover"
          decoding="async"
          loading="lazy"
          src={item.src}
        />
      </li>
    ))}
  </ul>
);

interface OverlayRefs {
  hoverTag: RefObject<HTMLDivElement | null>;
}

const syncHoverTag = (
  scene: SphereScene,
  refs: OverlayRefs,
  hovered: number
) => {
  const tag = refs.hoverTag.current;
  if (tag && hovered >= 0) {
    const top = scene.y[hovered] - scene.ey[hovered] - 6;
    tag.style.transform = `translate(${scene.x[hovered]}px, ${top}px) translate(-50%, -100%)`;
  }
};

/** The open group, its images, and what's announced when it opens. */
const summarize = (
  groups: ImageSphereGroup[],
  items: ImageSphereItem[],
  active: string | null
) => {
  const activeGroup = groups.find((group) => group.id === active);
  const activeItems = active
    ? items.filter((item) => item.group === active)
    : items;
  const announcement = activeGroup
    ? `${activeGroup.label}: ${activeItems.length} images`
    : "";
  return { activeGroup, activeItems, announcement };
};

export const ImageSphere = ({
  items = DEFAULT_ITEMS,
  groups = DEFAULT_GROUPS,
  count,
  autoRotate = true,
  defaultGroup = null,
  group: openGroup,
  onGroupChange,
  allLabel = "All",
  hint = "Drag to spin · Click an image",
  turnDuration = 45,
  pileSize = CLUSTER_MAX,
  pileCurve = 0.6,
  className,
  onKeyDown,
  ...props
}: ImageSphereProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const refs: OverlayRefs = {
    hoverTag: useRef<HTMLDivElement>(null),
  };
  const refsRef = useRef(refs);
  const sceneRef = useRef<SphereScene | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);

  const controlled = openGroup !== undefined;
  const [ownGroup, setOwnGroup] = useState<string | null>(defaultGroup);
  const active = controlled ? openGroup : ownGroup;
  const [hoverGroup, setHoverGroup] = useState(-1);
  const [fallback, setFallback] = useState(false);
  const [touched, setTouched] = useState(false);

  // Rebuild the scene only when the images or groups really change, not
  // every time a parent passes a new array with the same contents.
  const itemsKey = items
    .map((item) => `${item.src}\n${item.group ?? ""}`)
    .join("\n\n");
  const groupsKey = groups.map((group) => group.id).join("\n");
  const model = useMemo(() => {
    const groupIndex = new Map(groups.map((group, i) => [group.id, i]));
    return {
      groupIndex,
      itemGroups: items.map((item) =>
        item.group === undefined ? -1 : (groupIndex.get(item.group) ?? -1)
      ),
      srcs: items.map((item) => item.src),
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Keyed on contents, see above.
  }, [itemsKey, groupsKey]);

  const select = useCallback(
    (next: string | null) => {
      if (!controlled) {
        setOwnGroup(next);
      }
      setTouched(true);
      onGroupChange?.(next);
    },
    [controlled, onGroupChange]
  );

  const settings = { autoRotate, pileCurve, pileSize, turnDuration };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const selectRef = useRef(select);
  const activeRef = useRef(active);
  const groupsRef = useRef(groups);
  useEffect(() => {
    selectRef.current = select;
    activeRef.current = active;
    groupsRef.current = groups;
  });

  // ── Scene, renderer, images, input and the frame loop ─────────────────
  useEffect(() => {
    const section = sectionRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!section || !stage || !canvas) {
      return;
    }

    const wide = window.matchMedia("(min-width: 40rem)").matches;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const scene = new SphereScene({
      autoRotate,
      count: count ?? (wide ? 240 : 140),
      itemGroups: model.itemGroups,
      reducedMotion: reduced,
    });
    // Settings first: the first pile opens below and must use them.
    applySettings(scene, settingsRef.current);
    sceneRef.current = scene;

    let renderer: SphereRenderer | null = createSphereRenderer(
      canvas,
      scene.itemCount
    );
    if (!renderer) {
      setFallback(true);
      return;
    }
    setFallback(false);

    let disposed = false;
    let raf = 0;
    let last = 0;
    let width = 0;
    let height = 0;
    let onScreen = true;
    let hovered = -1;
    const overlay = refsRef.current;

    // The cards' paper is the theme's muted colour; distance pales them
    // toward whatever is actually painted behind the block.
    const applyColors = () => {
      const probe = probeRef.current;
      if (probe && renderer) {
        const [r, g, b] = toRgba(getComputedStyle(probe).backgroundColor);
        renderer.setColors([r, g, b], surfaceBehind(section));
      }
    };
    applyColors();

    const canRun = () =>
      !disposed &&
      renderer !== null &&
      onScreen &&
      !document.hidden &&
      width > 0;

    // The press in progress, if any (see Pointer below).
    let press: {
      dragging: boolean;
      id: number;
      lastT: number;
      x: number;
      y: number;
    } | null = null;

    const setCursor = () => {
      let cursor = "grab";
      if (press?.dragging) {
        cursor = "grabbing";
      } else if (
        hovered >= 0 &&
        !scene.isMember(hovered) &&
        scene.groupOf(hovered) >= 0
      ) {
        cursor = "pointer";
      }
      stage.style.cursor = cursor;
    };

    // The scene finds the card under the mouse each frame; the hover tag
    // and the cursor follow it.
    const followHover = () => {
      const index = scene.hoveredIndex;
      if (index !== hovered) {
        hovered = index;
        setHoverGroup(
          index >= 0 && !scene.isMember(index) ? scene.groupOf(index) : -1
        );
        setCursor();
      }
    };

    const render = () => {
      renderer?.draw(scene, width, height, scene.globe);
      followHover();
      syncHoverTag(scene, overlay, hovered);
    };

    const frame = (now: number) => {
      // A frame's timestamp can be a little before the time wake() ran.
      const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
      last = now;
      const moving = scene.step(dt);
      render();
      raf = moving && canRun() ? requestAnimationFrame(frame) : 0;
    };

    // Starts the loop if it's stopped; it stops itself once nothing moves.
    const wake = () => {
      if (raf === 0 && canRun()) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    wakeRef.current = wake;

    // ── Images ───────────────────────────────────────────────────────────
    const images: (HTMLImageElement | null)[] = model.srcs.map(() => null);
    const load = (item: number, src: string) => {
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.decoding = "async";
      image.addEventListener("load", () => {
        if (disposed) {
          return;
        }
        images[item] = image;
        const aspect = renderer?.setImage(item, image);
        if (aspect !== undefined) {
          scene.setLoaded(item, aspect);
        }
        wake();
      });
      // A failed image (bad URL, no CORS) stays a blank card.
      image.src = src;
    };
    for (const [item, src] of model.srcs.entries()) {
      load(item, src);
    }

    // ── Size ─────────────────────────────────────────────────────────────
    const resize = () => {
      ({ height, width } = stage.getBoundingClientRect());
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      scene.resize(width, height);
      if (raf === 0 && renderer && width > 0) {
        // Redraw now, so the canvas never shows cleared between frames.
        scene.step(0);
        render();
      }
      wake();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(stage);

    // Only animate on screen, in a visible tab.
    const intersection = new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      wake();
    });
    intersection.observe(stage);
    const onVisibility = () => wake();
    document.addEventListener("visibilitychange", onVisibility);

    // Colours follow the theme.
    const themeObserver = new MutationObserver(() => {
      applyColors();
      if (raf === 0) {
        render();
      }
    });
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["class", "style", "data-theme"],
      attributes: true,
    });

    // ── Pointer ──────────────────────────────────────────────────────────
    const local = (event: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const tap = (x: number, y: number) => {
      const index = scene.hitTest(x, y);
      // A card already in the open pile does nothing.
      if (scene.isMember(index)) {
        return;
      }
      const group = scene.groupOf(index);
      if (index >= 0 && group >= 0) {
        selectRef.current(groupsRef.current[group]?.id ?? null);
      } else if (activeRef.current !== null) {
        selectRef.current(null);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || press) {
        return;
      }
      const { x, y } = local(event);
      press = {
        dragging: false,
        id: event.pointerId,
        lastT: event.timeStamp,
        x,
        y,
      };
      setTouched(true);
      // A hand on the ball stops it; the card under it gives a little.
      scene.hold();
      scene.setPressed(scene.hitTest(x, y));
      wake();
    };

    const onPointerMove = (event: PointerEvent) => {
      const { x, y } = local(event);
      if (press?.id === event.pointerId) {
        if (
          !press.dragging &&
          Math.hypot(x - press.x, y - press.y) > TAP_SLOP
        ) {
          press.dragging = true;
          stage.setPointerCapture(event.pointerId);
          scene.setPressed(-1);
          scene.startDrag(press.x, press.y);
          scene.setPointer(null);
          setCursor();
        }
        if (press.dragging) {
          scene.drag(x, y, (event.timeStamp - press.lastT) / 1000);
          press.lastT = event.timeStamp;
          wake();
        }
        return;
      }
      if (event.pointerType === "mouse") {
        scene.setPointer({ x, y });
        wake();
      }
    };

    const onPointerUp = (event: PointerEvent) => {
      if (press?.id !== event.pointerId) {
        return;
      }
      scene.setPressed(-1);
      if (press.dragging) {
        scene.endDrag(event.timeStamp - press.lastT > FLING_WINDOW);
      } else {
        // A tap only steadied the ball: let the motor take it up again.
        scene.endDrag(true);
        const { x, y } = local(event);
        tap(x, y);
      }
      press = null;
      setCursor();
      wake();
    };

    // The browser took the gesture over (a vertical swipe scrolls the page).
    const onPointerCancel = (event: PointerEvent) => {
      if (press?.id !== event.pointerId) {
        return;
      }
      scene.setPressed(-1);
      scene.endDrag(true);
      press = null;
      setCursor();
      wake();
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && !press) {
        scene.setPointer(null);
        wake();
      }
    };

    // Escape dismisses the hover tag without moving the pointer (it can
    // cover the cards beside it); it comes back on the next move.
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && hovered >= 0) {
        scene.setPointer(null);
        wake();
      }
    };
    window.addEventListener("keydown", onEscape);

    stage.addEventListener("pointerdown", onPointerDown);
    stage.addEventListener("pointermove", onPointerMove);
    stage.addEventListener("pointerup", onPointerUp);
    stage.addEventListener("pointercancel", onPointerCancel);
    stage.addEventListener("pointerleave", onPointerLeave);
    setCursor();

    // ── Context loss (GPU reset, too many contexts) ──────────────────────
    const onLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(raf);
      raf = 0;
      renderer = null;
    };
    const onRestored = () => {
      renderer = createSphereRenderer(canvas, scene.itemCount);
      if (!renderer) {
        setFallback(true);
        return;
      }
      applyColors();
      for (const [item, image] of images.entries()) {
        if (image) {
          renderer.setImage(item, image);
        }
      }
      wake();
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);

    // Open the group that was open before a rebuild (or the default).
    const startGroup = activeRef.current;
    scene.open(
      startGroup === null ? -1 : (model.groupIndex.get(startGroup) ?? -1)
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersection.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stage.removeEventListener("pointerdown", onPointerDown);
      stage.removeEventListener("pointermove", onPointerMove);
      stage.removeEventListener("pointerup", onPointerUp);
      stage.removeEventListener("pointercancel", onPointerCancel);
      stage.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("keydown", onEscape);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      renderer?.dispose();
      sceneRef.current = null;
      wakeRef.current = null;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- autoRotate is applied live below; a rebuild would reload every image.
  }, [model, count]);

  // Motion and pile settings apply live, without rebuilding the scene.
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) {
      applySettings(scene, settingsRef.current);
      wakeRef.current?.();
    }
  }, [autoRotate, turnDuration, pileCurve]);

  // A new pile size re-forms the open pile with that many cards.
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene && scene.pileMax !== Math.max(Math.round(pileSize), 1)) {
      applySettings(scene, settingsRef.current);
      const open = activeRef.current;
      scene.open(-1);
      scene.open(open === null ? -1 : (model.groupIndex.get(open) ?? -1));
      wakeRef.current?.();
    }
  }, [pileSize, model]);

  // Open and close groups in the scene as `active` changes.
  useEffect(() => {
    const scene = sceneRef.current;
    if (scene) {
      scene.open(active === null ? -1 : (model.groupIndex.get(active) ?? -1));
      wakeRef.current?.();
    }
  }, [active, model]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    onKeyDown?.(event);
    if (event.key === "Escape" && active !== null) {
      select(null);
    }
  };

  const { activeGroup, activeItems, announcement } = summarize(
    groups,
    items,
    active
  );

  return (
    <section
      ref={sectionRef}
      aria-label="Images by group"
      className={cn(
        "relative isolate aspect-[4/5] w-full touch-pan-y overflow-hidden select-none sm:aspect-[4/3] lg:aspect-[16/10]",
        className
      )}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {/* Read for the cards' paper colour, so it follows the theme. */}
      <span ref={probeRef} aria-hidden className="bg-muted hidden" />

      <div ref={stageRef} aria-hidden className="absolute inset-0">
        <canvas
          ref={canvasRef}
          className={cn("block size-full", fallback && "hidden")}
        />
      </div>

      {fallback ? (
        <FallbackGrid items={activeItems} />
      ) : (
        <>
          {hint === null ? null : (
            <p
              className={cn(
                "text-muted-foreground pointer-events-none absolute top-4 left-4 font-mono text-[0.6875rem] tracking-[0.08em] uppercase transition-opacity duration-500",
                touched && "opacity-0"
              )}
            >
              {hint}
            </p>
          )}
          <HoverTag
            group={hoverGroup >= 0 ? groups[hoverGroup] : undefined}
            tagRef={refs.hoverTag}
          />
        </>
      )}

      {controlled ? null : (
        <GroupButtons
          active={active}
          allLabel={allLabel}
          groups={groups}
          onSelect={select}
        />
      )}

      {/* The canvas is hidden from screen readers, so the open pile's
          images are listed for them here, by their alt text. */}
      {!fallback && activeGroup ? (
        <ul aria-label={`${activeGroup.label} images`} className="sr-only">
          {activeItems.slice(0, pileSize).map((item) => (
            <li key={item.src}>{item.alt}</li>
          ))}
        </ul>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
};

export default ImageSphere;
