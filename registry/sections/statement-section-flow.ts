/* ─────────────────────────────────────────────────────────────────────────
 * The parted statement's text engine. No DOM here: the section measures
 * the words, hands their widths in, and moves the spans to where this
 * says, every frame.
 *
 * The lines are set once, balanced (as even in length as the line count
 * allows, so no word is left alone) and centred. The image is a circle in
 * the middle of the paragraph, and as it grows the text parts round it the
 * way water parts round a stone. Two ways, by the stage's width:
 *
 *   sideways  (wide) each line is split at its middle; the halves of every
 *             line the circle reaches stop where the line meets it (its
 *             true chord, plus a gap), so the opening traces the circle,
 *             and pushed far enough they slide off the sides. Lines are set
 *             so each half fits beside the circle at rest.
 *   apart     (narrow, where halves beside the circle would hold a word or
 *             two) lines stay whole; the circle opens a gap in the middle
 *             of the block, pushing the lines above up and those below
 *             down, and off the top and bottom.
 *
 * Words fade as they cross the stage's edge. They never change lines and
 * nothing here has momentum: every word's place is a direct, continuous
 * function of the circle's size, so scrolling can never make words jump,
 * reflow or cross each other; the only smoothing is the section's spring.
 * ───────────────────────────────────────────────────────────────────────── */

export const WRAP = {
  /** Share of the line height the letters fill, which the opening hugs. */
  band: 0.78,
  /** Space between the circle and the words, in ems. */
  gap: 0.35,
  /** Space kept clear at the sides, in ems. */
  margin: 0.5,
  /** Widest a line is set, in ems. */
  measure: 16,
  /** Narrowest a half beside the circle may be before lines part vertically, in ems. */
  minHalf: 3.5,
} as const;

/**
 * How gently a line starts to part, in ems. A circle's edge is vertical
 * where it meets a line, so followed exactly, the opening (and the words)
 * would lurch apart the moment it touched, many times faster than the
 * circle grows. `onset` rounds the opening's first growth; `takeUp` lets a
 * half ease into motion instead of starting at full speed. Both are paid
 * back in a slightly wider reach, so words never come nearer the circle.
 */
const EASE = { onset: 0.5, takeUp: 0.6 } as const;

export interface FlowMetrics {
  /** Each word's width, in px. */
  natural: number[];
  space: number;
  fontSize: number;
  lineHeight: number;
}

interface Line {
  /** First word, the first word of the right half, and one past the last. */
  start: number;
  split: number;
  end: number;
  /** Width of each half, in px. With no split, all of it is the left. */
  leftWidth: number;
  rightWidth: number;
}

const smooth = (t: number) => {
  const c = Math.min(Math.max(t, 0), 1);
  return c * c * (3 - 2 * c);
};

/**
 * Half the opening's width on a line, at distance d from the circle's
 * centre (radius `reach`): the circle's chord, with its first growth
 * rounded by `soft` px so it starts at a finite speed.
 */
const openingAt = (reach: number, d: number, soft: number) => {
  const r = reach + soft;
  const overlap = r - d;
  if (overlap <= 0) {
    return 0;
  }
  return Math.max(
    Math.sqrt(overlap * (2 * r - overlap) + soft * soft) - soft,
    0
  );
};

/**
 * How far something pushed by x px moves: nothing until x is positive,
 * then easing up to full speed over `knee` px (smooth, so no sudden start).
 */
const takeUp = (x: number, knee: number) => {
  if (x <= 0) {
    return 0;
  }
  return x < knee ? (x * x) / (2 * knee) : x - knee / 2;
};

export class StatementFlow {
  readonly count: number;
  /** Where each word is drawn (left edge, line top) and how faded it is. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly opacity: Float32Array;
  private metrics: FlowMetrics | null = null;
  private lines: Line[] = [];
  private sideways = true;
  private setFor = "";

  constructor(count: number) {
    this.count = count;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.opacity = new Float32Array(count).fill(1);
  }

  setMetrics(metrics: FlowMetrics) {
    this.metrics = metrics;
    this.setFor = "";
  }

  get lineHeight() {
    return this.metrics?.lineHeight ?? 0;
  }

  /** Width of words a…b−1 set on one line. */
  private span(a: number, b: number) {
    const m = this.metrics;
    if (!m || b <= a) {
      return 0;
    }
    let total = m.space * (b - a - 1);
    for (let i = a; i < b; i += 1) {
      total += m.natural[i];
    }
    return total;
  }

  /** The split of words a…b−1 that leaves its wider half narrowest. */
  private bestSplit(a: number, b: number) {
    let split = a;
    let widest = Number.POSITIVE_INFINITY;
    for (let k = a; k <= b; k += 1) {
      const w = Math.max(this.span(a, k), this.span(k, b));
      if (w < widest) {
        widest = w;
        split = k;
      }
    }
    return { split, widest };
  }

  /** How wide a line of words a…b−1 is, for fitting: its wider half when split. */
  private extent(a: number, b: number) {
    return this.sideways ? this.bestSplit(a, b).widest : this.span(a, b);
  }

  /** Greedy line breaks at most `limit` wide: each line's [start, end). */
  private breakAt(limit: number) {
    const breaks: [number, number][] = [];
    let start = 0;
    while (start < this.count) {
      let end = start + 1;
      while (end < this.count && this.extent(start, end + 1) <= limit) {
        end += 1;
      }
      breaks.push([start, end]);
      start = end;
    }
    return breaks;
  }

  /**
   * Picks the mode, breaks the words into lines no wider than the room,
   * then narrows that width as far as it goes without adding a line, so
   * the lines come out even. Done once per stage width: lines never change
   * while scrolling.
   */
  private setLines(width: number, reserve: number) {
    const m = this.metrics;
    if (!m) {
      return;
    }
    const usable = width - WRAP.margin * 2 * m.fontSize;
    const half = Math.min(
      (usable - reserve) / 2,
      (WRAP.measure * m.fontSize) / 2
    );
    this.sideways = half >= WRAP.minHalf * m.fontSize;
    const room = this.sideways
      ? half
      : Math.min(usable, WRAP.measure * m.fontSize);
    const lineCount = this.breakAt(room).length;
    let lo = 0;
    let hi = room;
    for (let k = 0; k < 24; k += 1) {
      const mid = (lo + hi) / 2;
      if (this.breakAt(mid).length <= lineCount) {
        hi = mid;
      } else {
        lo = mid;
      }
    }
    this.lines = this.breakAt(hi).map(([start, end]) => {
      const split = this.sideways ? this.bestSplit(start, end).split : end;
      return {
        end,
        leftWidth: this.span(start, split),
        rightWidth: this.span(split, end),
        split,
        start,
      };
    });
    this.setFor = `${width}/${reserve}`;
  }

  /**
   * Sets words a…b−1 from x on the line at y, each fading as it crosses
   * the edge of a stage width × height.
   */
  private place(
    a: number,
    b: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    const m = this.metrics;
    if (!m) {
      return;
    }
    // Solid until it crosses the margin; gone once half of it is past the
    // stage's edge.
    const fade = WRAP.margin * m.fontSize;
    const lineH = m.lineHeight;
    const toEdgeY = Math.min(y, height - (y + lineH));
    const vertical = smooth((toEdgeY + lineH / 2) / (fade + lineH / 2));
    let left = x;
    for (let i = a; i < b; i += 1) {
      const w = m.natural[i];
      this.x[i] = left;
      this.y[i] = y;
      const toEdgeX = Math.min(left, width - (left + w));
      this.opacity[i] = Math.min(
        smooth((toEdgeX + w / 2) / (fade + w / 2)),
        vertical
      );
      left += w + m.space;
    }
  }

  /**
   * Places every word round a circle of radius r at (cx, cy), on a stage
   * width × height. The block of lines is centred on the circle.
   * `restRadius` is the circle's size at rest: the lines are set so they
   * part round it without touching the edges.
   */
  layout(
    width: number,
    height: number,
    cx: number,
    cy: number,
    r: number,
    restRadius = 0
  ) {
    const m = this.metrics;
    if (!m) {
      return;
    }
    const em = m.fontSize;
    const reserve = restRadius > 0 ? 2 * (restRadius + WRAP.gap * em) : 0;
    if (this.setFor !== `${width}/${reserve}`) {
      this.setLines(width, reserve);
    }
    const lineH = m.lineHeight;
    const knee = EASE.takeUp * em;
    // Half the knee is paid back here, so a half that has fully taken up
    // sits exactly as far from the circle as it would without easing.
    const reach = r + WRAP.gap * em + knee / 2;
    const top = cy - (this.lines.length * lineH) / 2;

    if (!this.sideways) {
      // The block opens at its middle: the lines above move up, those
      // below move down, just enough to clear the circle.
      const middle = Math.floor(this.lines.length / 2);
      const seam = top + middle * lineH;
      const up = -takeUp(seam - (cy - reach), knee);
      const down = takeUp(cy + reach - seam, knee);
      for (const [n, line] of this.lines.entries()) {
        const y = top + n * lineH + (n < middle ? up : down);
        const x = cx - line.leftWidth / 2;
        this.place(line.start, line.end, x, y, width, height);
      }
      return;
    }

    const half = (lineH * WRAP.band) / 2;
    for (const [n, line] of this.lines.entries()) {
      const y = top + n * lineH;
      // Half the opening's width on this line: where the circle (plus the
      // gap) crosses the nearer edge of the letters. It grows from 0 at the
      // circle's edge, so a line starts parting without a jump.
      const d = Math.max(0, Math.abs(y + lineH / 2 - cy) - half);
      const chord = openingAt(reach, d, EASE.onset * em);

      // Where the halves sit with no circle: the whole line centred.
      const total = line.leftWidth + m.space + line.rightWidth;
      const naturalLeftEnd = cx - total / 2 + line.leftWidth;
      const naturalRightStart = naturalLeftEnd + m.space;

      // Each half is pushed by however far the opening reaches past it,
      // easing into motion; pushed far enough, it slides off the side.
      const leftEnd =
        naturalLeftEnd - takeUp(chord - (cx - naturalLeftEnd), knee);
      this.place(
        line.start,
        line.split,
        leftEnd - line.leftWidth,
        y,
        width,
        height
      );
      const rightStart =
        naturalRightStart + takeUp(chord - (naturalRightStart - cx), knee);
      this.place(line.split, line.end, rightStart, y, width, height);
    }
  }
}
