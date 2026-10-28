/* ─────────────────────────────────────────────────────────────────────────
 * The image sphere's scene: where every thumbnail is, frame by frame, in CSS
 * pixels. No DOM and no WebGL here; the block feeds it input and the
 * renderer (image-sphere-gl.ts) draws what it computes.
 *
 * Everything moves by a physical cause, and nothing changes shape without a
 * force behind it:
 *
 *   the sphere    a weighted globe on a bearing. You hold it by the point
 *                 under your finger (arcball); a fling coasts against
 *                 friction and air drag and stops cleanly; a small motor
 *                 keeps it turning when idle; tilting it swings back to
 *                 rest like a pendulum, with give past the limit.
 *   a card        a poster pasted on a sphere: on the globe, its surface;
 *                 in a pile, an invisible sphere 1.7× the globe's size round
 *                 it. So a card curves with the surface and foreshortens as
 *                 it turns away. Lit from the top left, a blank paper back
 *                 on the far side, paler with distance (opaque).
 *   send-off      before the journey the chosen cards press into the globe
 *                 together, a breath in; then each springs free in turn,
 *                 swelling as it lifts off, and bends from the globe's
 *                 curve to the pile's as it travels.
 *   in flight     a card leaves the ball still carrying the ball's motion,
 *                 so its path curves (a Bézier bowed the way it was
 *                 moving) before it bends into its spot. A spring drives
 *                 it along the curve; it swells as it rises toward the
 *                 viewer mid-flight, stretches with its speed, and is
 *                 tossed a few degrees off straight.
 *   landing       squashes by its speed on impact and settles, nearly
 *                 straight, on top of the cards that landed before it.
 *   focus         the rest of the sphere goes out of focus (a softer
 *                 mipmap), like a camera pulling focus.
 *   touch         pressing gives a card a little under the finger.
 *
 * OPENING A GROUP
 *     0ms   the sphere coasts to a stop, the rest blurs and pales; the
 *           chosen cards press into the globe together (0.86×, darker)
 *   160ms   the outermost card springs free, swelling to its peak a third
 *           of the way out (the rest follow, 35ms apart, inward)
 *   ~600ms  first card lands on the pile's sphere: squash, settle
 *  ~1050ms  the centre card lands last, on top of the pile
 *
 * Every value that sets the feel is in the tables below.
 * ───────────────────────────────────────────────────────────────────────── */

/** The globe: speeds in radians per second, accelerations per second². */
const SPIN = {
  /** Share of the idle speed kept while the pointer is over the block. */
  attention: 0.25,
  /** Air drag, growing with speed squared: big flings shed speed first. */
  drag: 0.08,
  /** Constant bearing friction: what makes a fling stop, not just slow. */
  friction: 0.9,
  /** Idle turning speed, kept up by a gentle motor. */
  idle: 0.14,
  /** Fastest fling. */
  max: 8,
  /** How quickly the motor spins up (or down when a group opens). */
  motorRamp: 0.15,
  /** Damping on the tilt's swing back to rest. */
  tiltDamping: 1.2,
  /** Tilt allowed freely while dragging, in radians from rest. */
  tiltFree: 0.75,
  /** Most extra tilt past the free range, approached elastically. */
  tiltGive: 0.3,
  /** Pull of the weight that returns the tilt to rest. */
  tiltSpring: 14,
} as const;

/** Cards flying to and from a cluster. */
const FLIGHT = {
  /** How far a card rises toward the viewer mid-flight (scale). */
  arc: 0.3,
  /** How far a flight path bows sideways, as a share of its length. */
  bend: 0.28,
  /**
   * Damping on the way into the pile: critically damped (≈ 2·√stiffness),
   * so a card glides in and stops without swinging past its spot.
   */
  enterDamping: 24,
  /** Damping on the way back to the globe: a touch of overshoot. */
  exitDamping: 17,
  /** How the toss tilt settles on the way back to the globe. */
  exitRotationDamping: 11,
  /** Seconds between one card leaving and the next. */
  stagger: 0.035,
  stiffness: 140,
  /** Stretch along the direction of travel, per px/s of speed. */
  stretch: 0.000_25,
  /** Most stretch, however fast. */
  stretchMax: 0.25,
} as const;

const LANDING = {
  /** Squash spring: one soft give on impact, without ringing. */
  damping: 26,
  /** Largest impact squash velocity. */
  max: 0.7,
  /** Impact squash velocity per px/s of landing speed. */
  perSpeed: 1 / 900,
  /** A landed card settles within this many degrees of straight. */
  rest: 0.8,
  /** The toss tilt settling in the pile: no rocking. */
  rotationDamping: 22,
  rotationStiffness: 160,
  stiffness: 320,
  /** A toss tilts a card between tossMin and tossMax degrees. */
  tossMax: 4,
  tossMin: 2,
} as const;

const PRESS = {
  damping: 30,
  /** How much a card gives under a finger. */
  give: 0.045,
  stiffness: 600,
} as const;

/**
 * The moment before the journey: the chosen cards press into the globe
 * together, then spring free one by one.
 */
const SEND_OFF = {
  /** How much darker a pressed card gets. */
  darken: 0.12,
  /** Where in the flight the swell peaks (0–1): early, so it reads as a pop. */
  peakAt: 0.33,
  /** Size while pressed, as a share of normal. */
  press: 0.86,
  /** Seconds to press in, before the first card leaves. */
  pressTime: 0.16,
  /** Swell at the peak (scale), on the way into the pile. */
  swell: 0.35,
} as const;

/** Every card is a poster on a sphere. */
const POSTER = {
  /**
   * How tightly each card in the pile is bent: the radius of the sphere
   * it's curved round, in globe radii. Smaller is more curved; 1 bends it
   * like a piece cut from the globe itself.
   */
  pileBend: 0.75,
  /**
   * Where the pile sits: an invisible sphere round the globe, in globe
   * radii. It sets which way each card faces (bigger is flatter-on).
   */
  pileRadius: 1.7,
} as const;

/** The rest of the sphere while a group is open. */
const FOCUS = {
  /** Mipmap levels of softness. */
  blur: 2.5,
  /** Extra paleness toward the page colour. */
  fog: 0.45,
  rate: 6,
  shrink: 0.2,
} as const;

/** One light, top left and in front; directions in view space (y up). */
const LIGHT = {
  ambient: 0.86,
  diffuse: 0.14,
  /** Brightening where cards turn away at the rim. */
  rim: 0.12,
  x: -0.45,
  y: 0.55,
  z: 0.7,
} as const;

/** Camera distance, in sphere radii: lower is a stronger perspective. */
const CAMERA = 3.2;
/** The globe's resting tilt, so its top shows a little. */
const REST_TILT = 0.22;
/** Most images a cluster shows. */
export const CLUSTER_MAX = 12;
/** Space kept clear round the cluster, inside the block's edges. */
const MARGIN = 24;
/** Spring integration step: small enough to stay stable when stiff. */
const STEP = 1 / 120;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const DEG = Math.PI / 180;

const MODE_SPHERE = 0;
const MODE_MEMBER = 1;
const MODE_RETURNING = 2;

// ── Small math ───────────────────────────────────────────────────────────

type Vec3 = [number, number, number];
/** x, y, z, w. */
type Quat = [number, number, number, number];

const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const length3 = (a: Vec3) => Math.sqrt(dot3(a, a));
const normalize3 = (a: Vec3): Vec3 => {
  const l = length3(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

const quatAxisAngle = (axis: Vec3, angle: number): Quat => {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
};

/** a·b: rotate by b, then by a. */
const quatMul = (a: Quat, b: Quat): Quat => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

const quatNormalize = (q: Quat): Quat => {
  const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
};

const quatRotate = (q: Quat, v: Vec3): Vec3 => {
  const [x, y, z, w] = q;
  // v + 2w(q×v) + 2q×(q×v)
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ];
};

/** The shortest rotation taking unit vector u onto unit vector v. */
const quatFromTo = (u: Vec3, v: Vec3): Quat => {
  const d = dot3(u, v);
  if (d < -0.9999) {
    const axis = normalize3(
      Math.abs(u[0]) < 0.9 ? cross3(u, [1, 0, 0]) : cross3(u, [0, 1, 0])
    );
    return quatAxisAngle(axis, Math.PI);
  }
  const c = cross3(u, v);
  return quatNormalize([c[0], c[1], c[2], 1 + d]);
};

const POLE: Vec3 = [0, 1, 0];

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Frame-rate independent ease toward a target: rate is per second. */
const approach = (value: number, target: number, rate: number, dt: number) =>
  value + (target - value) * (1 - Math.exp(-rate * dt));

/** A stable pseudo-random number in [0, 1) for any input. */
const hash = (n: number) => {
  const s = Math.sin(n * 12.99 + 78.23) * 43_758;
  return s - Math.floor(s);
};

/** Small seeded PRNG (Park–Miller), so placement is the same every load. */
const seeded = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state - 1) / 2_147_483_646;
  };
};

/** Where `spring` leaves its result, so the hot loop allocates nothing. */
const out = { v: 0, x: 0 };

/**
 * Advances a damped spring by `dt` in fixed substeps, into `out`. Snaps to
 * rest within `epsilon`. Returns whether it's still moving.
 */
const spring = (
  x: number,
  v: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
  epsilon: number
) => {
  let px = x;
  let pv = v;
  const steps = Math.ceil(dt / STEP);
  const h = steps > 0 ? dt / steps : 0;
  for (let s = 0; s < steps; s += 1) {
    pv += (-stiffness * (px - target) - damping * pv) * h;
    px += pv * h;
  }
  if (Math.abs(px - target) < epsilon && Math.abs(pv) < epsilon * 10) {
    px = target;
    pv = 0;
  }
  out.x = px;
  out.v = pv;
  return px !== target || pv !== 0;
};

export class SphereScene {
  readonly count: number;
  readonly itemCount: number;

  // ── Output: read by the renderer and the block ─────────────────────────
  readonly item: Uint16Array;
  readonly order: Uint16Array;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly w: Float32Array;
  readonly h: Float32Array;
  /** Each card's 2×2 transform, column-major: (m00, m10, m01, m11). */
  readonly mat: Float32Array;
  /**
   * The sphere each card is a poster on: its unit normal at the card's
   * centre (view space, y up) and its radius in globe radii.
   */
  readonly frame: Float32Array;
  readonly alpha: Float32Array;
  readonly shade: Float32Array;
  readonly rim: Float32Array;
  readonly fog: Float32Array;
  readonly back: Float32Array;
  readonly blur: Float32Array;
  /** Height above the surface, for the contact shadow; 0 for none. */
  readonly elev: Float32Array;
  /** Half extents of the drawn card's bounding box, for hit testing. */
  readonly ex: Float32Array;
  readonly ey: Float32Array;
  /** Per item: how far its image has loaded in. */
  readonly fade: Float32Array;

  // ── On the sphere ──────────────────────────────────────────────────────
  private readonly dir: Float32Array;
  private readonly sphereX: Float32Array;
  private readonly sphereY: Float32Array;
  private readonly sphereSize: Float32Array;
  private readonly facing: Float32Array;
  private readonly sphereShade: Float32Array;
  private readonly sphereRim: Float32Array;
  /** Each card's normal on the globe, and at its spot on the pile's sphere. */
  private readonly sphereN: Float32Array;
  private readonly slotN: Float32Array;
  /** The frame a flight started from, to bend away from. */
  private readonly fromFrame: Float32Array;
  /** How far a chosen card is pressed into the globe before it leaves. */
  private readonly pressIn: Float32Array;
  private readonly depthFog: Float32Array;
  private readonly depth: Float32Array;

  // ── Off the sphere: each card is a body on springs ─────────────────────
  private readonly mode: Uint8Array;
  private readonly bx: Float32Array;
  private readonly by: Float32Array;
  private readonly bvx: Float32Array;
  private readonly bvy: Float32Array;
  private readonly bs: Float32Array;
  private readonly rot: Float32Array;
  private readonly vrot: Float32Array;
  private readonly rotTarget: Float32Array;
  private readonly sq: Float32Array;
  private readonly vsq: Float32Array;
  private readonly sqX: Float32Array;
  private readonly sqY: Float32Array;
  // The current flight: from where, how much it bows, how far along.
  private readonly fromX: Float32Array;
  private readonly fromY: Float32Array;
  private readonly fromS: Float32Array;
  /** Sideways bow of the path, in px (signed). */
  private readonly bend: Float32Array;
  private readonly prog: Float32Array;
  private readonly vprog: Float32Array;
  /** 1 for a real flight (it rises mid-air), 0 for a shuffle in the pile. */
  private readonly lofted: Uint8Array;
  /** How fast each card's spot on the globe is moving, in px/s. */
  private readonly sphereVX: Float32Array;
  private readonly sphereVY: Float32Array;
  /** Seconds before setting off; -1 once launched. */
  private readonly delay: Float32Array;
  private readonly slotX: Float32Array;
  private readonly slotY: Float32Array;
  private readonly slotS: Float32Array;
  /** Order it landed in (later lands on top); -1 while flying. */
  private readonly landedAt: Float32Array;
  private readonly prs: Float32Array;
  private readonly vprs: Float32Array;

  // ── Per item ───────────────────────────────────────────────────────────
  private readonly fadeTarget: Float32Array;
  private readonly aspect: Float32Array;
  private readonly itemGroup: Int16Array;
  private readonly copies: number[][];

  // ── State ──────────────────────────────────────────────────────────────
  private width = 0;
  private height = 0;
  private orientation: Quat = quatAxisAngle([1, 0, 0], REST_TILT);
  private raw: Quat = this.orientation;
  private readonly rest: Vec3 = quatRotate(this.orientation, POLE);
  private omega: Vec3 = [0, 0, 0];
  private motorSpeed = 0;
  private spinDirection = 1;
  private dragging = false;
  private grabbed: Vec3 = [0, 0, 1];
  private dim = 0;
  private hovered = -1;
  private pointer: { x: number; y: number } | null = null;
  private pressed = -1;
  private group = -1;
  private members: number[] = [];
  private landSeq = 0;
  private anchorU = 0.5;
  private anchorV = 0.5;
  // Scratch 2×2 matrix while composing a card's transform.
  private m00 = 1;
  private m01 = 0;
  private m10 = 0;
  private m11 = 1;

  autoRotate: boolean;
  reducedMotion: boolean;
  /** Idle turning speed, radians per second (the block's `turnDuration`). */
  idleSpin: number = SPIN.idle;
  /** Most images a pile shows (the block's `pileSize`). */
  pileMax = CLUSTER_MAX;
  /** Radius each pile card is bent round (from the block's `pileCurve`). */
  pileBend: number = POSTER.pileBend;

  constructor({
    autoRotate,
    count,
    itemGroups,
    reducedMotion,
  }: {
    autoRotate: boolean;
    count: number;
    /** Each item's group index, or -1 for none. */
    itemGroups: number[];
    reducedMotion: boolean;
  }) {
    this.itemCount = itemGroups.length;
    this.count = Math.max(count, this.itemCount);
    this.autoRotate = autoRotate;
    this.reducedMotion = reducedMotion;
    this.motorSpeed = autoRotate && !reducedMotion ? this.idleSpin : 0;

    const n = this.count;
    const f32 = () => new Float32Array(n);
    this.item = new Uint16Array(n);
    this.order = new Uint16Array(n);
    this.x = f32();
    this.y = f32();
    this.w = f32();
    this.h = f32();
    this.mat = new Float32Array(n * 4);
    this.frame = new Float32Array(n * 4);
    this.fromFrame = new Float32Array(n * 4);
    this.sphereN = new Float32Array(n * 3);
    this.slotN = new Float32Array(n * 3);
    this.pressIn = f32();
    this.alpha = f32().fill(1);
    this.shade = f32();
    this.rim = f32();
    this.fog = f32();
    this.back = f32();
    this.blur = f32();
    this.elev = f32();
    this.ex = f32();
    this.ey = f32();
    this.dir = new Float32Array(n * 3);
    this.sphereX = f32();
    this.sphereY = f32();
    this.sphereSize = f32();
    this.facing = f32();
    this.sphereShade = f32();
    this.sphereRim = f32();
    this.depthFog = f32();
    this.depth = f32();
    this.mode = new Uint8Array(n);
    this.bx = f32();
    this.by = f32();
    this.bvx = f32();
    this.bvy = f32();
    this.bs = f32();
    this.rot = f32();
    this.vrot = f32();
    this.rotTarget = f32();
    this.sq = f32();
    this.vsq = f32();
    this.sqX = f32().fill(1);
    this.sqY = f32();
    this.fromX = f32();
    this.fromY = f32();
    this.fromS = f32();
    this.bend = f32();
    this.prog = f32();
    this.vprog = f32();
    this.lofted = new Uint8Array(n);
    this.sphereVX = f32();
    this.sphereVY = f32();
    this.delay = f32().fill(-1);
    this.slotX = f32();
    this.slotY = f32();
    this.slotS = f32();
    this.landedAt = f32().fill(-1);
    this.prs = f32();
    this.vprs = f32();

    this.fade = new Float32Array(this.itemCount);
    this.fadeTarget = new Float32Array(this.itemCount);
    this.aspect = new Float32Array(this.itemCount).fill(4 / 3);
    this.itemGroup = Int16Array.from(itemGroups);
    this.copies = Array.from({ length: this.itemCount }, () => []);

    // Fibonacci lattice: even spacing, no poles bunching up.
    for (let i = 0; i < n; i += 1) {
      const y = 1 - ((i + 0.5) / n) * 2;
      const r = Math.sqrt(1 - y * y);
      const theta = i * GOLDEN_ANGLE;
      this.dir[i * 3] = Math.cos(theta) * r;
      this.dir[i * 3 + 1] = y;
      this.dir[i * 3 + 2] = Math.sin(theta) * r;
      this.order[i] = i;
    }
    this.place();
  }

  /**
   * Puts items on the sphere's points: one copy of each at random, then
   * every further copy on the free point furthest from that item's other
   * copies, so two copies of an image are as far apart as they can be.
   */
  private place() {
    const n = this.count;
    const taken = new Uint8Array(n);
    const random = seeded(7);
    const shuffled = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const put = (item: number, slot: number) => {
      taken[slot] = 1;
      this.item[slot] = item;
      this.copies[item].push(slot);
    };
    for (let item = 0; item < this.itemCount; item += 1) {
      put(item, shuffled[item]);
    }
    for (let k = this.itemCount; k < n; k += 1) {
      const item = k % this.itemCount;
      let best = -1;
      let bestNear = Number.POSITIVE_INFINITY;
      for (const slot of shuffled) {
        if (taken[slot] === 0) {
          // How close the nearest other copy is: lower is better.
          let near = -1;
          for (const other of this.copies[item]) {
            near = Math.max(near, this.cosine(slot, other));
          }
          if (near < bestNear) {
            bestNear = near;
            best = slot;
          }
        }
      }
      put(item, best);
    }
  }

  private cosine(a: number, b: number) {
    const d = this.dir;
    return (
      d[a * 3] * d[b * 3] +
      d[a * 3 + 1] * d[b * 3 + 1] +
      d[a * 3 + 2] * d[b * 3 + 2]
    );
  }

  resize(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.layout(false);
  }

  /** Called when an item's image has loaded and been placed in the atlas. */
  setLoaded(item: number, aspect: number) {
    this.aspect[item] = aspect;
    this.fadeTarget[item] = 1;
    if (this.reducedMotion) {
      this.fade[item] = 1;
    }
    if (this.group >= 0 && this.itemGroup[item] === this.group) {
      this.layout(false);
    }
  }

  // ── Geometry ───────────────────────────────────────────────────────────

  private get radius() {
    return Math.min(this.width, this.height) * 0.4;
  }

  private get centerX() {
    return this.width / 2;
  }

  private get centerY() {
    return this.height / 2;
  }

  /** A card's base size on the sphere: about half the gap between points. */
  private get baseSize() {
    return this.radius * Math.sqrt((4 * Math.PI) / this.count) * 0.52;
  }

  // ── The globe: grab, drag, fling ───────────────────────────────────────

  /** A screen point on the ball (arcball), or on a sheet beyond its rim. */
  private toBall(px: number, py: number): Vec3 {
    const r = this.radius * 1.1;
    const x = (px - this.centerX) / r;
    const y = -(py - this.centerY) / r;
    const r2 = x * x + y * y;
    const z = r2 <= 0.5 ? Math.sqrt(1 - r2) : 0.5 / Math.sqrt(r2);
    return normalize3([x, y, z]);
  }

  /** A hand on the ball stops it. */
  hold() {
    this.omega = [0, 0, 0];
    this.motorSpeed = 0;
  }

  startDrag(px: number, py: number) {
    this.hold();
    this.dragging = true;
    this.grabbed = this.toBall(px, py);
    this.raw = this.orientation;
  }

  /** Turns the ball so the grabbed point follows the pointer. */
  drag(px: number, py: number, dt: number) {
    const to = this.toBall(px, py);
    const delta = quatFromTo(this.grabbed, to);
    this.grabbed = to;
    this.raw = quatNormalize(quatMul(delta, this.raw));
    this.orientation = this.withGive(this.raw);

    const s = Math.sqrt(Math.max(1 - delta[3] * delta[3], 0));
    if (dt > 0 && s > 1e-6) {
      const angle = 2 * Math.acos(clamp(delta[3], -1, 1));
      const rate = angle / dt / s;
      this.omega = [
        this.omega[0] * 0.5 + delta[0] * rate * 0.5,
        this.omega[1] * 0.5 + delta[1] * rate * 0.5,
        this.omega[2] * 0.5 + delta[2] * rate * 0.5,
      ];
    }
  }

  /** Tilt past the free range gives elastically, like overscroll. */
  private withGive(q: Quat): Quat {
    const pole = quatRotate(q, POLE);
    const angle = Math.acos(clamp(dot3(pole, this.rest), -1, 1));
    if (angle <= SPIN.tiltFree) {
      return q;
    }
    const over = angle - SPIN.tiltFree;
    const kept = SPIN.tiltGive * (1 - Math.exp(-over / SPIN.tiltGive));
    const axis = normalize3(cross3(pole, this.rest));
    return quatNormalize(quatMul(quatAxisAngle(axis, over - kept), q));
  }

  /** Lets go; `stale` when the pointer had stopped (no fling). */
  endDrag(stale: boolean) {
    this.dragging = false;
    if (stale || this.reducedMotion) {
      this.omega = [0, 0, 0];
    }
    const speed = length3(this.omega);
    if (speed > SPIN.max) {
      const k = SPIN.max / speed;
      this.omega = [this.omega[0] * k, this.omega[1] * k, this.omega[2] * k];
    }
    // The motor picks up the spin about the axis, in the flung direction.
    const along = dot3(this.omega, quatRotate(this.orientation, POLE));
    if (Math.abs(along) > 0.02) {
      this.spinDirection = Math.sign(along);
    }
    this.motorSpeed = Math.min(Math.abs(along), this.idleSpeed);
    if (this.reducedMotion) {
      this.orientation = this.upright(this.orientation);
    }
  }

  private get idleSpeed() {
    if (!this.autoRotate || this.reducedMotion || this.group >= 0) {
      return 0;
    }
    // Someone looking closely: the turntable slows so cards stay put.
    return this.pointer ? this.idleSpin * SPIN.attention : this.idleSpin;
  }

  /** The same orientation with its axis put back at rest. */
  private upright(q: Quat): Quat {
    const fix = quatFromTo(quatRotate(q, POLE), this.rest);
    return quatNormalize(quatMul(fix, q));
  }

  /**
   * Friction, drag, the motor and the weight's swing. Returns whether the
   * globe is still moving.
   */
  private stepSpin(dt: number) {
    const target = this.idleSpeed;
    if (this.dragging) {
      return true;
    }
    this.motorSpeed =
      this.motorSpeed < target
        ? Math.min(this.motorSpeed + SPIN.motorRamp * dt, target)
        : Math.max(this.motorSpeed - SPIN.motorRamp * dt, target);

    const pole = quatRotate(this.orientation, POLE);
    const omega = this.reducedMotion ? this.omega : this.swing(pole, dt);

    // Friction and drag act on whatever the motor isn't driving.
    const motor = this.motorSpeed * this.spinDirection;
    const rel: Vec3 = [
      omega[0] - pole[0] * motor,
      omega[1] - pole[1] * motor,
      omega[2] - pole[2] * motor,
    ];
    const relSpeed = length3(rel);
    const slowed = Math.max(
      relSpeed - (SPIN.friction + SPIN.drag * relSpeed * relSpeed) * dt,
      0
    );
    const k = relSpeed > 0 ? slowed / relSpeed : 0;
    this.omega = [
      pole[0] * motor + rel[0] * k,
      pole[1] * motor + rel[1] * k,
      pole[2] * motor + rel[2] * k,
    ];

    const speed = length3(this.omega);
    if (speed > 1e-6) {
      const turn = quatAxisAngle(
        [this.omega[0] / speed, this.omega[1] / speed, this.omega[2] / speed],
        speed * dt
      );
      this.orientation = quatNormalize(quatMul(turn, this.orientation));
    }
    return speed > 1e-4 || this.motorSpeed !== target;
  }

  /** The weight pulls the axis back toward rest; its swing is damped. */
  private swing(pole: Vec3, dt: number): Vec3 {
    const pull = cross3(pole, this.rest);
    const along = dot3(this.omega, pole);
    const keep = Math.exp(-SPIN.tiltDamping * dt);
    const kick = SPIN.tiltSpring * dt;
    return [
      pole[0] * along +
        (this.omega[0] - pole[0] * along) * keep +
        pull[0] * kick,
      pole[1] * along +
        (this.omega[1] - pole[1] * along) * keep +
        pull[1] * kick,
      pole[2] * along +
        (this.omega[2] - pole[2] * along) * keep +
        pull[2] * kick,
    ];
  }

  // ── Touch ──────────────────────────────────────────────────────────────

  /**
   * Where the mouse is over the block, or null when it's away. The card
   * under it is found again every frame, as the globe turns under a still
   * pointer.
   */
  setPointer(point: { x: number; y: number } | null) {
    this.pointer = point;
  }

  get hoveredIndex() {
    return this.hovered;
  }

  setPressed(index: number) {
    this.pressed = index;
  }

  /** The front-most card under a point, or -1. */
  hitTest(px: number, py: number) {
    for (let k = this.count - 1; k >= 0; k -= 1) {
      const i = this.order[k];
      if (
        this.back[i] < 0.5 &&
        this.fog[i] < 0.85 &&
        Math.abs(px - this.x[i]) <= this.ex[i] &&
        Math.abs(py - this.y[i]) <= this.ey[i]
      ) {
        return i;
      }
    }
    return -1;
  }

  groupOf(index: number) {
    return index < 0 ? -1 : this.itemGroup[this.item[index]];
  }

  isMember(index: number) {
    return index >= 0 && this.mode[index] === MODE_MEMBER;
  }

  // ── Groups ─────────────────────────────────────────────────────────────

  /** Opens a group (by index), or closes the open one with -1. */
  open(group: number) {
    if (group === this.group) {
      return;
    }
    for (const i of this.members) {
      this.sendHome(i);
    }
    this.members = [];
    this.group = group;
    if (group < 0) {
      return;
    }

    // One copy of each of the group's items: the one facing the viewer
    // most, so every card flies out from somewhere visible.
    for (let item = 0; item < this.itemCount; item += 1) {
      if (
        this.itemGroup[item] === group &&
        this.members.length < this.pileMax
      ) {
        let best = -1;
        for (const i of this.copies[item]) {
          if (best < 0 || this.facing[i] > this.facing[best]) {
            best = i;
          }
        }
        this.members.push(best);
      }
    }

    // The cluster gathers where its cards already are on screen.
    let sumX = 0;
    let sumY = 0;
    for (const i of this.members) {
      sumX += this.x[i];
      sumY += this.y[i];
    }
    const m = Math.max(this.members.length, 1);
    this.anchorU = sumX / m / Math.max(this.width, 1);
    this.anchorV = sumY / m / Math.max(this.height, 1);
    this.layout(true);

    for (const [j, i] of this.members.entries()) {
      const inFlight = this.mode[i] !== MODE_SPHERE;
      this.launchFrom(i);
      if (inFlight || this.reducedMotion) {
        // Already in the air (on its way home): it turns round now,
        // carrying the motion it has.
        this.delay[i] = -1;
        this.startMove(i, this.bvx[i], this.bvy[i], true);
      } else {
        // Outer cards leave first, so the biggest, centre card lands
        // last, on top of the pile.
        const turn = this.members.length - 1 - j;
        this.delay[i] = SEND_OFF.pressTime + turn * FLIGHT.stagger;
      }
    }
  }

  /** Turns a card into a member of the cluster, from wherever it's drawn now. */
  private launchFrom(i: number) {
    if (this.mode[i] === MODE_SPHERE) {
      this.bx[i] = this.sphereX[i];
      this.by[i] = this.sphereY[i];
      this.bs[i] = this.sphereSize[i];
      this.bvx[i] = 0;
      this.bvy[i] = 0;
    }
    this.mode[i] = MODE_MEMBER;
    this.landedAt[i] = -1;
  }

  /** A pile card heads back to its spot on the globe, straightening as it goes. */
  private sendHome(i: number) {
    this.mode[i] = MODE_RETURNING;
    this.landedAt[i] = -1;
    this.delay[i] = -1;
    this.rotTarget[i] = 0;
    // It lifts off the pile at rest; the curve bows the way the globe turns.
    this.startMove(i, 0, 0, true);
  }

  /** Where card i is headed: its spot in the pile, or on the turning globe. */
  private targetX(i: number) {
    return this.mode[i] === MODE_RETURNING ? this.sphereX[i] : this.slotX[i];
  }

  private targetY(i: number) {
    return this.mode[i] === MODE_RETURNING ? this.sphereY[i] : this.slotY[i];
  }

  /**
   * Starts a flight from where card i is now. Its path bows toward the way
   * it was already moving (`carriedX/Y`, px/s), as a thrown thing keeps its
   * sideways motion; with none, toward the way the globe last turned. A
   * shuffle within the pile (`lofted` false) goes straight and stays low.
   */
  private startMove(
    i: number,
    carriedX: number,
    carriedY: number,
    lofted: boolean
  ) {
    this.fromX[i] = this.bx[i];
    this.fromY[i] = this.by[i];
    this.fromS[i] = this.bs[i];
    this.fromFrame.set(this.frame.subarray(i * 4, i * 4 + 4), i * 4);
    this.prog[i] = 0;
    this.vprog[i] = 0;
    this.lofted[i] = lofted ? 1 : 0;
    const dx = this.targetX(i) - this.bx[i];
    const dy = this.targetY(i) - this.by[i];
    const length = Math.hypot(dx, dy);
    if (!lofted || length < 1) {
      this.bend[i] = 0;
      return;
    }
    // Sideways: the chord's normal, and which way the card was going on it.
    const sideways = (carriedY * dx - carriedX * dy) / length;
    const carried =
      Math.hypot(carriedX, carriedY) > 5 ? Math.sign(sideways) : 0;
    this.bend[i] = (carried || this.spinDirection) * FLIGHT.bend * length;
  }

  /** A few degrees off straight, either way. */
  private toss(i: number) {
    if (this.reducedMotion) {
      return 0;
    }
    const side = hash(i + this.landSeq) < 0.5 ? -1 : 1;
    const spread = LANDING.tossMax - LANDING.tossMin;
    return (
      side * (LANDING.tossMin + hash(i * 7.31 + this.landSeq) * spread) * DEG
    );
  }

  /**
   * Lays out the cluster round its anchor, scaled down until it fits
   * inside the block's margins. Runs again on resize and as images load.
   */
  private layout(stagger: boolean) {
    if (this.group < 0 || this.width === 0) {
      return;
    }
    const pile = this.members;
    const rings = Math.sqrt(Math.max(pile.length - 1, 0));
    const room = Math.min(this.width / 2 - 16, (this.height - MARGIN * 2) / 2);
    // Sunflower spacing: card j sits at spread·√j from the centre.
    const spread = 0.62;
    const size = Math.min(
      Math.min(this.width, this.height) * 0.22,
      room / (spread * rings + 0.65)
    );
    const reach = size * spread * rings + size * 0.65;
    const cx = clamp(
      this.anchorU * this.width,
      reach + 16,
      this.width - reach - 16
    );
    const cy = clamp(
      this.anchorV * this.height,
      MARGIN + reach,
      this.height - MARGIN - reach
    );

    for (const [j, i] of pile.entries()) {
      const angle = j * GOLDEN_ANGLE - Math.PI / 2;
      const r = size * spread * Math.sqrt(j);
      // The first card is the biggest; they shrink a little outward.
      const s = size * (j === 0 ? 1.2 : 1 - Math.min(j * 0.025, 0.25));
      this.slotX[i] = cx + Math.cos(angle) * r;
      this.slotY[i] = cy + Math.sin(angle) * r;
      this.slotS[i] = s;
      this.normalAt(this.slotX[i], this.slotY[i], POSTER.pileRadius, i);
      if (stagger) {
        this.rotTarget[i] = this.toss(i);
      } else if (this.prog[i] === 1 && this.vprog[i] === 0) {
        // A settled card whose spot moved (resize, an image's shape
        // loaded) slides over, low and straight; one still flying just
        // follows its moving end point.
        const moved =
          Math.hypot(this.slotX[i] - this.bx[i], this.slotY[i] - this.by[i]) >
            0.5 || Math.abs(s - this.bs[i]) > 0.5;
        if (moved) {
          this.startMove(i, 0, 0, false);
        }
      }
    }
  }

  /**
   * Where the pile's sphere (radius in globe radii) is under screen point
   * (px, py), as seen by the camera: its unit normal there, into slotN.
   */
  private normalAt(px: number, py: number, radius: number, i: number) {
    const unit = this.radius || 1;
    const x = (px - this.centerX) / unit;
    const y = -(py - this.centerY) / unit;
    // A point on the sphere seen at (x, y) is (x·k, y·k, C·(1 − k)); the
    // nearer of the two solutions of |p| = radius.
    const c2 = CAMERA * CAMERA;
    const a = x * x + y * y + c2;
    const disc = Math.max(c2 * c2 - a * (c2 - radius * radius), 0);
    const k = (c2 - Math.sqrt(disc)) / a;
    const pz = CAMERA * (1 - k);
    const length = Math.hypot(x * k, y * k, pz) || 1;
    this.slotN[i * 3] = (x * k) / length;
    this.slotN[i * 3 + 1] = (y * k) / length;
    this.slotN[i * 3 + 2] = pz / length;
  }

  // ── Frame ──────────────────────────────────────────────────────────────

  /** Focus pull and load fades. */
  private stepFocus(dt: number) {
    const dimTarget = this.group >= 0 ? 1 : 0;
    // Reduced motion: instant (an infinite rate would be NaN when dt is 0).
    this.dim = this.reducedMotion
      ? dimTarget
      : approach(this.dim, dimTarget, FOCUS.rate, dt);
    if (Math.abs(this.dim - dimTarget) < 1e-3) {
      this.dim = dimTarget;
    }
    let moving = this.dim !== dimTarget;
    for (let k = 0; k < this.itemCount; k += 1) {
      const target = this.fadeTarget[k];
      if (this.fade[k] !== target) {
        this.fade[k] = Math.min(this.fade[k] + dt / 0.6, target);
        moving = true;
      }
    }
    return moving;
  }

  /** Where card i sits on the ball now, how it faces, how it's lit. */
  private project(i: number, r: number[], dt: number) {
    const dx = this.dir[i * 3];
    const dy = this.dir[i * 3 + 1];
    const dz = this.dir[i * 3 + 2];
    const nx = r[0] * dx + r[1] * dy + r[2] * dz;
    const ny = r[3] * dx + r[4] * dy + r[5] * dz;
    const nz = r[6] * dx + r[7] * dy + r[8] * dz;
    const perspective = CAMERA / (CAMERA - nz);
    const sx = this.centerX + nx * this.radius * perspective;
    const sy = this.centerY - ny * this.radius * perspective;
    if (dt > 0) {
      this.sphereVX[i] = (sx - this.sphereX[i]) / dt;
      this.sphereVY[i] = (sy - this.sphereY[i]) / dt;
    }
    this.sphereX[i] = sx;
    this.sphereY[i] = sy;
    this.sphereN[i * 3] = nx;
    this.sphereN[i * 3 + 1] = ny;
    this.sphereN[i * 3 + 2] = nz;

    // Facing the camera itself, not just the screen: the visible rim of a
    // ball seen in perspective is a little in front of its equator.
    const facing =
      (CAMERA * nz - 1) / Math.sqrt(CAMERA * CAMERA - 2 * CAMERA * nz + 1);
    this.facing[i] = facing;

    const shrink =
      this.mode[i] === MODE_SPHERE ? 1 - FOCUS.shrink * this.dim : 1;
    this.sphereSize[i] = this.baseSize * perspective * shrink;
    const light = nx * LIGHT.x + ny * LIGHT.y + nz * LIGHT.z;
    this.sphereShade[i] = LIGHT.ambient + LIGHT.diffuse * light;
    this.sphereRim[i] = facing > 0 ? (1 - facing) ** 3 * LIGHT.rim : 0;
    // Paler with distance; a card seen from behind (through the gaps) is
    // nearly gone, so the far side reads as depth, not clutter.
    const away = smoothstep(0.08, -0.08, facing);
    this.depthFog[i] = 0.5 * (1 - (nz + 1) / 2) ** 1.5 + 0.47 * away;
  }

  /** Size share of a card pressed in for its send-off (1 when not). */
  private pressed01(i: number) {
    return 1 - (1 - SEND_OFF.press) * smoothstep(0, 1, this.pressIn[i]);
  }

  /** Press give (a spring), and the send-off press (a short ramp). */
  private stepTouch(i: number, dt: number) {
    const holdTarget =
      this.mode[i] === MODE_MEMBER && this.delay[i] > 0 && !this.reducedMotion
        ? 1
        : 0;
    let held = false;
    if (this.pressIn[i] !== holdTarget) {
      const ramp = dt / SEND_OFF.pressTime;
      this.pressIn[i] =
        holdTarget > this.pressIn[i]
          ? Math.min(this.pressIn[i] + ramp, 1)
          : Math.max(this.pressIn[i] - ramp, 0);
      held = true;
    }
    const pressTarget = i === this.pressed ? 1 : 0;
    if (this.prs[i] === pressTarget && this.vprs[i] === 0) {
      return held;
    }
    const moving = spring(
      this.prs[i],
      this.vprs[i],
      pressTarget,
      PRESS.stiffness,
      PRESS.damping,
      dt,
      1e-3
    );
    this.prs[i] = out.x;
    this.vprs[i] = out.v;
    return moving || held;
  }

  /** A card off the sphere: flies its curve to its spot, lands, settles. */
  private stepBody(i: number, dt: number) {
    if (this.delay[i] > 0) {
      // Still waiting its turn: it rides the sphere, pressed in.
      this.delay[i] -= dt;
      this.bx[i] = this.sphereX[i];
      this.by[i] = this.sphereY[i];
      this.bs[i] = this.sphereSize[i] * this.pressed01(i);
      if (this.delay[i] <= 0) {
        // It leaves the ball carrying the ball's motion: that sets the bow.
        this.delay[i] = -1;
        this.startMove(i, this.sphereVX[i], this.sphereVY[i], true);
      }
      return true;
    }
    const home = this.mode[i] === MODE_RETURNING;
    const tx = this.targetX(i);
    const ty = this.targetY(i);
    const ts = home ? this.sphereSize[i] : this.slotS[i];

    if (this.reducedMotion) {
      this.prog[i] = 1;
      this.vprog[i] = 0;
    } else {
      spring(
        this.prog[i],
        this.vprog[i],
        1,
        FLIGHT.stiffness,
        home ? FLIGHT.exitDamping : FLIGHT.enterDamping,
        dt,
        1e-3
      );
      this.prog[i] = out.x;
      this.vprog[i] = out.v;
    }
    this.fly(i, tx, ty);
    this.bs[i] = this.fromS[i] + (ts - this.fromS[i]) * this.prog[i];
    this.settle(i, dt);

    const arrived = this.prog[i] === 1 && this.vprog[i] === 0;
    if (home) {
      if (arrived) {
        this.mode[i] = MODE_SPHERE;
        this.rot[i] = 0;
        this.sq[i] = 0;
        this.vsq[i] = 0;
      }
      return true;
    }
    if (
      this.landedAt[i] < 0 &&
      Math.hypot(tx - this.bx[i], ty - this.by[i]) < this.slotS[i] * 0.3
    ) {
      this.land(i, Math.hypot(this.bvx[i], this.bvy[i]));
    }
    return !arrived || this.vrot[i] !== 0 || this.vsq[i] !== 0;
  }

  /**
   * Card i's place on its flight path: a quadratic Bézier from where it
   * started to its (possibly moving) end point, its middle control point
   * pushed sideways by the bow. Also its velocity: the curve's tangent
   * times how fast the spring is moving it along.
   */
  private fly(i: number, tx: number, ty: number) {
    const t = this.prog[i];
    const x0 = this.fromX[i];
    const y0 = this.fromY[i];
    const dx = tx - x0;
    const dy = ty - y0;
    const length = Math.hypot(dx, dy) || 1;
    const cx = x0 + dx / 2 - (dy / length) * this.bend[i];
    const cy = y0 + dy / 2 + (dx / length) * this.bend[i];
    const u = 1 - t;
    this.bx[i] = u * u * x0 + 2 * u * t * cx + t * t * tx;
    this.by[i] = u * u * y0 + 2 * u * t * cy + t * t * ty;
    const v = this.vprog[i];
    this.bvx[i] = (2 * u * (cx - x0) + 2 * t * (tx - cx)) * v;
    this.bvy[i] = (2 * u * (cy - y0) + 2 * t * (ty - cy)) * v;
  }

  /** The toss tilt and the landing squash, both springs. */
  private settle(i: number, dt: number) {
    if (this.reducedMotion) {
      this.rot[i] = 0;
      return;
    }
    spring(
      this.rot[i],
      this.vrot[i],
      this.rotTarget[i],
      LANDING.rotationStiffness,
      this.mode[i] === MODE_RETURNING
        ? FLIGHT.exitRotationDamping
        : LANDING.rotationDamping,
      dt,
      1e-4
    );
    this.rot[i] = out.x;
    this.vrot[i] = out.v;
    spring(
      this.sq[i],
      this.vsq[i],
      0,
      LANDING.stiffness,
      LANDING.damping,
      dt,
      1e-4
    );
    this.sq[i] = out.x;
    this.vsq[i] = out.v;
  }

  /** Impact: a squash along the way it was moving, and a nearly straight rest. */
  private land(i: number, speed: number) {
    this.landSeq += 1;
    this.landedAt[i] = this.landSeq;
    if (!this.reducedMotion && speed > 1) {
      this.sqX[i] = this.bvx[i] / speed;
      this.sqY[i] = this.bvy[i] / speed;
      this.vsq[i] = Math.min(speed * LANDING.perSpeed, LANDING.max);
    }
    const settle = (hash(i * 3.7 + this.landSeq) * 2 - 1) * LANDING.rest * DEG;
    this.rotTarget[i] = this.reducedMotion ? 0 : settle;
  }

  /** Multiplies the scratch matrix by a scale of `along` on axis a, `across` off it. */
  private axisScale(along: number, across: number, ax: number, ay: number) {
    const d = along - across;
    const a00 = across + d * ax * ax;
    const a01 = d * ax * ay;
    const a11 = across + d * ay * ay;
    const { m00, m01, m10, m11 } = this;
    this.m00 = a00 * m00 + a01 * m10;
    this.m01 = a00 * m01 + a01 * m11;
    this.m10 = a01 * m00 + a11 * m10;
    this.m11 = a01 * m01 + a11 * m11;
  }

  private rotate(angle: number) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const { m00, m01, m10, m11 } = this;
    this.m00 = c * m00 - s * m10;
    this.m01 = c * m01 - s * m11;
    this.m10 = s * m00 + c * m10;
    this.m11 = s * m01 + c * m11;
  }

  /** How far a body is off the sphere, 0 (on it) to 1 (clear of it). */
  private freedom(i: number) {
    if (this.mode[i] === MODE_SPHERE || this.delay[i] > 0) {
      return 0;
    }
    const away = Math.hypot(
      this.bx[i] - this.sphereX[i],
      this.by[i] - this.sphereY[i]
    );
    const byDistance = smoothstep(0, this.baseSize * 3, away);
    // On the way into the pile it's clear of the globe as soon as it's
    // under way, however close its old spot is on screen: a card from the
    // far side starts inside the globe's outline, maybe right by its slot.
    const byFlight =
      this.mode[i] === MODE_MEMBER ? smoothstep(0, 0.25, this.prog[i]) : 0;
    return Math.max(byDistance, byFlight, 1e-4);
  }

  /** Mid-flight rise toward the viewer, 0 at both ends of a flight. */
  private arc(i: number) {
    if (
      this.reducedMotion ||
      this.mode[i] === MODE_SPHERE ||
      this.delay[i] > 0 ||
      this.lofted[i] === 0
    ) {
      return 0;
    }
    const t = clamp(this.prog[i], 0, 1);
    if (this.mode[i] === MODE_RETURNING) {
      return Math.sin(Math.PI * t) * FLIGHT.arc;
    }
    // On the way in the swell peaks early (at SEND_OFF.peakAt): a pop off
    // the globe, then a long settle down to its size in the pile.
    const shape = Math.log(0.5) / Math.log(SEND_OFF.peakAt);
    return Math.sin(Math.PI * t ** shape) * SEND_OFF.swell;
  }

  /** Card i's position and size. */
  private place2d(i: number, free: number, arc: number) {
    const onBall = free === 0;
    const touch = 1 - PRESS.give * this.prs[i];
    const size =
      (onBall
        ? this.sphereSize[i] * this.pressed01(i)
        : this.bs[i] * (1 + arc)) * touch;
    const root = Math.sqrt(this.aspect[this.item[i]]);
    this.x[i] = onBall ? this.sphereX[i] : this.bx[i];
    this.y[i] = onBall ? this.sphereY[i] : this.by[i];
    this.w[i] = size * root;
    this.h[i] = size / root;
  }

  /**
   * Card i's 2×2 transform, in the plane of its poster: stretched by speed
   * in flight, squashed by impact, tilted by the toss. (Foreshortening
   * isn't here: the renderer bends the card onto its sphere, which does
   * it.)
   */
  private transform(i: number, free: number) {
    this.m00 = 1;
    this.m01 = 0;
    this.m10 = 0;
    this.m11 = 1;
    const speed = Math.hypot(this.bvx[i], this.bvy[i]);
    if (free > 0 && speed > 1 && !this.reducedMotion) {
      const k = 1 + Math.min(speed * FLIGHT.stretch, FLIGHT.stretchMax);
      this.axisScale(k, 1 / k, this.bvx[i] / speed, this.bvy[i] / speed);
    }
    const squash = clamp(this.sq[i], -0.3, 0.3);
    if (Math.abs(squash) > 1e-4) {
      this.axisScale(1 - squash, 1 / (1 - squash), this.sqX[i], this.sqY[i]);
    }
    if (this.rot[i] !== 0) {
      this.rotate(this.rot[i]);
    }
    const o = i * 4;
    this.mat[o] = this.m00;
    this.mat[o + 1] = this.m10;
    this.mat[o + 2] = this.m01;
    this.mat[o + 3] = this.m11;
    // The hit box, though, is the card as seen: flattened as it turns.
    const ux = this.sphereX[i] - this.centerX;
    const uy = this.sphereY[i] - this.centerY;
    const ul = Math.hypot(ux, uy) || 1;
    const flat = Math.max(Math.abs(this.facing[i]), 0.05);
    this.axisScale(1 + (flat - 1) * (1 - free), 1, ux / ul, uy / ul);
    const w2 = this.w[i] / 2;
    const h2 = this.h[i] / 2;
    this.ex[i] = Math.abs(this.m00) * w2 + Math.abs(this.m01) * h2;
    this.ey[i] = Math.abs(this.m10) * w2 + Math.abs(this.m11) * h2;
  }

  /**
   * The sphere card i is a poster on: the globe where it sits, the pile's
   * outer sphere at its spot there, and in flight a blend of the two, so
   * the card bends from one curve to the other as it travels.
   */
  private bendFrame(i: number) {
    const o = i * 4;
    const n = i * 3;
    const f = this.frame;
    if (this.mode[i] === MODE_SPHERE || this.delay[i] > 0) {
      f[o] = this.sphereN[n];
      f[o + 1] = this.sphereN[n + 1];
      f[o + 2] = this.sphereN[n + 2];
      f[o + 3] = 1;
      return;
    }
    const home = this.mode[i] === MODE_RETURNING;
    const to = home ? this.sphereN : this.slotN;
    const radius = home ? 1 : this.pileBend;
    const e = clamp(this.prog[i], 0, 1);
    const from = this.fromFrame;
    let x = from[o] + (to[n] - from[o]) * e;
    let y = from[o + 1] + (to[n + 1] - from[o + 1]) * e;
    let z = from[o + 2] + (to[n + 2] - from[o + 2]) * e;
    const length = Math.hypot(x, y, z);
    if (length < 1e-3) {
      [x, y, z] = [to[n], to[n + 1], to[n + 2]];
    } else {
      x /= length;
      y /= length;
      z /= length;
    }
    f[o] = x;
    f[o + 1] = y;
    f[o + 2] = z;
    f[o + 3] = from[o + 3] + (radius - from[o + 3]) * e;
  }

  /** The globe on screen, for the renderer's projection. */
  get globe() {
    return { camera: CAMERA, r: this.radius, x: this.centerX, y: this.centerY };
  }

  /** Light, depth and focus for card i. */
  private look(i: number, free: number) {
    const ball = 1 - free;
    const background = this.mode[i] === MODE_SPHERE ? this.dim : 0;
    this.shade[i] =
      (1 + (this.sphereShade[i] - 1) * ball) *
      (1 - SEND_OFF.darken * smoothstep(0, 1, this.pressIn[i]));
    this.rim[i] = this.sphereRim[i] * ball;
    this.back[i] = smoothstep(0.08, -0.08, this.facing[i]) * ball;
    const depth = this.depthFog[i] * ball;
    this.fog[i] = depth + (1 - depth) * background * FOCUS.fog;
    this.blur[i] = background * FOCUS.blur;
  }

  /**
   * Card i's shadow height and draw order: the ball back to front; cards
   * in the air above it; a landed card above the ones that landed before
   * it.
   */
  private stack(i: number, free: number, arc: number) {
    const mode = this.mode[i];
    let elev = 0;
    let key = this.facing[i];
    if (mode === MODE_RETURNING) {
      elev = free * (0.16 + arc * 2.5);
      // Above the sphere in the air; back in the sphere's own order as it
      // arrives, so a card heading for the far side never covers the front.
      key += (1.5 + free - key) * smoothstep(0, 0.35, free);
    } else if (free > 0 && this.landedAt[i] >= 0) {
      elev = free * 0.16;
      key = 2 + (this.landedAt[i] % 9000) * 1e-4;
    } else if (free > 0) {
      elev = free * (0.16 + arc * 2.5);
      key = 3 + free;
    }
    this.elev[i] = elev * (1 - 0.7 * this.prs[i]);
    this.depth[i] = key;
  }

  /**
   * Advances `dt` seconds and lays out every card. Returns whether anything
   * is still moving (the block stops its frame loop when not).
   */
  step(dt: number) {
    // Hit-tested against the last frame's layout, which is what's on screen.
    this.hovered =
      this.pointer && !this.dragging && this.pressed < 0
        ? this.hitTest(this.pointer.x, this.pointer.y)
        : -1;
    let moving = this.stepSpin(dt);
    moving = this.stepFocus(dt) || moving;

    const [x, y, z, w] = this.orientation;
    const r = [
      1 - 2 * (y * y + z * z),
      2 * (x * y - z * w),
      2 * (x * z + y * w),
      2 * (x * y + z * w),
      1 - 2 * (x * x + z * z),
      2 * (y * z - x * w),
      2 * (x * z - y * w),
      2 * (y * z + x * w),
      1 - 2 * (x * x + y * y),
    ];

    for (let i = 0; i < this.count; i += 1) {
      this.project(i, r, dt);
      moving = this.stepTouch(i, dt) || moving;
      if (this.mode[i] !== MODE_SPHERE) {
        moving = this.stepBody(i, dt) || moving;
      }
      const free = this.freedom(i);
      const arc = this.arc(i);
      this.place2d(i, free, arc);
      this.transform(i, free);
      this.bendFrame(i);
      this.look(i, free);
      this.stack(i, free, arc);
    }

    // Back to front.
    const { depth } = this;
    this.order.sort((a, b) => depth[a] - depth[b]);

    return moving;
  }
}
