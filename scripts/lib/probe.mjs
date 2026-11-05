/* oxlint-disable unicorn/consistent-function-scoping, no-loop-func, complexity, promise/avoid-new -- discover, snap and diff run inside the browser through page.evaluate, so each must be one self-contained function */

// Probes a component's real interactions, for the video director.
//
// Opens /preview/<item> in headless Chrome at the video's viewport, finds
// every element that reacts to input (React handlers read from the DOM
// node's props, plus native buttons, links, fields and roles), groups
// look-alike elements (a rail of 30 tiles is one group), then tries each
// interaction for real on a fresh page: hover, click, a cursor gliding
// across, a drag, and the keys the source handles. After each it measures
// what changed on screen: elements that grew or shrank (with the largest
// scale), faded, appeared or went away, and whether the text changed.
// The idle drift is measured first, so motion that runs on its own isn't
// mistaken for a response.
//
// Real time, not the recorder's virtual clock: this only looks.

import { setTimeout as sleep } from "node:timers/promises";

import { chromium } from "playwright-core";
import sharp from "sharp";

import { CHROME } from "./film.mjs";

const SETTLE_MS = 700;
const MAX_GROUPS = 8;

/* ── In the page ─────────────────────────────────────────────────────── */

/** Lists interactive elements, grouped by look-alike signature. */
const discover = () => {
  const reactProps = (el) => {
    const key = Object.keys(el).find((k) => k.startsWith("__reactProps$"));
    return key ? el[key] : null;
  };
  const NATIVE =
    'button, a[href], input, select, textarea, summary, [role="button"], [role="tab"], [role="slider"], [role="switch"], [role="checkbox"], [role="option"], [tabindex]';
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const groups = new Map();
  for (const el of document.body.querySelectorAll("*")) {
    const props = reactProps(el) ?? {};
    const handlers = Object.keys(props).filter(
      (k) => /^on[A-Z]/.test(k) && typeof props[k] === "function"
    );
    const native = el.matches(NATIVE);
    if (handlers.length === 0 && !native) {
      continue;
    }
    const r = el.getBoundingClientRect();
    const visible =
      r.width > 4 &&
      r.height > 4 &&
      r.right > 0 &&
      r.left < vw &&
      r.bottom > 0 &&
      r.top < vh &&
      getComputedStyle(el).visibility !== "hidden";
    const tag = el.tagName.toLowerCase();
    const dataAttrs = [...el.attributes]
      .map((a) => a.name)
      .filter((n) => n.startsWith("data-") && !n.startsWith("data-state"))
      .toSorted();
    const role = el.getAttribute("role");
    const label = el.getAttribute("aria-label");
    const signature = [tag, role, ...dataAttrs, ...handlers.toSorted()].join(
      "|"
    );
    if (!groups.has(signature)) {
      groups.set(signature, { dataAttrs, handlers, members: [], role, tag });
    }
    groups.get(signature).members.push({ el, label, r, visible });
  }

  // A selector that finds the group (the reel then picks the visible match
  // nearest the centre), or the one element when it stands alone.
  const pathOf = (el) => {
    const parts = [];
    let node = el;
    while (node && node !== document.body && parts.length < 6) {
      const parent = node.parentElement;
      const same = parent
        ? [...parent.children].filter((c) => c.tagName === node.tagName)
        : [];
      const nth =
        same.length > 1 ? `:nth-of-type(${same.indexOf(node) + 1})` : "";
      parts.unshift(`${node.tagName.toLowerCase()}${nth}`);
      node = parent;
    }
    // Reached the body: anchor there. Cut short: a descendant path from
    // where it stopped, which still matches wherever that subtree sits.
    return node === document.body
      ? `body > ${parts.join(" > ")}`
      : parts.join(" > ");
  };
  const selectorFor = (g, rep) => {
    if (
      g.members.length === 1 &&
      rep.label &&
      document.querySelectorAll(`[aria-label="${CSS.escape(rep.label)}"]`)
        .length === 1
    ) {
      return `[aria-label="${CSS.escape(rep.label)}"]`;
    }
    const attrs = g.dataAttrs.map((a) => `[${a}]`).join("");
    const role = g.role ? `[role="${g.role}"]` : "";
    if (attrs || role) {
      return `${g.tag}${role}${attrs}`;
    }
    return g.members.length === 1 ? pathOf(rep.el) : `${pathOf(rep.el)}`;
  };

  // A few look-alike controls with their own labels (Previous and Next)
  // are separate interactions, not one group: split them.
  const before = [...groups.entries()];
  for (const [signature, g] of before) {
    const labels = g.members.map((m) => m.label);
    if (
      g.members.length > 1 &&
      g.members.length <= 4 &&
      labels.every(Boolean) &&
      new Set(labels).size === labels.length
    ) {
      groups.delete(signature);
      for (const m of g.members) {
        groups.set(`${signature}|${m.label}`, { ...g, members: [m] });
      }
    }
  }

  const out = [];
  for (const g of groups.values()) {
    const shown = g.members.filter((m) => m.visible);
    if (shown.length === 0) {
      continue;
    }
    // The member nearest the viewport's centre stands for the group.
    const [rep] = shown.toSorted(
      (a, b) =>
        Math.hypot(
          a.r.x + a.r.width / 2 - vw / 2,
          a.r.y + a.r.height / 2 - vh / 2
        ) -
        Math.hypot(
          b.r.x + b.r.width / 2 - vw / 2,
          b.r.y + b.r.height / 2 - vh / 2
        )
    );
    const text = (rep.el.textContent ?? "").trim().replaceAll(/\s+/g, " ");
    out.push({
      count: g.members.length,
      cursor: getComputedStyle(rep.el).cursor,
      handlers: g.handlers,
      label: rep.label ?? text.slice(0, 48),
      labels: [...new Set(g.members.map((m) => m.label).filter(Boolean))].slice(
        0,
        6
      ),
      rect: {
        height: Math.round(rep.r.height),
        width: Math.round(rep.r.width),
        x: Math.round(rep.r.x),
        y: Math.round(rep.r.y),
      },
      role: g.role,
      selector: selectorFor(g, rep),
      tag: g.tag,
      visibleCount: shown.length,
    });
  }
  return out;
};

/** Remembers every element's box, opacity and the page text. */
const snap = () => {
  const map = new Map();
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    map.set(el, {
      h: r.height,
      o: Number(cs.opacity),
      shown: r.width > 1 && r.height > 1 && cs.visibility !== "hidden",
      w: r.width,
      x: r.x,
      y: r.y,
    });
  }
  window.__probe = { map, text: document.body.textContent };
};

/** What changed since snap(). */
const diff = () => {
  const { map, text } = window.__probe;
  // A short name for an element, so a change says what changed.
  const describe = (el) => {
    const tag = el.tagName.toLowerCase();
    const label = el.getAttribute("aria-label");
    const data = [...el.attributes]
      .map((a) => a.name)
      .find((n) => n.startsWith("data-") && n !== "data-state");
    const cls = (el.getAttribute("class") ?? "")
      .split(/\s+/)
      .find((c) => c && !c.includes(":") && !c.includes("["));
    if (data) {
      return `${tag}[${data}]`;
    }
    if (label) {
      return `${tag} "${label.slice(0, 30)}"`;
    }
    return cls ? `${tag}.${cls}` : tag;
  };
  const grew = new Map();
  let resized = 0;
  let maxScale = 1;
  let faded = 0;
  let moved = 0;
  let appeared = 0;
  let removed = 0;
  const seen = new Set();
  for (const el of document.body.querySelectorAll("*")) {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const shown = r.width > 1 && r.height > 1 && cs.visibility !== "hidden";
    const before = map.get(el);
    if (!before) {
      if (shown) {
        appeared += 1;
      }
      continue;
    }
    seen.add(el);
    if (before.shown && shown && before.w > 4 && before.h > 4) {
      const sw = r.width / before.w;
      const sh = r.height / before.h;
      const scale = Math.max(sw, sh, 1 / sw, 1 / sh);
      if (scale > 1.03 && Math.abs(r.width - before.w) > 2) {
        resized += 1;
        maxScale = Math.max(maxScale, Math.max(sw, sh));
        const name = describe(el);
        const factor =
          Math.max(sw, sh) >= 1 ? Math.max(sw, sh) : Math.min(sw, sh);
        const kept = grew.get(name);
        if (
          !kept ||
          Math.abs(Math.log(factor)) > Math.abs(Math.log(kept.scale))
        ) {
          grew.set(name, { count: (kept?.count ?? 0) + 1, scale: factor });
        } else {
          kept.count += 1;
        }
      }
      if (Math.hypot(r.x - before.x, r.y - before.y) > 4) {
        moved += 1;
      }
    }
    if (Math.abs(Number(cs.opacity) - before.o) > 0.15) {
      faded += 1;
    }
    if (before.shown && !shown) {
      removed += 1;
    }
  }
  for (const [el, before] of map) {
    if (!seen.has(el) && before.shown) {
      removed += 1;
    }
  }
  const now = document.body.textContent;
  const textChanged =
    now.replaceAll(/\s+/g, " ") !== text.replaceAll(/\s+/g, " ");
  const added = now
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !text.includes(l))
    .slice(0, 2)
    .join(" / ")
    .slice(0, 120);
  const sizes = [...grew.entries()]
    .toSorted((a, b) => b[1].count - a[1].count)
    .slice(0, 4)
    .map(([what, g]) => ({
      count: g.count,
      scale: Math.round(g.scale * 100) / 100,
      what,
    }));
  return {
    appeared,
    faded,
    maxScale: Math.round(maxScale * 100) / 100,
    moved,
    newText: added,
    removed,
    resized,
    sizes,
    textChanged,
  };
};

const hydrated = () =>
  [...document.querySelectorAll("button, a, input")].every((b) =>
    Object.keys(b).some((k) => k.startsWith("__react"))
  );

/* ── The component's palette ─────────────────────────────────────────── */

const toHsl = ({ r, g, b }) => {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255];
  const max = Math.max(rr, gg, bb);
  const min = Math.min(rr, gg, bb);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, l, s: 0 };
  }
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rr) {
    h = ((gg - bb) / d) % 6;
  } else if (max === gg) {
    h = (bb - rr) / d + 2;
  } else {
    h = (rr - gg) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, l, s };
};

const hex = ({ r, g, b }) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/**
 * The component's own colours, for the video's Auto ground: up to three
 * distinct, saturated hues weighted by how much of the frame they cover,
 * and whether the component reads as dark.
 */
const samplePalette = async (png) => {
  const { data } = await sharp(png)
    .resize(64, 64, { fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const buckets = new Map();
  let light = 0;
  for (let i = 0; i < data.length; i += 3) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    light += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const key = [r, g, b].map((v) => Math.floor(v / 16)).join("-");
    const bucket = buckets.get(key) ?? { b: 0, g: 0, n: 0, r: 0 };
    bucket.n += 1;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }
  const pixels = data.length / 3;
  const colours = [...buckets.values()]
    .map((c) => {
      const rgb = { b: c.b / c.n, g: c.g / c.n, r: c.r / c.n };
      return { n: c.n, rgb, ...toHsl(rgb) };
    })
    .filter(
      (c) => c.s > 0.18 && c.l > 0.12 && c.l < 0.9 && c.n > pixels * 0.004
    )
    .toSorted((a, b) => b.n * b.s - a.n * a.s);
  const picked = [];
  for (const c of colours) {
    if (picked.every((p) => hueGap(p.h, c.h) > 28)) {
      picked.push(c);
    }
    if (picked.length === 3) {
      break;
    }
  }
  return {
    dark: light / pixels < 0.45,
    palette: picked.map((c) => hex(c.rgb)),
  };
};

/* ── Driving it ──────────────────────────────────────────────────────── */

const open = async (context, url) => {
  const page = await context.newPage();
  await page.goto(url, { timeout: 60_000, waitUntil: "load" });
  await page.waitForFunction(hydrated, null, { timeout: 30_000 });
  // Lazy images off screen never load, so never decode: cap the wait.
  await page.evaluate(() =>
    Promise.race([
      Promise.all(
        [...document.images]
          .filter((i) => i.loading !== "lazy")
          .map((i) => i.decode().catch(() => null))
      ),
      new Promise((resolve) => {
        setTimeout(resolve, 3000);
      }),
    ])
  );
  // Let entrance animations finish before anything is measured.
  await sleep(1500);
  return page;
};

const centre = (rect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2,
});

/** One interaction on a fresh page; returns what changed. */
const trial = async (context, url, act) => {
  const page = await open(context, url);
  try {
    await page.mouse.move(2, 2);
    await sleep(200);
    await page.evaluate(snap);
    await act(page);
    await sleep(SETTLE_MS);
    return await page.evaluate(diff);
  } finally {
    await page.close();
  }
};

const responds = (effect, idle) =>
  effect.textChanged ||
  effect.resized > idle.resized ||
  effect.appeared + effect.removed > idle.appeared + idle.removed + 1 ||
  effect.faded > idle.faded + 1;

const POINTER_MOVE =
  /onPointerMove|onMouseMove|onPointerEnter|onMouseEnter|onPointerOver|onMouseOver/;
const POINTER_DOWN = /onPointerDown|onMouseDown|onDragStart|onTouchStart/;

/**
 * @param {object} o           what to probe
 * @param {string} o.url       the preview page
 * @param {number} o.width     viewport width (the video's)
 * @param {number} o.height    viewport height
 * @param {string[]} o.keys    keys the source handles
 * @returns {Promise<object>}  the interactions found and what each did
 */
export const probe = async ({ url, width, height, keys }) => {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
  });
  try {
    const context = await browser.newContext({
      reducedMotion: "no-preference",
      viewport: { height, width },
    });
    const first = await open(context, url);
    const look = await samplePalette(await first.screenshot({ type: "png" }));
    const found = await first.evaluate(discover);
    const groups = found.slice(0, 40);
    await first.evaluate(snap);
    await sleep(SETTLE_MS);
    const idle = await first.evaluate(diff);
    await first.close();

    // Groups worth trying: anything with pointer or click handlers, or a
    // native control; the biggest groups and pointer-driven ones first.
    const ranked = groups
      .filter((g) => g.handlers.length > 0 || g.tag === "button" || g.role)
      .toSorted(
        (a, b) =>
          Number(POINTER_MOVE.test(b.handlers.join(","))) -
            Number(POINTER_MOVE.test(a.handlers.join(","))) ||
          b.visibleCount - a.visibleCount
      )
      .slice(0, MAX_GROUPS)
      .map((g, i) => ({ ...g, id: `G${i + 1}` }));

    const tests = [];
    const add = async (action, group, run, extra = {}) => {
      const started = Date.now();
      try {
        const effect = await trial(context, url, run);
        tests.push({
          action,
          effect,
          group: group?.id ?? null,
          responds: responds(effect, idle),
          selector: group?.selector ?? null,
          ...extra,
        });
      } catch (error) {
        tests.push({
          action,
          error: String(error.message ?? error).slice(0, 160),
          group: group?.id ?? null,
        });
      }
      console.error(
        `probe: ${action} ${group?.id ?? extra.key ?? ""} ${Date.now() - started}ms`
      );
    };

    // The group a container's pointer handlers serve: the biggest visible
    // group inside it (the dock's tiles inside the section).
    const innerGroup = (g) =>
      ranked
        .filter(
          (o) =>
            o !== g &&
            o.rect.y >= g.rect.y &&
            o.rect.y + o.rect.height <= g.rect.y + g.rect.height + 2
        )
        .toSorted((a, b) => b.visibleCount - a.visibleCount)[0];

    for (const g of ranked) {
      const h = g.handlers.join(",");
      const at = centre(g.rect);
      const isContainer = g.rect.width * g.rect.height > width * height * 0.25;
      if (!isContainer) {
        await add("hover", g, (page) =>
          page.mouse.move(at.x, at.y, { steps: 8 })
        );
        await add("click", g, async (page) => {
          await page.mouse.move(at.x, at.y, { steps: 8 });
          await sleep(250);
          await page.mouse.click(at.x, at.y);
        });
      }
      if (POINTER_MOVE.test(h) || (isContainer && g.handlers.length > 0)) {
        // Glide across the row the pointer drives, left to right.
        const row = innerGroup(g) ?? g;
        const { y } = centre(row.rect);
        await add(
          "sweep",
          g,
          async (page) => {
            await page.mouse.move(width * 0.15, y, { steps: 4 });
            await page.mouse.move(width * 0.85, y, { steps: 40 });
          },
          { across: row.id }
        );
      }
      if (POINTER_DOWN.test(h)) {
        const row = innerGroup(g) ?? g;
        const start = centre(row.rect);
        await add("drag", g, async (page) => {
          await page.mouse.move(start.x, start.y, { steps: 4 });
          await page.mouse.down();
          await page.mouse.move(start.x - 240, start.y, { steps: 24 });
          await page.mouse.up();
        });
      }
    }
    for (const key of keys) {
      await add("key", null, (page) => page.keyboard.press(key), { key });
    }

    return {
      dark: look.dark,
      groups: ranked,
      idle,
      ownCursor: ranked.some((g) => g.cursor === "none"),
      palette: look.palette,
      tests,
      viewport: { height, width },
    };
  } finally {
    await browser.close();
  }
};
