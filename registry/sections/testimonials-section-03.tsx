"use client";

/* oxlint-disable func-style, sort-keys, no-inline-comments, nextjs/no-img-element, prefer-destructuring */

import { ArrowLeft, ArrowRight, Quote } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { Variants } from "motion/react";
import type { ComponentProps } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

export interface TestimonialAuthor {
  /** The customer's full name, e.g. "Sam Davies". */
  name: string;
  /** Their job title or role, e.g. "VP of Revenue Operations". */
  role: string;
  /** Their company or organization, e.g. "Lattice Corp.". */
  company: string;
  /** Portrait photo URL in 3:4 ratio (3 width, 4 height). Rendered as a monochrome headshot. */
  avatar?: string;
}

export interface TestimonialItem {
  /** Unique identifier for the story. */
  id: string;
  /** Author details including name, role, company and optional avatar. */
  author: TestimonialAuthor;
  /** Customer quote text. Displayed enclosed in large quotation marks. */
  quote: string;
}

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  {
    id: "sam-davies",
    author: {
      name: "Sam Davies",
      role: "VP of Revenue Operations",
      company: "Lattice Corp.",
      avatar: "/images/testimonials/sam-davies.jpg",
    },
    quote:
      "Before automating our pipelines, deals would sit untouched for days before an AE noticed. Lattice flags bottlenecks immediately and prepares follow-ups automatically. Our team closes more qualified accounts every month with significantly less manual CRM hygiene.",
  },
  {
    id: "elena-rostova",
    author: {
      name: "Elena Rostova",
      role: "Head of Infrastructure",
      company: "Stratum Dynamics",
      avatar: "/images/testimonials/elena-rostova.jpg",
    },
    quote:
      "Deploying across four cloud regions used to require multi-day staging windows and constant incident firefighting. With these primitives, zero-downtime rollouts are completely routine. We cut our MTTR by 74% in the very first quarter.",
  },
  {
    id: "marcus-vance",
    author: {
      name: "Marcus Vance",
      role: "Chief Technology Officer",
      company: "Vance Systems",
      avatar: "/images/testimonials/marcus-vance.jpg",
    },
    quote:
      "Our platform latency and API error rates dropped drastically within forty-eight hours of rollout. The architecture is rock solid, and our developers can focus on shipping features rather than firefighting.",
  },
  {
    id: "sarah-jenkins",
    author: {
      name: "Sarah Jenkins",
      role: "Director of Product",
      company: "Kinetic Velocity",
      avatar: "/images/testimonials/sarah-jenkins.jpg",
    },
    quote:
      "Connecting our distributed engineering teams with these shared primitives eliminated endless design cycles. We shipped our flagship enterprise release three weeks ahead of schedule.",
  },
  {
    id: "carlos-mendez",
    author: {
      name: "Carlos Mendez",
      role: "VP of Engineering",
      company: "Vanguard Partners",
      avatar: "/images/testimonials/carlos-mendez.jpg",
    },
    quote:
      "The attention to detail and performance consistency across high-load operations has exceeded all our expectations. It is easily the most dependable foundational layer we have adopted.",
  },
];

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

const LINE_DURATION = 0.22;
const LINE_STAGGER = 0.04;
const EXIT_DURATION = 0.14;

interface LineCustom {
  direction: number;
  index: number;
}

const lineVariants: Variants = {
  enter: ({ direction }: LineCustom) => ({
    opacity: 0,
    filter: "blur(4px)",
    x: -direction * 20,
  }),
  center: ({ index }: LineCustom) => ({
    opacity: 1,
    filter: "blur(0px)",
    x: 0,
    transition: {
      delay: index * LINE_STAGGER,
      duration: LINE_DURATION,
      ease: "easeOut",
    },
  }),
  exit: ({ direction }: LineCustom) => ({
    opacity: 0,
    filter: "blur(4px)",
    x: direction * 20,
    transition: {
      duration: EXIT_DURATION,
      ease: "easeIn",
    },
  }),
};

interface AuthorCustom {
  direction: number;
  index: number;
}

const authorVariants: Variants = {
  enter: ({ direction }: AuthorCustom) => ({
    opacity: 0,
    filter: "blur(4px)",
    x: -direction * 16,
  }),
  center: ({ index }: AuthorCustom) => ({
    opacity: 1,
    filter: "blur(0px)",
    x: 0,
    transition: {
      delay: index * LINE_STAGGER,
      duration: LINE_DURATION,
      ease: "easeOut",
    },
  }),
  exit: ({ direction }: AuthorCustom) => ({
    opacity: 0,
    filter: "blur(4px)",
    x: direction * 16,
    transition: {
      duration: EXIT_DURATION,
      ease: "easeIn",
    },
  }),
};

export interface TestimonialsSection03Props extends Omit<
  ComponentProps<"section">,
  "title"
> {
  /** Customer testimonial items. If omitted, default sample stories are shown. If an empty array [] is passed, an empty state is displayed. */
  testimonials?: TestimonialItem[];
  /** Accessible title for screen readers. Defaults to "Customer Testimonials". */
  title?: string;
  /** Optional auto-play delay in milliseconds. If omitted or false, auto-advance is disabled. */
  autoPlayInterval?: number | false;
}

export default function TestimonialsSection03({
  className,
  testimonials,
  title = "Customer Testimonials",
  autoPlayInterval = false,
  ...props
}: TestimonialsSection03Props) {
  // If testimonials prop is not passed (undefined), load sample data.
  // If an empty array [] is explicitly passed, populate the empty array (triggering the empty state).
  const items =
    testimonials === undefined ? DEFAULT_TESTIMONIALS : testimonials;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);

  const activeIndex = items.length > 0 ? currentIndex % items.length : 0;
  const currentItem = items[activeIndex];

  const handleNext = useCallback(() => {
    if (items.length <= 1) {
      return;
    }
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const handlePrev = useCallback(() => {
    if (items.length <= 1) {
      return;
    }
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev]);

  // Optional auto-play support
  useEffect(() => {
    if (!autoPlayInterval || items.length <= 1) {
      return;
    }
    const timer = setInterval(handleNext, autoPlayInterval);
    return () => clearInterval(timer);
  }, [autoPlayInterval, handleNext, items.length]);

  const [lines, setLines] = useState<string[]>([]);
  const quoteContainerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const rawQuote = currentItem?.quote ?? "";
  const cleanQuote = useMemo(
    () => rawQuote.trim().replace(/^["“](.*)["”]$/, "$1"),
    [rawQuote]
  );

  const measureWords = useMemo(() => {
    if (!cleanQuote) {
      return [];
    }
    const raw = cleanQuote.split(/\s+/);
    return raw.map((word, i) => {
      let w = word;
      if (i === 0) {
        w = `“${w}`;
      }
      if (i === raw.length - 1) {
        w = `${w}”`;
      }
      return w;
    });
  }, [cleanQuote]);

  useIsomorphicLayoutEffect(() => {
    const container = measureRef.current;
    const parent = quoteContainerRef.current;
    if (!container || measureWords.length === 0) {
      setLines(cleanQuote ? [`“${cleanQuote}”`] : []);
      return;
    }

    const computeLines = () => {
      const spans = container.querySelectorAll<HTMLElement>(
        "[data-measure-word]"
      );
      if (spans.length === 0) {
        setLines([`“${cleanQuote}”`]);
        return;
      }

      const linesList: string[] = [];
      let currentWords: string[] = [];
      let currentLineTop = spans[0].offsetTop;

      for (let idx = 0; idx < spans.length; idx += 1) {
        const span = spans[idx];
        if (span.offsetTop > currentLineTop + 10) {
          if (currentWords.length > 0) {
            linesList.push(currentWords.join(" "));
          }
          currentWords = [measureWords[idx]];
          currentLineTop = span.offsetTop;
        } else {
          currentWords.push(measureWords[idx]);
        }
      }

      if (currentWords.length > 0) {
        linesList.push(currentWords.join(" "));
      }

      setLines(linesList);
    };

    computeLines();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && parent) {
      resizeObserver = new ResizeObserver(() => {
        computeLines();
      });
      resizeObserver.observe(parent);
    }

    const handleResize = () => {
      computeLines();
    };
    window.addEventListener("resize", handleResize);

    if (typeof document !== "undefined" && "fonts" in document) {
      const onFontsReady = async () => {
        try {
          await document.fonts.ready;
          computeLines();
        } catch {
          // Ignore font readiness errors
        }
      };
      void onFontsReady();
    }

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, [cleanQuote, measureWords]);

  return (
    <section
      data-slot="testimonials-section-03"
      className={cn(
        "relative flex min-h-[100dvh] md:min-h-[750px] lg:min-h-[850px] w-full flex-col justify-between bg-background text-foreground p-6 sm:p-8 md:p-12 lg:p-16 selection:bg-foreground selection:text-background",
        className
      )}
      {...props}
    >
      <h2 className="sr-only">{title}</h2>

      {items.length === 0 ? (
        /* Empty State */
        <div className="flex w-full flex-1 flex-col items-center justify-center py-24 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-border bg-muted/40 text-muted-foreground">
            <Quote className="size-6 text-muted-foreground/70" />
          </div>
          <h3 className="mt-4 text-xl font-medium tracking-tight text-foreground">
            No testimonials available
          </h3>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-sm leading-relaxed">
            Pass an array of customer stories via the{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              testimonials
            </code>{" "}
            prop to display them here.
          </p>
        </div>
      ) : (
        /* Main container with generous vertical gap between Top and Bottom */
        <div className="flex w-full flex-1 flex-col justify-between gap-12 sm:gap-16 md:gap-20 lg:gap-24">
          {/* Testimonial Content: Image on left, large quote text on right, aligned to start */}
          <div className="flex flex-col md:flex-row items-start gap-8 sm:gap-10 md:gap-12 lg:gap-16 xl:gap-24">
            {/* Left: Monochrome Portrait Avatar (static crossfade, no translation, strictly 3:4) */}
            <div className="relative hidden sm:block shrink-0 overflow-hidden w-full sm:w-64 md:w-72 lg:w-80 xl:w-[22rem] aspect-[3/4] bg-muted">
              <AnimatePresence mode="wait">
                {currentItem.author.avatar ? (
                  <motion.img
                    key={currentItem.id}
                    src={currentItem.author.avatar}
                    alt={currentItem.author.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: "easeOut" }}
                    className="absolute inset-0 size-full aspect-[3/4] object-cover object-top grayscale"
                    loading="eager"
                  />
                ) : (
                  <motion.div
                    key={`fallback-${currentItem.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 size-full flex items-center justify-center bg-muted text-muted-foreground text-3xl font-medium"
                  >
                    {currentItem.author.name.charAt(0)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Right: Testimonial Quote (broken by visual display line & staggered) */}
            <div
              ref={quoteContainerRef}
              className="relative flex-1 min-w-0 flex flex-col justify-start items-start text-left w-full"
            >
              {/* Invisible measurement element to calculate real wrapped display lines */}
              <div
                ref={measureRef}
                aria-hidden="true"
                className="pointer-events-none invisible absolute inset-x-0 top-0 select-none text-2xl sm:text-2xl md:text-3xl lg:text-5xl font-medium leading-[1.25] tracking-tight text-left w-full"
              >
                {measureWords.map((word, i) => (
                  <span key={i} data-measure-word className="inline-block">
                    {word}
                    {i < measureWords.length - 1 ? "\u00A0" : ""}
                  </span>
                ))}
              </div>

              <AnimatePresence mode="wait" custom={direction}>
                <motion.blockquote
                  key={currentItem.id}
                  custom={direction}
                  className="relative text-2xl sm:text-2xl md:text-3xl lg:text-5xl font-medium leading-[1.25] tracking-tight text-foreground text-left flex flex-col items-start w-full"
                >
                  {(lines.length > 0 ? lines : [`“${cleanQuote}”`]).map(
                    (line, idx) => (
                      <motion.span
                        key={`${currentItem.id}-line-${idx}`}
                        custom={{ direction, index: idx }}
                        variants={lineVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="block"
                      >
                        {line}
                      </motion.span>
                    )
                  )}
                </motion.blockquote>
              </AnimatePresence>
            </div>
          </div>

          {/* Bottom Area: Author credentials on left, navigation controls on right */}
          <div className="flex flex-row items-end justify-between gap-6 pt-6 sm:pt-8 md:pt-12">
            {/* Author Name and Role (with mobile thumbnail using static crossfade) */}
            <div className="flex flex-row gap-4 items-center">
              <div className="relative shrink-0 overflow-hidden h-20 aspect-[3/4] bg-muted block sm:hidden">
                <AnimatePresence mode="wait">
                  {currentItem.author.avatar ? (
                    <motion.img
                      key={currentItem.id}
                      src={currentItem.author.avatar}
                      alt={currentItem.author.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.28, ease: "easeOut" }}
                      className="absolute inset-0 size-full aspect-[3/4] object-cover object-top grayscale"
                      loading="eager"
                    />
                  ) : (
                    <motion.div
                      key={`fallback-mobile-${currentItem.id}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 size-full flex items-center justify-center bg-muted text-muted-foreground text-sm font-medium"
                    >
                      {currentItem.author.name.charAt(0)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Author details: Name, Role, Company animated together at once */}
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={currentItem.id}
                  custom={direction}
                  className="min-w-0 flex flex-col items-start"
                >
                  <motion.div
                    key={`${currentItem.id}-author-name`}
                    custom={{
                      direction,
                      index: 0,
                    }}
                    variants={authorVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    className="text-lg sm:text-2xl md:text-4xl lg:text-5xl font-medium tracking-tight text-foreground"
                  >
                    {currentItem.author.name}
                  </motion.div>

                  <div className="mt-1 sm:mt-2 text-xs sm:text-base md:text-lg lg:text-xl text-muted-foreground font-normal leading-relaxed">
                    <motion.div
                      key={`${currentItem.id}-author-role`}
                      custom={{
                        direction,
                        index: 1,
                      }}
                      variants={authorVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      {currentItem.author.role}
                    </motion.div>

                    <motion.div
                      key={`${currentItem.id}-author-company`}
                      custom={{
                        direction,
                        index: 2,
                      }}
                      variants={authorVariants}
                      initial="enter"
                      animate="center"
                      exit="exit"
                    >
                      {currentItem.author.company}
                    </motion.div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Large Circular Previous / Next Buttons */}
            {items.length > 1 && (
              <div className="flex items-center gap-3 sm:gap-4 md:gap-5 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Previous testimonial"
                  className="flex size-10 sm:size-16 md:size-20 lg:size-24 items-center justify-center rounded-full border border-border text-foreground transition-all duration-150 hover:border-foreground hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <ArrowLeft
                    className="size-5 sm:size-6 md:size-7 lg:size-8 text-foreground"
                    strokeWidth={1.75}
                  />
                </button>

                <button
                  type="button"
                  onClick={handleNext}
                  aria-label="Next testimonial"
                  className="flex size-10 sm:size-16 md:size-20 lg:size-24 items-center justify-center rounded-full border border-border text-foreground transition-all duration-150 hover:border-foreground hover:bg-muted active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <ArrowRight
                    className="size-5 sm:size-6 md:size-7 lg:size-8 text-foreground"
                    strokeWidth={1.75}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
