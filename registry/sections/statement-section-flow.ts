/* ─────────────────────────────────────────────────────────────────────────
 * The parted statement's text engine. No DOM here: the section measures
 * the words, hands their widths in, and moves the spans to where this
 * says, every frame.
 *
 * The image is a circle in the middle of the paragraph, and the words are
 * set round it, line by line, the way water parts round a stone:
 *
 *   wrap      each line is cut where it meets the circle (its true chord,
 *             not a box), with a gap; a piece too narrow to hold a word is
 *             left empty, so on phones lines pass above and below instead
 *   squeeze   a word already on a line resists being pushed off it: the
 *             line condenses (the font's width axis) to keep it, and only
 *             when it can condense no further does the word move down
 *   mass      every word springs to its place, critically damped (no
 *             bounce); words near the circle are stiffer than words far
 *             from it, so a push ripples outward, and a word dropping a
 *             line moves across a little faster than down, on a curve
 *
 * The block is centred on the circle, so as the circle grows the text is
 * pushed up and down, and finally off the edges.
 * ───────────────────────────────────────────────────────────────────────── */

export const WRAP = {
  /** Share of the line height the letters fill, which the wrap hugs. */
  band: 0.78,
  /** Space between the circle and the words, in ems. */
  gap: 0.35,
  /** Space kept clear at the sides, in ems. */
  margin: 0.5,
  /** Narrowest piece of a line beside the circle worth setting, in ems. */
  minPiece: 2.4,
} as const;

export const SQUEEZE = {
  /** Narrowest a line may condense to, as a share of its normal width. */
  min: 0.7,
  /** The same, faked by scaling, for a font with no width axis. */
  synthetic: 0.92,
} as const;

/** Spring stiffness of a word; damping is always critical (2·√k). */
const WORD = {
  /** Vertical moves are this much softer, so a line change curves. */
  drop: 0.8,
  /** How quickly stiffness falls off with distance, in ems. */
  falloff: 6,
  /** Far from the circle: follows a beat later. */
  far: 150,
  /** Right next to the circle: responds first. */
  near: 380,
  /** Width changes. */
  squeeze: 320,
} as const;

/** Spring integration step, small enough for the stiffest spring. */
const STEP = 1 / 120;

export interface FlowMetrics {
  /** Each word's width at its normal width, and fully condensed, in px. */
  natural: number[];
  condensed: number[];
  space: number;
  spaceCondensed: number;
  fontSize: number;
  lineHeight: number;
}

const ALIGN_START = 0;
const ALIGN_END = 1;
const ALIGN_CENTER = 2;

/** A critically damped spring step toward target; writes x, v into out[at], out[at + 1]. */
const critical = (
  x: number,
  v: number,
  target: number,
  stiffness: number,
  dt: number,
  out: Float32Array,
  at: number
) => {
  const damping = 2 * Math.sqrt(stiffness);
  let px = x;
  let pv = v;
  const steps = Math.ceil(dt / STEP);
  const h = steps > 0 ? dt / steps : 0;
  for (let s = 0; s < steps; s += 1) {
    pv += (-stiffness * (px - target) - damping * pv) * h;
    px += pv * h;
  }
  out[at] = px;
  out[at + 1] = pv;
};

export class StatementFlow {
  readonly count: number;
  /** Where each word is drawn now: left edge, top of its line, and width share. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly stretch: Float32Array;
  private readonly vx: Float32Array;
  private readonly vy: Float32Array;
  private readonly vs: Float32Array;
  private readonly tx: Float32Array;
  private readonly ty: Float32Array;
  private readonly ts: Float32Array;
  private readonly stiffness: Float32Array;
  /** The line piece each word sat in last frame (line·2 + side), or -1. */
  private readonly slot: Int32Array;
  private readonly scratch = new Float32Array(2);
  private metrics: FlowMetrics | null = null;
  private minStretch: number = SQUEEZE.min;
  private top = Number.NaN;
  private circle = { r: 0, x: 0, y: 0 };

  reducedMotion = false;

  constructor(count: number) {
    this.count = count;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.stretch = new Float32Array(count).fill(1);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.vs = new Float32Array(count);
    this.tx = new Float32Array(count);
    this.ty = new Float32Array(count);
    this.ts = new Float32Array(count).fill(1);
    this.stiffness = new Float32Array(count).fill(WORD.far);
    this.slot = new Int32Array(count).fill(-1);
  }

  /**
   * The words' measured widths. `minStretch` is the share of normal width
   * the condensed measurement was taken at.
   */
  setMetrics(metrics: FlowMetrics, minStretch: number) {
    this.metrics = metrics;
    this.minStretch = minStretch;
    this.top = Number.NaN;
    this.slot.fill(-1);
  }

  get lineHeight() {
    return this.metrics?.lineHeight ?? 0;
  }

  /** A word's width at a given width share. */
  private widthAt(i: number, stretch: number) {
    const m = this.metrics;
    if (!m) {
      return 0;
    }
    const t = (stretch - this.minStretch) / (1 - this.minStretch);
    return m.condensed[i] + (m.natural[i] - m.condensed[i]) * t;
  }

  private spaceAt(stretch: number) {
    const m = this.metrics;
    if (!m) {
      return 0;
    }
    const t = (stretch - this.minStretch) / (1 - this.minStretch);
    return m.spaceCondensed + (m.space - m.spaceCondensed) * t;
  }

  /**
   * Sets every word's target round a circle of radius r at (cx, cy) in a
   * stage `width` wide. The block is centred on the circle: its height
   * depends on how the words wrap, so it settles in a few passes.
   */
  layout(width: number, cx: number, cy: number, r: number) {
    const m = this.metrics;
    if (!m) {
      return;
    }
    this.circle = { r, x: cx, y: cy };
    let top = Number.isNaN(this.top) ? cy - m.lineHeight * 2 : this.top;
    for (let pass = 0; pass < 4; pass += 1) {
      const lines = this.fill(top, width, false);
      const centred = cy - (lines * m.lineHeight) / 2;
      const settled = Math.abs(centred - top) < 0.5;
      top = centred;
      if (settled) {
        break;
      }
    }
    this.fill(top, width, true);
    this.top = top;
  }

  /** Sets lines from `top` down; with `commit`, writes targets. Returns the line count. */
  private fill(top: number, width: number, commit: boolean) {
    const m = this.metrics;
    if (!m) {
      return 0;
    }
    const em = m.fontSize;
    const lineH = m.lineHeight;
    const left = WRAP.margin * em;
    const right = width - WRAP.margin * em;
    const reach = this.circle.r + WRAP.gap * em;
    const half = (lineH * WRAP.band) / 2;
    const minPiece = WRAP.minPiece * em;
    let k = 0;
    let line = 0;
    while (k < this.count && line < 400) {
      const y = top + line * lineH;
      // Distance from the circle's centre to the nearest edge of the
      // letters' band on this line. The line parts only where the circle
      // reaches the letters themselves (a line it merely passes close to
      // stays whole); the gap is then cut at the half chord plus margin.
      const d = Math.max(0, Math.abs(y + lineH / 2 - this.circle.y) - half);
      const chord = d < this.circle.r ? Math.sqrt(reach * reach - d * d) : 0;
      if (chord === 0) {
        k = this.piece(k, left, right, ALIGN_CENTER, y, line * 2, commit, true);
      } else {
        const leftEnd = this.circle.x - chord;
        const rightStart = this.circle.x + chord;
        if (leftEnd - left >= minPiece) {
          k = this.piece(
            k,
            left,
            leftEnd,
            ALIGN_END,
            y,
            line * 2,
            commit,
            false
          );
        }
        if (k < this.count && right - rightStart >= minPiece) {
          k = this.piece(
            k,
            rightStart,
            right,
            ALIGN_START,
            y,
            line * 2 + 1,
            commit,
            false
          );
        }
      }
      line += 1;
    }
    return line;
  }

  /**
   * Fills one piece of a line, from word k. A word joins if it fits at its
   * normal width, or, if it sat in this same piece last frame, if it fits
   * condensed: words resist being pushed out. Returns the next word.
   */
  private piece(
    k: number,
    from: number,
    to: number,
    align: number,
    y: number,
    slot: number,
    commit: boolean,
    force: boolean
  ) {
    const m = this.metrics;
    if (!m) {
      return k;
    }
    const room = to - from;
    let n = 0;
    let natural = 0;
    let condensed = 0;
    while (k + n < this.count) {
      const i = k + n;
      const nextNatural = natural + (n > 0 ? m.space : 0) + m.natural[i];
      const nextCondensed =
        condensed + (n > 0 ? m.spaceCondensed : 0) + m.condensed[i];
      const fits =
        nextNatural <= room ||
        (this.slot[i] === slot && nextCondensed <= room) ||
        (force && n === 0);
      if (!fits) {
        break;
      }
      natural = nextNatural;
      condensed = nextCondensed;
      n += 1;
    }
    if (n === 0 || !commit) {
      return k + n;
    }

    // Condense just enough to fit, never past the limit.
    let stretch = 1;
    if (natural > room && natural > condensed) {
      const t = (room - condensed) / (natural - condensed);
      stretch = Math.min(
        Math.max(this.minStretch + t * (1 - this.minStretch), this.minStretch),
        1
      );
    }
    let used = -this.spaceAt(stretch);
    for (let j = 0; j < n; j += 1) {
      used += this.spaceAt(stretch) + this.widthAt(k + j, stretch);
    }
    let x = from;
    if (align === ALIGN_END) {
      x = to - used;
    } else if (align === ALIGN_CENTER) {
      x = from + (room - used) / 2;
    }

    const em = m.fontSize;
    for (let j = 0; j < n; j += 1) {
      const i = k + j;
      const w = this.widthAt(i, stretch);
      this.tx[i] = x;
      this.ty[i] = y;
      this.ts[i] = stretch;
      this.slot[i] = slot;
      // Stiffer near the circle, so a push ripples outward.
      const away = Math.max(
        Math.hypot(
          x + w / 2 - this.circle.x,
          y + m.lineHeight / 2 - this.circle.y
        ) - this.circle.r,
        0
      );
      this.stiffness[i] =
        WORD.far +
        (WORD.near - WORD.far) * Math.exp(-away / (WORD.falloff * em));
      x += w + this.spaceAt(stretch);
    }
    return k + n;
  }

  /** Puts every word straight at its target (first frame, resize). */
  snap() {
    this.x.set(this.tx);
    this.y.set(this.ty);
    this.stretch.set(this.ts);
    this.vx.fill(0);
    this.vy.fill(0);
    this.vs.fill(0);
  }

  /** Advances the words' springs. Returns whether any is still moving. */
  step(dt: number) {
    if (this.reducedMotion) {
      this.snap();
      return false;
    }
    let moving = false;
    const out = this.scratch;
    for (let i = 0; i < this.count; i += 1) {
      const k = this.stiffness[i];
      critical(this.x[i], this.vx[i], this.tx[i], k, dt, out, 0);
      [this.x[i], this.vx[i]] = out;
      critical(this.y[i], this.vy[i], this.ty[i], k * WORD.drop, dt, out, 0);
      [this.y[i], this.vy[i]] = out;
      critical(
        this.stretch[i],
        this.vs[i],
        this.ts[i],
        WORD.squeeze,
        dt,
        out,
        0
      );
      [this.stretch[i], this.vs[i]] = out;
      if (
        Math.abs(this.x[i] - this.tx[i]) > 0.2 ||
        Math.abs(this.y[i] - this.ty[i]) > 0.2 ||
        Math.abs(this.vx[i]) + Math.abs(this.vy[i]) > 1 ||
        Math.abs(this.stretch[i] - this.ts[i]) > 1e-3
      ) {
        moving = true;
      } else {
        this.x[i] = this.tx[i];
        this.y[i] = this.ty[i];
        this.stretch[i] = this.ts[i];
        this.vx[i] = 0;
        this.vy[i] = 0;
        this.vs[i] = 0;
      }
    }
    return moving;
  }
}
