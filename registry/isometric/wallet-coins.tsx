"use client";

import { useInView, useReducedMotion } from "motion/react";
import type { CSSProperties } from "react";
import { useRef } from "react";

import { cn } from "@/lib/utils";

import {
  EASE,
  Extrude,
  Face,
  FacePath,
  FloorGrid,
  IsoStage,
  press,
  Rig,
  roundedRect,
  sample,
  settle,
  shiftTrack,
  useClock,
  useIsoOrbit,
} from "./iso-core";
import type {
  IsoCast,
  IsoOrbit,
  IsoPose,
  IsoRotate,
  IsoTone,
  IsoTrack,
  IsoVariant,
  Vec3,
} from "./iso-core";

/* ─────────────────────────────────────────────────────────
 * ANIMATION STORYBOARD
 *
 * A hero object with a product moment: a thin wallet (stitched edge, a
 * strap with a snap) standing in open space; the brand card slides out
 * of its slit, then the currencies follow it out as coins. "Your card
 * and your currencies, in one place." Drawn in ink, no shadow.
 *
 *    0ms   card and coins hidden in the wallet's slit
 *  300ms   the card rises out of the slit with the settle (overshoot,
 *          swings halving) and leans back 9°; the wallet dips as it leaves
 *  800ms   the first coin pops out beside the card, the same way, fanning
 *          from the card's edge to its place and swinging upright from a lean
 *  960ms   the second coin, 160ms behind; 1120ms the third
 * 2200ms   idle: each coin sways ±12° and bobs ±0.18 on a 3.4s sine, a
 *          third of a period apart; the card breathes ±1.5° on its own
 *
 * Reduced motion: no entrance, no idle; everything holds its place.
 * ───────────────────────────────────────────────────────── */

const TIMING = {
  // The card rises.
  card: 300,
  // The first coin pops.
  coin: 800,
  // Between coins.
  coinStagger: 160,
  // Seconds of one idle sway and bob.
  idlePeriod: 3.4,
};

/* The idle, on a sine. */
const IDLE = {
  // World units the coins bob.
  bob: 0.18,
  // Degrees the card breathes about x.
  cardSway: 1.5,
  // Degrees the coins sway about z.
  sway: 12,
};

/* The entrance. */
const POP = {
  // Degrees the card leans back (about x) once out.
  cardLean: -9,
  // How far the wallet dips (z scale) as the card leaves.
  dip: 0.06,
  // Degrees a coin leans before it swings upright.
  lean: -26,
};

/* ───────────────────────── Geometry (world units) ─────────────────────── */

// A thin wallet standing on its long edge, facing the viewer (+y): one
// rounded body with a slit along the top, a stitched edge on the front, a
// strap across the right third with a snap. The card and coins live in the
// slit behind the front leaf and rise out of it.
const W = 9.5;
const WALLET = { depth: 1.3, h: 5, radius: 1.1, yFront: 0.65 };
const WALLET_Y_BACK = WALLET.yFront - WALLET.depth;
// The front leaf is most of the body and hides what is in the slit; the
// back leaf is a thin plate that closes it, so the two read as one body.
const LEAF = 0.95;
const BACK_LEAF = 0.25;
const STRAP = { depth: 0.14, w: 1.9, x: W / 2 - 3.1 };
const STITCH = 0.42;

// The card: a thin panel in the slit, a little narrower than the wallet.
const CARD = { depth: 0.12, h: 4.3, radius: 0.35, w: 5.8 };
// Rest: most of it shows above the wallet (only its bottom edge stays in
// the slit); it sits toward the left so the coins have the right.
const CARD_LIFT = 4;
const CARD_AT: Vec3 = [
  -W / 2 + 0.55,
  WALLET.yFront - LEAF + 0.02,
  CARD_LIFT + CARD.h,
];

// The coins: upright discs behind the card, in an arc.
const COIN = { depth: 0.36, r: 1.45 };
interface CoinSpot {
  x: number;
  y: number;
  /** Height of its lowest point above the floor, at rest. */
  lift: number;
}
// Clustered to the right of the card, back to front, the middle one
// highest, like a hand of coins.
const COINS: CoinSpot[] = [
  { lift: 4.6, x: 1.2, y: WALLET_Y_BACK + BACK_LEAF - 0.1 },
  { lift: 5.5, x: 2.3, y: WALLET_Y_BACK + BACK_LEAF + 0.08 },
  { lift: 4.4, x: 3.3, y: WALLET_Y_BACK + BACK_LEAF + 0.26 },
];
// Hidden: the part's top below the wallet's top edge, and its bottom never
// below the floor (nothing hides it there).
const hideCoin = (lift: number) =>
  -Math.min(lift, lift + COIN.r * 2 - WALLET.h + 0.2);
const hideCard = -Math.min(CARD_LIFT, CARD_LIFT + CARD.h - WALLET.h + 0.2);

// The circle a coin is extruded from, as four cubic quarters (face units).
const coinPath = () => roundedRect(COIN.r * 2, COIN.r * 2, COIN.r);

// The frame: wallet, the card and coins at their highest.
const BOUNDS: Vec3[] = [
  [-W / 2, WALLET.yFront, 0],
  [W / 2 + STRAP.depth, WALLET.yFront, 0],
  [-W / 2, WALLET.yFront, WALLET.h],
  [W / 2, WALLET_Y_BACK, WALLET.h],
  [CARD_AT[0], CARD_AT[1], CARD_LIFT + CARD.h + 0.8],
  [CARD_AT[0] + CARD.w, CARD_AT[1], CARD_LIFT + CARD.h + 0.8],
  ...COINS.map(
    (c): Vec3 => [c.x + COIN.r, c.y, c.lift + COIN.r * 2 + IDLE.bob + 0.7]
  ),
];

const CASTS: IsoCast[] = [
  { box: [-W / 2, WALLET_Y_BACK, W, WALLET.depth, WALLET.h] },
];

// The construction grid, when wanted.
const GRID = { at: [-9, -7] as const, size: [18, 12] as const };

// The camera turns around the wallet's centre.
const PIVOT: readonly [number, number] = [0, 0];
const DEFAULT_ORBIT: IsoOrbit = 22;

/* ───────────────────────────── Tracks ─────────────────────────────────── */

const coinStart = (i: number) => TIMING.coin + i * TIMING.coinStagger;

// The card rises from hidden with the settle and leans back as it clears.
const CARD_RISE: IsoTrack = settle(0, TIMING.card, 1.05, hideCard);
const CARD_LEAN: IsoTrack = [
  [TIMING.card + 260, 0, EASE.soft],
  [TIMING.card + 760, POP.cardLean],
];
// Each coin rises with the settle, fans out soft, swings upright with the
// settle.
const RISE: IsoTrack[] = COINS.map((c, i) =>
  settle(0, coinStart(i), 1, hideCoin(c.lift))
);
const FAN: IsoTrack[] = COINS.map((_, i) => [
  [coinStart(i), 0, EASE.soft],
  [coinStart(i) + 540, 1],
]);
const SWING: IsoTrack[] = COINS.map((_, i) =>
  settle(0, coinStart(i) + 40, 0.9, POP.lean)
);
// The wallet dips as the card leaves it, and a little for each coin.
const DIP: IsoTrack = [
  ...shiftTrack(press(POP.dip, 0), TIMING.card - 60),
  ...COINS.flatMap((_, i) =>
    shiftTrack(press(POP.dip * 0.5, 0), coinStart(i) - 60)
  ),
];

// Coins fan out from behind the card's right edge.
const FAN_FROM = 1.3;

const IDLE_START = coinStart(COINS.length - 1) + 900;

const idlePhase = (ms: number, i: number) => {
  const t = (ms - IDLE_START) / 1000 / TIMING.idlePeriod;
  return (t - i / COINS.length) * Math.PI * 2;
};

const coinPose =
  (i: number, idle: boolean) =>
  (ms: number): IsoPose => {
    const rise = sample(RISE[i], ms);
    const fan = sample(FAN[i], ms);
    if (!idle || ms < IDLE_START) {
      return {
        axis: "z",
        offset: [(fan - 1) * (COINS[i].x - FAN_FROM), 0, rise],
        rotate: sample(SWING[i], ms),
      };
    }
    const phase = idlePhase(ms, i);
    return {
      axis: "z",
      offset: [0, 0, rise + IDLE.bob * Math.sin(phase)],
      rotate: IDLE.sway * Math.sin(phase + Math.PI / 3),
    };
  };

const cardPose =
  (idle: boolean) =>
  (ms: number): IsoPose => {
    const breathe =
      idle && ms >= IDLE_START
        ? IDLE.cardSway * Math.sin(idlePhase(ms, 1.5))
        : 0;
    return {
      axis: "x",
      offset: [0, 0, sample(CARD_RISE, ms)],
      rotate: sample(CARD_LEAN, ms) + breathe,
    };
  };

const walletPose = (ms: number): IsoPose => ({
  scale: [1, 1, sample(DIP, ms)],
});

/* ───────────────────────────── Pieces ─────────────────────────────────── */

const INK_STROKE: CSSProperties = {
  strokeWidth: "var(--iso-edge-w)",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};
const HAIRLINE: CSSProperties = {
  strokeWidth: "var(--iso-guide-w)",
  vectorEffect: "var(--iso-vector, none)" as CSSProperties["vectorEffect"],
};

const Coin = ({ spot, glyph }: { spot: CoinSpot; glyph: string }) => {
  const at: Vec3 = [spot.x - COIN.r, spot.y, spot.lift + COIN.r * 2];
  const inset = 0.3;
  const rim = roundedRect(
    COIN.r * 2 - inset * 2,
    COIN.r * 2 - inset * 2,
    COIN.r - inset,
    inset,
    inset
  );
  return (
    <Extrude
      at={at}
      d={coinPath()}
      depth={COIN.depth}
      frontStyle={{ fill: "var(--iso-screen)" }}
      palette="surface"
      plane="left"
    >
      <FacePath
        at={at}
        d={rim}
        fill="none"
        plane="left"
        stroke="var(--iso-ink)"
        style={HAIRLINE}
      />
      <Face at={at} plane="left">
        <text
          fill="var(--iso-screen-ink)"
          fontSize={1.5}
          fontWeight={700}
          textAnchor="middle"
          x={COIN.r}
          y={COIN.r + 0.54}
        >
          {glyph}
        </text>
      </Face>
    </Extrude>
  );
};

/** The brand card: the one lit thing. Chip, name, last four. */
const Card = ({ name, last4 }: { name: string; last4: string }) => (
  <Extrude
    at={CARD_AT}
    d={roundedRect(CARD.w, CARD.h, CARD.radius)}
    depth={CARD.depth}
    palette="accent"
    plane="left"
  >
    <Face at={CARD_AT} plane="left">
      <rect
        fill="var(--iso-screen)"
        height={0.62}
        opacity={0.9}
        rx={0.14}
        width={0.86}
        x={0.55}
        y={0.55}
      />
      <path
        d="M0.55 0.86 H1.41 M0.98 0.55 V1.17"
        fill="none"
        stroke="var(--iso-accent-right-c)"
        strokeWidth={0.05}
      />
      <text
        fill="var(--iso-on-main)"
        fontSize={0.46}
        fontWeight={600}
        letterSpacing={0.03}
        x={0.55}
        y={2.3}
      >
        {name}
      </text>
      <text
        fill="var(--iso-on-main)"
        fontSize={0.4}
        letterSpacing={0.08}
        opacity={0.85}
        style={{ fontVariantNumeric: "tabular-nums" }}
        x={0.55}
        y={2.95}
      >
        {`••••  ${last4}`}
      </text>
    </Face>
  </Extrude>
);

/** The wallet: a thin rounded body with a slit, stitching and a strap. */
const Wallet = () => {
  const front: Vec3 = [-W / 2, WALLET.yFront, WALLET.h];
  const outline = roundedRect(W, WALLET.h, WALLET.radius);
  // The stitched edge, inset, as a dashed hairline.
  const stitch = roundedRect(
    W - 2 * STITCH,
    WALLET.h - 2 * STITCH,
    WALLET.radius - STITCH * 0.6,
    STITCH,
    STITCH
  );
  const strapAt: Vec3 = [STRAP.x, WALLET.yFront + STRAP.depth, WALLET.h + 0.05];
  return (
    <>
      {/* Front leaf: hides the slit's contents. Drawn after them. */}
      <Extrude at={front} d={outline} depth={LEAF} palette="main" plane="left">
        <FacePath
          at={front}
          d={stitch}
          fill="none"
          plane="left"
          stroke="var(--iso-ink)"
          strokeDasharray="0.22 0.16"
          style={HAIRLINE}
        />
      </Extrude>
      {/* Strap with the snap, wrapping over the front. */}
      <Extrude
        at={strapAt}
        d={roundedRect(STRAP.w, WALLET.h + 0.05, 0.3)}
        depth={STRAP.depth}
        palette="accent"
        plane="left"
      >
        <Face at={strapAt} plane="left">
          <circle
            cx={STRAP.w / 2}
            cy={WALLET.h * 0.58}
            fill="var(--iso-screen)"
            r={0.3}
            stroke="var(--iso-ink)"
            style={INK_STROKE}
          />
          <circle
            cx={STRAP.w / 2}
            cy={WALLET.h * 0.58}
            fill="var(--iso-ink)"
            r={0.1}
          />
        </Face>
      </Extrude>
    </>
  );
};

/** The back leaf, drawn before the slit's contents. */
const BackLeaf = () => (
  <Extrude
    at={[-W / 2, WALLET_Y_BACK + BACK_LEAF, WALLET.h]}
    d={roundedRect(W, WALLET.h, WALLET.radius)}
    depth={BACK_LEAF}
    palette="main"
    plane="left"
  />
);

/** The frame's shell: in view, reduced motion, the clock and the camera. */
const useHero = ({
  autoPlay,
  orbit,
  rotate,
}: {
  autoPlay: boolean;
  orbit: IsoOrbit;
  rotate: IsoRotate;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion() ?? false;
  const still = reduced || !autoPlay;
  // The rigs' clock: runs while in view; the end state holds otherwise.
  const clock = useClock(inView && !still);
  const { camera, orbitProps } = useIsoOrbit({
    mode: rotate,
    orbit,
    pivot: PIVOT,
    reduced,
  });
  return { camera, orbitProps, ref, rig: still ? undefined : clock, still };
};

// A turnable scene is a focusable group that says how to turn it.
const turnableLabel = (rotate: IsoRotate, title?: string) =>
  rotate === "off"
    ? {}
    : {
        "aria-label": `${title ?? "Illustration"}. Move the pointer or use the left and right arrow keys to turn it.`,
        role: "group",
      };

/**
 * Stage overrides for this hero: the wallet a pastel of the brand (toward
 * white in both themes, so it stays light on dark pages), the card and
 * strap in the brand at full strength (the lit thing).
 */
const stageStyle = (line: boolean) =>
  ({
    "--iso-accent-base": "var(--iso-accent)",
    "--iso-contour-w": line ? undefined : "0",
    "--iso-main-base": "color-mix(in oklab, var(--iso-tone) 46%, white)",
  }) as CSSProperties;

/* ───────────────────────────── Scene ──────────────────────────────────── */

export interface WalletCoinsProps {
  /** Brand colour: a theme token name (primary, chart-2…) or any CSS colour. The wallet is a pastel of it. */
  tone?: IsoTone;
  /** Colour of the card and strap, at full strength. Defaults to `tone`. */
  accent?: IsoTone;
  /** Flat ink drawing (default), soft tint, full colour, or blueprint outline. */
  variant?: IsoVariant;
  /** Line weight: in `ink` 0.3 is a 1.3 px outline at any size. */
  strokeWidth?: number;
  /** Name printed on the card, up to about 14 characters. */
  cardName?: string;
  /** Last four digits printed on the card. */
  last4?: string;
  /** Currency glyphs on the coins, up to three (one character each). */
  currencies?: readonly string[];
  /** Card and coins come out of the wallet when the scene scrolls into view. Off holds their places. */
  autoPlay?: boolean;
  /** After coming out, the coins keep swaying and bobbing on a sine, out of phase; the card breathes. */
  idle?: boolean;
  /** No shadow (default), or the soft cast shadow. */
  shadow?: "soft" | "none";
  /** Dashed construction grid on the floor. Off by default for a hero. */
  grid?: boolean;
  /**
   * Let the viewer turn the scene: "pointer" (leans toward the pointer
   * and settles back), "drag" (drag sideways or use the arrow keys), or
   * "off".
   */
  rotate?: IsoRotate;
  /** How far it turns, in degrees: a number for both ways, or [min, max]. Default 22. */
  orbit?: IsoOrbit;
  /** Accessible description. Without it the scene is decorative. */
  title?: string;
  /** Classes for the wrapper; size the scene with width (it keeps its aspect ratio). */
  className?: string;
}

const DEFAULT_CURRENCIES: readonly string[] = ["$", "€", "£"];

/**
 * Wallet, card and currencies, in isometric ink: a thin stitched wallet
 * in a pastel of the brand, the brand card sliding out of its slit, and
 * three currency coins following it out, each with an overshoot, fanning
 * into an arc and swinging upright while the wallet dips. Then they idle
 * on a sine wave, out of phase. One even outline, the
 * camera leans with the pointer. Follows the shadcn theme.
 */
export const WalletCoins = ({
  tone = "primary",
  accent,
  variant = "ink",
  strokeWidth = 0.3,
  cardName = "Jane Doe",
  last4 = "4242",
  currencies = DEFAULT_CURRENCIES,
  autoPlay = true,
  idle = true,
  shadow = "none",
  grid = false,
  rotate = "pointer",
  orbit = DEFAULT_ORBIT,
  title,
  className,
}: WalletCoinsProps) => {
  const { camera, orbitProps, ref, rig, still } = useHero({
    autoPlay,
    orbit,
    rotate,
  });
  const line = variant === "line";
  const glyphs = currencies.slice(0, COINS.length);
  return (
    <div
      {...turnableLabel(rotate, title)}
      className={cn(
        "rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
      data-slot="wallet-coins"
      ref={ref}
      {...orbitProps}
    >
      <IsoStage
        accent={accent}
        bounds={BOUNDS}
        camera={camera}
        casts={CASTS}
        orbit={rotate === "off" ? 0 : orbit}
        shadow={shadow === "soft"}
        strokeWidth={strokeWidth}
        style={stageStyle(line)}
        title={title}
        tone={tone}
        variant={variant}
      >
        {grid ? <FloorGrid at={GRID.at} size={GRID.size} step={2} /> : null}
        <Rig
          clock={rig}
          pivot={[0, WALLET.yFront - WALLET.depth / 2, 0]}
          pose={still ? undefined : walletPose}
        >
          <BackLeaf />
          {glyphs.map((glyph, i) => (
            <Rig
              clock={rig}
              key={glyph}
              pivot={[COINS[i].x, COINS[i].y + COIN.depth / 2, COINS[i].lift]}
              pose={still ? undefined : coinPose(i, idle)}
            >
              <Coin glyph={glyph} spot={COINS[i]} />
            </Rig>
          ))}
          <Rig
            clock={rig}
            pivot={[0, CARD_AT[1], CARD_LIFT]}
            pose={still ? undefined : cardPose(idle)}
          >
            <Card last4={last4} name={cardName} />
          </Rig>
          <Wallet />
        </Rig>
      </IsoStage>
    </div>
  );
};

export default WalletCoins;
