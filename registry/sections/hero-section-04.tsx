"use client";

/* oxlint-disable nextjs/no-img-element -- a registry section cannot assume next/image is configured for the consumer's image host */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- container acts as interactive curtain canvas */

import { Menu, X } from "lucide-react";
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
} from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { Geist, Syne } from "next/font/google";
import type { ReactNode, SVGProps } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const syne = Syne({
  display: "swap",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const geist = Geist({
  display: "swap",
  subsets: ["latin"],
});

const FONT_STYLES = `@import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Syne:wght@600;700;800&display=swap');`;

// Pre-baked polynomial coefficients for cubic-bezier(0.40, 0.00, 0.39, 1.16)
const X1 = 0.4;
const Y1 = -0.1;
const X2 = 0.4;
const Y2 = 0.7;

const AX = 1 - 3 * X2 + 3 * X1;
const BX = 3 * X2 - 6 * X1;
const CX = 3 * X1;

const AY = 1 - 3 * Y2 + 3 * Y1;
const BY = 3 * Y2 - 6 * Y1;
const CY = 3 * Y1;

const sampleCurveX = (t: number): number => ((AX * t + BX) * t + CX) * t;

const sampleCurveY = (t: number): number => ((AY * t + BY) * t + CY) * t;

const sampleCurveDerivativeX = (t: number): number =>
  (3 * AX * t + 2 * BX) * t + CX;

const solvePresetBezier = (x: number): number => {
  if (x <= 0) {
    return 0;
  }
  if (x >= 1) {
    return 1;
  }

  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const currentX = sampleCurveX(t) - x;
    if (Math.abs(currentX) < 1e-5) {
      return sampleCurveY(t);
    }
    const dX = sampleCurveDerivativeX(t);
    if (Math.abs(dX) < 1e-6) {
      break;
    }
    t -= currentX / dX;
  }

  let t0 = 0;
  let t1 = 1;
  t = x;
  for (let i = 0; i < 12; i += 1) {
    const currentX = sampleCurveX(t);
    if (Math.abs(currentX - x) < 1e-5) {
      return sampleCurveY(t);
    }
    if (x > currentX) {
      t0 = t;
    } else {
      t1 = t;
    }
    t = (t1 + t0) / 2;
  }

  return sampleCurveY(t);
};

const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

const getScaleForColumn = (
  colIndex: number,
  activeCol: number,
  totalColumns: number,
  scaleMultiplier = 1
): number => {
  const maxSpread = Math.max(activeCol, totalColumns - 1 - activeCol);
  const dist = Math.abs(colIndex - activeCol);
  const rawFactor =
    maxSpread > 0 ? Math.max(0, Math.min(1, dist / maxSpread)) : 0;
  // Never let a slice exceed its full slot width (scaleX 1), so the hover
  // boost can add up to +40% without the group ever exceeding 100% width.
  return Math.min(
    1,
    Math.max(0, Math.min(1, solvePresetBezier(rawFactor))) * scaleMultiplier
  );
};

const getColumnsForWidth = (width: number, maxColumns: number): number => {
  if (width < 640) {
    return Math.min(12, maxColumns);
  }
  if (width < 1024) {
    return Math.min(20, maxColumns);
  }
  return maxColumns;
};

const resolveCurtainBg = (
  userColor?: string
): { bgClass: string; bgStyle?: { backgroundColor: string } } => {
  if (userColor) {
    if (userColor.startsWith("bg-")) {
      return { bgClass: userColor };
    }
    if (
      userColor.startsWith("#") ||
      userColor.startsWith("rgb") ||
      userColor.startsWith("hsl")
    ) {
      return { bgClass: "", bgStyle: { backgroundColor: userColor } };
    }
    if (/^[a-z]+(-[a-z0-9]+)+$/.test(userColor)) {
      return { bgClass: `bg-${userColor}` };
    }
    return { bgClass: "", bgStyle: { backgroundColor: userColor } };
  }
  return { bgClass: "bg-background" };
};

const DEFAULT_IMAGE = "/images/hero-curtains.jpg";

const IMAGE_MAP: Record<number, string> = {
  1: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=2000&h=1100&auto=format&fit=crop&q=80",
  2: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=2000&h=1100&auto=format&fit=crop&q=80",
};

// Shared spring feel for the pointer-driven column, hover scale and reveal.
const CURTAIN_SPRING = {
  damping: 26,
  mass: 0.9,
  stiffness: 160,
} as const;

export interface InterleavedImageSlicesProps {
  /** High-resolution image URL. Defaults to a brutalist architectural photograph. */
  imageSrc?: string;
  /** Image alternative text for accessibility and screen readers. */
  imageAlt?: string;
  /** Optional index to select an image from IMAGE_MAP (e.g. 1 or 2). */
  imageNumber?: number;
  /** Number of vertical curtain slices on desktop. Adapts to lower counts on mobile (12) and tablet (20). */
  columns?: number;
  /** Optional Tailwind sizing and positioning classes for the container. */
  className?: string;
  /** Custom background color for the curtain slices (Tailwind class, hex, rgb, or hsl). */
  color?: string;
  /** Alias for color. */
  curtainColor?: string;
  /** Optional noise texture CSS background-image value painted beneath the curtains. */
  noiseTexture?: string;
  /** Vertical focal point alignment of the photograph. */
  imagePosition?: "top" | "center" | "bottom";
  /** Optional callback fired when the curtain container is clicked. */
  onClick?: () => void;
  /** Duration in ms for each curtain column to open during initial animation (default: 1200). */
  introDuration?: number;
  /** Hold pause in ms before the initial curtain opening begins (default: 350). */
  introPause?: number;
  /** Maximum stagger delay in ms across columns from center outward (default: 350). */
  introStagger?: number;
}

export const InterleavedImageSlices = ({
  imageSrc,
  imageAlt = "Luminescent green tendrils flowing through darkness",
  imageNumber,
  columns = 32,
  className = "w-full h-72 sm:h-96 md:h-112 lg:h-128 xl:h-144 max-w-none",
  color,
  curtainColor,
  noiseTexture,
  imagePosition = "center",
  onClick,
  introDuration = 1200,
  introPause = 350,
  introStagger = 350,
}: InterleavedImageSlicesProps) => {
  const resolvedSrc =
    imageSrc ??
    (imageNumber ? IMAGE_MAP[imageNumber] : undefined) ??
    DEFAULT_IMAGE;

  const containerRef = useRef<HTMLDivElement>(null);
  const curtainRefs = useRef<(HTMLDivElement | null)[]>([]);

  const [isClicked, setIsClicked] = useState(false);
  const [resolvedColumns, setResolvedColumns] = useState<number>(columns);

  const isHoveredRef = useRef<boolean>(false);
  const isClickedRef = useRef<boolean>(false);
  const isInitialLoadedRef = useRef<boolean>(false);

  // Motion values drive the curtains: a spring-smoothed column index,
  // hover scale multiplier and reveal (open) factor.
  const colTarget = useMotionValue((columns - 1) / 2);
  const col = useSpring(colTarget, CURTAIN_SPRING);
  const hoverTarget = useMotionValue(1);
  const hoverScale = useSpring(hoverTarget, CURTAIN_SPRING);
  const openTarget = useMotionValue(1);
  const open = useSpring(openTarget, CURTAIN_SPRING);

  const introProgress = useMotionValue(0);
  const introControlsRef = useRef<AnimationPlaybackControls | null>(null);

  const reducedMotion = useReducedMotion();

  // Measure container and adapt columns smoothly
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const measure = () => {
      const width =
        container.getBoundingClientRect().width || window.innerWidth;
      const targetCols = getColumnsForWidth(width, columns);
      setResolvedColumns((prev) => (prev === targetCols ? prev : targetCols));
    };

    measure();

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width } = entry.contentRect;
        if (width > 0) {
          const targetCols = getColumnsForWidth(width, columns);
          setResolvedColumns((prev) =>
            prev === targetCols ? prev : targetCols
          );
        }
      }
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [columns]);

  // Renders every curtain from the current spring values.
  const renderCurtains = useCallback(
    (activeCol: number, scaleMultiplier: number, openValue: number) => {
      const els = curtainRefs.current;
      const clampedOpen = Math.max(0, Math.min(1, openValue));
      for (let i = 0; i < resolvedColumns; i += 1) {
        const el = els[i];
        if (!el) {
          continue;
        }
        const scaleX =
          getScaleForColumn(i, activeCol, resolvedColumns, scaleMultiplier) *
          clampedOpen;
        el.style.transform = `scaleX(${scaleX})`;
      }
    },
    [resolvedColumns]
  );

  const renderFromSprings = useCallback(() => {
    if (!isInitialLoadedRef.current) {
      return;
    }
    renderCurtains(col.get(), hoverScale.get(), open.get());
  }, [col, hoverScale, open, renderCurtains]);

  useMotionValueEvent(col, "change", renderFromSprings);
  useMotionValueEvent(hoverScale, "change", renderFromSprings);
  useMotionValueEvent(open, "change", renderFromSprings);

  useEffect(() => {
    const center = (resolvedColumns - 1) / 2;
    const els = curtainRefs.current;
    curtainRefs.current = curtainRefs.current.slice(0, resolvedColumns);

    isInitialLoadedRef.current = false;

    for (const el of els) {
      if (el) {
        el.style.transform = "scaleX(1)";
        el.style.transition = "";
      }
    }

    // Reset springs to rest without animating.
    colTarget.jump(center);
    col.jump(center);
    hoverTarget.jump(1);
    hoverScale.jump(1);
    openTarget.jump(1);
    open.jump(1);
    introProgress.jump(0);

    // Entrance animation: a single motion timeline drives all columns,
    // staggered outward from the center.
    const totalIntro = introDuration + introStagger;
    const maxDist = center || 1;

    const renderIntro = (progress: number) => {
      const elapsed = progress * totalIntro;
      for (let i = 0; i < resolvedColumns; i += 1) {
        const el = els[i];
        if (!el) {
          continue;
        }
        const targetScale = getScaleForColumn(i, center, resolvedColumns);
        const dist = Math.abs(i - center);
        const colDelay = (dist / maxDist) * introStagger;
        const colElapsed = elapsed - colDelay;

        if (colElapsed <= 0) {
          el.style.transform = "scaleX(1)";
        } else if (colElapsed >= introDuration) {
          el.style.transform = `scaleX(${targetScale})`;
        } else {
          const t = colElapsed / introDuration;
          const currentScale = 1 + (targetScale - 1) * easeInOutCubic(t);
          el.style.transform = `scaleX(${currentScale})`;
        }
      }
    };

    const finishIntro = () => {
      isInitialLoadedRef.current = true;
      renderCurtains(col.get(), hoverScale.get(), open.get());
    };

    const unsubscribeIntro = introProgress.on("change", renderIntro);

    if (reducedMotion) {
      finishIntro();
    } else {
      renderIntro(0);
      introControlsRef.current = animate(introProgress, 1, {
        delay: introPause / 1000,
        duration: totalIntro / 1000,
        ease: "linear",
        onComplete: finishIntro,
      });
    }

    const handlePointerMove = (e: PointerEvent) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }

      // Small tolerance so hovering right at the edge doesn't flicker
      // in/out of the container.
      const TOLERANCE = 6;
      const isInside =
        e.clientX >= rect.left - TOLERANCE &&
        e.clientX <= rect.right + TOLERANCE &&
        e.clientY >= rect.top - TOLERANCE &&
        e.clientY <= rect.bottom + TOLERANCE;

      if (!isInside) {
        if (isHoveredRef.current) {
          isHoveredRef.current = false;
          // Leaving while revealed re-enables the curtains.
          isClickedRef.current = false;
          setIsClicked(false);
          hoverTarget.set(1);
          colTarget.set(center);
          openTarget.set(1);
        }
        return;
      }

      isHoveredRef.current = true;
      hoverTarget.set(isClickedRef.current ? 1 : 1.4);

      const fraction = Math.max(
        0,
        Math.min(1, (e.clientX - rect.left) / rect.width)
      );
      colTarget.set(fraction * (resolvedColumns - 1));
    };

    const handlePointerLeave = () => {
      isHoveredRef.current = false;
      // Leaving while revealed re-enables the curtains.
      isClickedRef.current = false;
      setIsClicked(false);
      hoverTarget.set(1);
      colTarget.set(center);
      openTarget.set(1);
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    document.documentElement.addEventListener("mouseleave", handlePointerLeave);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      document.documentElement.removeEventListener(
        "mouseleave",
        handlePointerLeave
      );
      unsubscribeIntro();
      introControlsRef.current?.stop();
      introControlsRef.current = null;
    };
  }, [
    resolvedColumns,
    introDuration,
    introPause,
    introStagger,
    reducedMotion,
    colTarget,
    col,
    hoverTarget,
    hoverScale,
    openTarget,
    open,
    introProgress,
    renderCurtains,
  ]);

  const handleContainerClick = () => {
    // Interrupt the entrance animation if the user clicks early.
    if (!isInitialLoadedRef.current) {
      introControlsRef.current?.stop();
      introControlsRef.current = null;
      isInitialLoadedRef.current = true;
    }

    const nextClicked = !isClickedRef.current;
    isClickedRef.current = nextClicked;
    setIsClicked(nextClicked);
    openTarget.set(nextClicked ? 0 : 1);
    const hoveredScale = isHoveredRef.current ? 1.4 : 1;
    hoverTarget.set(nextClicked ? 1 : hoveredScale);
    onClick?.();
  };

  const { bgClass, bgStyle } = resolveCurtainBg(curtainColor ?? color);

  return (
    <div
      ref={containerRef}
      role="button"
      tabIndex={0}
      aria-expanded={isClicked}
      aria-label="Toggle curtain slices"
      onClick={handleContainerClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleContainerClick();
        }
      }}
      className={cn(
        "group relative cursor-pointer overflow-hidden transition-[background-color] duration-200 select-none touch-none",
        bgClass,
        className
      )}
      style={bgStyle}
    >
      {/* Base Full-Color Image (permanent GPU hardware composited layer) */}
      <img
        src={resolvedSrc}
        alt={imageAlt}
        decoding="sync"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        style={{
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
          objectPosition: imagePosition,
          transform: "translateZ(0)",
        }}
      />

      {/* Monochrome (B&W) Image Layer (cross-fades to full color on click) */}
      <img
        src={resolvedSrc}
        alt=""
        decoding="sync"
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ease-out"
        style={{
          WebkitBackfaceVisibility: "hidden",
          backfaceVisibility: "hidden",
          filter: "grayscale(100%)",
          objectPosition: imagePosition,
          opacity: isClicked ? 0 : 1,
          transform: "translateZ(0)",
          willChange: "opacity",
        }}
      />

      {noiseTexture ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[1] opacity-100 mix-blend-screen bg-repeat"
          style={{
            backgroundImage: noiseTexture,
            backgroundSize: "200px 200px",
          }}
        />
      ) : null}

      {/* Vertical bleed strips mask 1px sub-pixel seams at top/bottom edges */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 h-px",
          bgClass
        )}
        style={bgStyle}
      />
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-[-1px] z-20 h-px",
          bgClass
        )}
        style={bgStyle}
      />

      {/* Slices flex container: sub-pixel gap prevented with negative margin */}
      <div className="pointer-events-none absolute inset-0 flex h-full w-full gap-0 overflow-hidden">
        {Array.from({ length: resolvedColumns }).map((_, index) => (
          <div
            key={index}
            className="relative flex h-full flex-1 justify-center bg-transparent"
            style={{
              height: "calc(100% + 2px)",
              marginRight: "-2px",
              marginTop: "-1px",
              width: `calc(${100 / resolvedColumns}% + 2px)`,
            }}
          >
            <div
              ref={(el) => {
                curtainRefs.current[index] = el;
              }}
              className={cn(
                "relative z-10 h-full w-full shrink-0 origin-center transition-[background-color] duration-200",
                bgClass
              )}
              style={{
                transform: "scaleX(1)",
                willChange: "transform",
                ...bgStyle,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

const ArrowRightIcon = ({ className, ...props }: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <path d="M18.5 12L4.99997 12" />
    <path d="M13 18C13 18 19 13.5811 19 12C19 10.4188 13 6 13 6" />
  </svg>
);

export interface HeroSection04NavLink {
  /** Text label displayed for the link. */
  label: string;
  /** Destination URL or anchor. */
  href: string;
}

export interface HeroSection04Action {
  /** Button text label. */
  label: string;
  /** Destination URL or anchor. */
  href: string;
}

interface HeroSection04HeaderProps {
  brand: string;
  cta?: HeroSection04Action;
  navLinks: HeroSection04NavLink[];
}

const HeroSection04Header = ({
  brand,
  cta,
  navLinks,
}: HeroSection04HeaderProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [mobileMenuOpen]);

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex w-full flex-col items-center px-3 pt-3 sm:px-6 sm:pt-6">
      <div className="flex flex-col items-stretch max-w-full lg:max-w-6xl">
        <div className="flex items-stretch justify-center gap-2 sm:gap-3">
          <nav className="pointer-events-auto flex items-center justify-between rounded-none border border-border bg-background text-foreground transition-[background-color,border-color] duration-200">
            {/* Brand */}
            <span
              className={cn(
                syne.className,
                "px-4 py-2 sm:px-6 sm:py-3.5 text-sm sm:text-base lg:text-lg font-bold tracking-widest uppercase whitespace-nowrap"
              )}
            >
              {brand}
            </span>

            {/* Desktop Navigation Links */}
            <div
              className={cn(
                syne.className,
                "hidden lg:flex mx-6 xl:mx-9 items-stretch self-stretch text-xs lg:text-sm font-semibold tracking-wider uppercase text-muted-foreground"
              )}
            >
              {navLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  className="flex items-center px-3 xl:px-5 text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80"
                >
                  {label}
                </a>
              ))}
            </div>

            <div className="flex items-center">
              {/* Mobile menu trigger */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label={
                  mobileMenuOpen
                    ? "Close navigation menu"
                    : "Open navigation menu"
                }
                aria-expanded={mobileMenuOpen}
                className="lg:hidden mr-2 sm:mr-3 flex size-8 items-center justify-center rounded-none text-muted-foreground hover:bg-muted hover:text-foreground transition-[background-color,color,transform] duration-150 ease-out active:scale-95"
              >
                {mobileMenuOpen ? (
                  <X className="size-4" />
                ) : (
                  <Menu className="size-4" />
                )}
              </button>
            </div>
          </nav>

          {/* Detached floating CTA */}
          {cta ? (
            <a
              href={cta.href}
              className={cn(
                syne.className,
                "pointer-events-auto inline-flex items-center justify-center rounded-none px-4 py-2 sm:px-6 sm:py-3.5 text-xs sm:text-sm lg:text-base font-bold tracking-wider uppercase transition-[background-color,color] duration-200 whitespace-nowrap bg-foreground text-background hover:bg-foreground/90"
              )}
            >
              {cta.label}
            </a>
          ) : null}
        </div>

        {/* Mobile dropdown menu: matches exact width of the nav + button row above */}
        {mobileMenuOpen ? (
          <div className="pointer-events-auto mt-2 w-full lg:hidden rounded-none border border-border bg-background/95 backdrop-blur-md text-foreground p-3 sm:p-4 shadow-2xl transition-all duration-200">
            <div
              className={cn(
                syne.className,
                "flex flex-col space-y-1 text-xs sm:text-sm font-semibold tracking-wider uppercase"
              )}
            >
              {navLinks.map(({ href, label }) => (
                <a
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="group flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 rounded-none text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80 transition-colors"
                >
                  <span className="truncate">{label}</span>
                  <ArrowRightIcon className="size-4 shrink-0 opacity-60 transition-transform duration-150 group-hover:translate-x-0.5" />
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export interface HeroSection04Props {
  /** Brand name displayed on the left side of the navbar. */
  brand?: string;
  /** Primary navigation links displayed in the navbar. */
  navLinks?: HeroSection04NavLink[];
  /** Call-to-action button displayed in the floating header tab. */
  cta?: HeroSection04Action;
  /** Main headline text or JSX. */
  title?: ReactNode;
  /** Subtitle or descriptive paragraph text. */
  description?: string;
  /** High-resolution image URL for the interleaved curtain slice hero. */
  imageSrc?: string;
  /** Image alternative text for accessibility and screen readers. */
  imageAlt?: string;
  /** Optional index to select an image from IMAGE_MAP (e.g. 1 or 2). */
  imageNumber?: number;
  /** Vertical focal point alignment of the photograph. */
  imagePosition?: "top" | "center" | "bottom";
  /** Number of vertical curtain slices on desktop. Defaults to 32 (adapts to 12 on mobile, 20 on tablet). */
  columns?: number;
  /** Duration in ms for each curtain column to open during initial animation (default: 1200). */
  introDuration?: number;
  /** Hold pause in ms before the initial curtain opening begins (default: 350). */
  introPause?: number;
  /** Maximum stagger delay in ms across columns from center outward (default: 350). */
  introStagger?: number;
  /** Optional callback fired when the image curtain is clicked. */
  onImageClick?: () => void;
  /** 1 when this is the page's primary h1, 2 when inside documentation or secondary preview. */
  headingLevel?: 1 | 2;
  /** Optional container class name. */
  className?: string;
}

const DEFAULT_NAV_LINKS: HeroSection04NavLink[] = [
  { href: "#products", label: "Products" },
  { href: "#solutions", label: "Solutions" },
  { href: "#customers", label: "Customers" },
  { href: "#resources", label: "Resources" },
  { href: "#enterprise", label: "Enterprise" },
  { href: "#pricing", label: "Pricing" },
];

const DEFAULT_CTA: HeroSection04Action = { href: "#inquire", label: "Inquire" };

const DEFAULT_TITLE = (
  <>
    Cultivating <br />
    Quiet Spaces.
  </>
);

const DEFAULT_DESCRIPTION =
  "AVEN Studio grows interiors, landscapes and objects where greenery, light and silence take root - living architecture for the way you actually dwell.";

export const HeroSection04 = ({
  brand = "AVEN Studio",
  navLinks = DEFAULT_NAV_LINKS,
  cta = DEFAULT_CTA,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  imageSrc = DEFAULT_IMAGE,
  imageAlt = "Luminescent green tendrils flowing through darkness",
  imageNumber,
  imagePosition = "center",
  columns = 32,
  introDuration,
  introPause,
  introStagger,
  onImageClick,
  headingLevel = 1,
  className,
}: HeroSection04Props) => {
  const HeadingTag = headingLevel === 2 ? "h2" : "h1";

  return (
    <section
      data-slot="hero-section-04"
      className={cn(
        "relative flex min-h-screen w-full flex-col overflow-x-hidden transition-[background-color,color] duration-200 select-none",
        geist.className,
        "bg-background text-foreground selection:bg-selection selection:text-selection-foreground",
        className
      )}
    >
      <style>{FONT_STYLES}</style>

      {/* Floating responsive navigation header */}
      <HeroSection04Header brand={brand} cta={cta} navLinks={navLinks} />

      {/* Main content */}
      <main className="flex w-full flex-col">
        {/* Full-width interactive image curtain at the top */}
        <div className="relative w-full overflow-hidden">
          <InterleavedImageSlices
            imageSrc={imageSrc}
            imageAlt={imageAlt}
            imageNumber={imageNumber}
            imagePosition={imagePosition}
            columns={columns}
            introDuration={introDuration}
            introPause={introPause}
            introStagger={introStagger}
            onClick={onImageClick}
            className="w-full h-72 sm:h-96 md:h-112 lg:h-128 xl:h-144 max-w-none"
          />
        </div>

        {/* Headline and editorial description directly below component container */}
        <div className="flex w-full flex-col items-center px-4 mt-[clamp(6rem,12vw,11rem)] pb-[clamp(3rem,6vw,5rem)]">
          <HeadingTag
            className={cn(
              syne.className,
              "text-center text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-extrabold tracking-tight leading-[0.9] text-balance text-foreground transition-colors duration-200"
            )}
          >
            {title}
          </HeadingTag>
          {description ? (
            <p
              className={cn(
                geist.className,
                "mt-4 sm:mt-6 max-w-xs sm:max-w-md md:max-w-xl lg:max-w-3xl xl:max-w-4xl text-center text-sm sm:text-base lg:text-lg xl:text-xl font-medium tracking-wide leading-relaxed text-balance text-muted-foreground transition-colors duration-200"
              )}
              style={{ fontFamily: "'Geist Sans', 'Geist', sans-serif" }}
            >
              {description}
            </p>
          ) : null}
        </div>
      </main>
    </section>
  );
};

export default HeroSection04;
