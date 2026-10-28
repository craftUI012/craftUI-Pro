"use client";

/* oxlint-disable func-style, sort-keys, no-inline-comments, nextjs/no-img-element, prefer-destructuring */

import { ArrowLeft, ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

const AUTO_SCROLL_DURATION = 6000;

export interface TestimonialItem {
  id: string;
  name: string;
  role: string;
  company: string;
  image: string;
  quote: string;
  conversionRate: {
    change: string;
    subtext: string;
    value: string;
  };
  salesCycle: {
    change: string;
    subtext: string;
    value: string;
  };
}

const TESTIMONIALS: TestimonialItem[] = [
  {
    id: "marcus-vance",
    name: "Marcus Vance",
    role: "CEO & Co-founder",
    company: "Vance Systems",
    image:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
    quote:
      "Lattice has taken a lot of the friction out of our sales process. We spend less time chasing updates, piecing together customer history, and figuring out what needs attention. Our team can focus on selling, follow-ups happen faster, and we’ve seen a noticeable improvement in pipeline velocity.",
    conversionRate: {
      change: "+14.6%",
      subtext: "lead to client",
      value: "42.8%",
    },
    salesCycle: {
      change: "-12 days",
      subtext: "avg. deal close time",
      value: "18 days",
    },
  },
  {
    id: "elena-rostova",
    name: "Elena Rostova",
    role: "VP of Operations",
    company: "Stratum Dynamics",
    image:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&auto=format&fit=crop&q=80",
    quote:
      "Before automating our pipelines, deals would sit untouched for days before an AE noticed. Lattice flags bottlenecks immediately and prepares follow-ups automatically. Our team closes more qualified accounts every month with significantly less manual CRM hygiene.",
    conversionRate: {
      change: "+11.4%",
      subtext: "lead to client",
      value: "38.2%",
    },
    salesCycle: {
      change: "-9 days",
      subtext: "avg. deal close time",
      value: "15 days",
    },
  },
  {
    id: "aravind-patel",
    name: "Aravind Patel",
    role: "Head of Global Sales",
    company: "Meridian Labs",
    image:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80",
    quote:
      "The automatic deal triage and lead enrichment transformed our SDR productivity. Reps know exactly who to reach out to each morning with full contextual intelligence, which halved our ramp time and accelerated deal velocity across every territory.",
    conversionRate: {
      change: "+18.2%",
      subtext: "lead to client",
      value: "47.5%",
    },
    salesCycle: {
      change: "-11 days",
      subtext: "avg. deal close time",
      value: "14 days",
    },
  },
  {
    id: "sarah-jenkins",
    name: "Sarah Jenkins",
    role: "Chief Operating Officer",
    company: "Kinetic Velocity",
    image:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
    quote:
      "Connecting our disparate CRM data into Lattice gave leadership immediate, unskewed visibility into true deal stages. It eliminated forecast guesswork and cut our sales cycle by almost two weeks in our very first quarter.",
    conversionRate: {
      change: "+16.8%",
      subtext: "lead to client",
      value: "51.0%",
    },
    salesCycle: {
      change: "-14 days",
      subtext: "avg. deal close time",
      value: "12 days",
    },
  },
  {
    id: "carlos-mendez",
    name: "Carlos Mendez",
    role: "VP of G&S",
    company: "Vanguard Partners",
    image:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&fit=crop&q=80",
    quote:
      "Our win rate skyrocketed once we automated inbound routing and multi-channel follow-ups. Prospects get touched within minutes instead of hours, keeping buyer intent at peak engagement when it matters most.",
    conversionRate: {
      change: "+13.9%",
      subtext: "lead to client",
      value: "44.3%",
    },
    salesCycle: {
      change: "-8 days",
      subtext: "avg. deal close time",
      value: "16 days",
    },
  },
];

export interface TestimonialSectionProps extends ComponentProps<"section"> {
  headingLevel?: 1 | 2 | 3;
}

export default function TestimonialSection({
  className,
  headingLevel = 2,
  ...props
}: TestimonialSectionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [, setDirection] = useState(1);
  const [timerKey, setTimerKey] = useState(0);

  const current = TESTIMONIALS[currentIndex];
  const HeadingTag = `h${headingLevel}` as const;

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) =>
      prev === 0 ? TESTIMONIALS.length - 1 : prev - 1
    );
    setTimerKey((k) => k + 1);
  };

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) =>
      prev === TESTIMONIALS.length - 1 ? 0 : prev + 1
    );
    setTimerKey((k) => k + 1);
  };

  // Unified swipe / drag gesture (handles touch, mouse drag, and stylus on mobile)
  const pointerStartRef = useRef<{ id: number; x: number; y: number } | null>(
    null
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) {
      return;
    }
    pointerStartRef.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const start = pointerStartRef.current;
    if (!start || start.id !== e.pointerId) {
      return;
    }
    const deltaX = e.clientX - start.x;
    const deltaY = e.clientY - start.y;
    pointerStartRef.current = null;

    // Only active on smaller / mobile screens (< 1024px)
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      return;
    }

    // Minimum 30px swipe threshold with horizontal intent
    if (Math.abs(deltaX) > 30 && Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX < 0) {
        handleNext(); // Right to left -> Next
      } else {
        handlePrev(); // Left to right -> Previous
      }
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  // Reset auto-scroll interval whenever slide changes or arrow is clicked
  useEffect(() => {
    const timer = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % TESTIMONIALS.length);
      setTimerKey((k) => k + 1);
    }, AUTO_SCROLL_DURATION);

    return () => clearInterval(timer);
  }, [timerKey]);

  return (
    <section
      data-slot="testimonials-section"
      className={cn(
        "w-full bg-muted/30 py-16 sm:py-20 lg:py-24 transition-colors duration-200",
        className
      )}
      {...props}
    >
      {/* ── Section Header ────────────────────────────────────────────── */}
      <div className="mx-auto mb-12 flex w-fit max-w-3xl flex-col items-center gap-3 px-4 text-center">
        <HeadingTag className="text-3xl font-medium tracking-tight text-muted-foreground text-pretty sm:text-4xl lg:text-5xl">
          Real impact on{" "}
          <span className="text-foreground">real businesses.</span>
        </HeadingTag>
      </div>

      <div
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="relative w-full border-y border-border bg-card select-none touch-pan-y"
      >
        <div className="grid w-full grid-cols-1 divide-y divide-border sm:h-[440px] sm:divide-y-0 lg:h-[440px] lg:grid-cols-12 lg:divide-x lg:divide-border">
          {/* ── First Column: Large Image (B&W default, color on hover, smooth cross-fade) ─── */}
          <div className="group/img relative hidden h-[320px] w-full cursor-pointer items-center justify-center overflow-hidden bg-muted sm:h-[380px] lg:col-span-3 lg:flex lg:h-full">
            <AnimatePresence initial={false}>
              <motion.div
                key={current.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className="absolute inset-0 size-full"
              >
                <img
                  src={current.image}
                  alt={`${current.name}, ${current.role} at ${current.company}`}
                  className="size-full object-cover object-center grayscale contrast-[1.05] transition-all duration-500 ease-out group-hover/img:grayscale-0 group-hover/img:contrast-100"
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Second Column: Testimonial Quote & Person Info ────────────── */}
          <div className="flex h-full flex-col justify-between overflow-hidden bg-card p-8 sm:p-0 sm:pt-10 lg:col-span-6 lg:p-10">
            <div className="flex h-full flex-col justify-between gap-6 sm:gap-0 lg:gap-6">
              {/* Quote — isolated animation */}
              <div className="min-h-60 sm:min-h-0 sm:flex-1 sm:px-10 sm:pb-6 lg:p-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.blockquote
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="text-lg leading-relaxed font-normal text-foreground text-pretty sm:text-xl"
                  >
                    “{current.quote}”
                  </motion.blockquote>
                </AnimatePresence>
              </div>

              {/* Mobile Metrics Row — container and labels are static */}
              <div className="-mx-8 flex divide-x divide-border border-y border-border bg-card sm:mx-0 sm:border-b-0 lg:hidden">
                <div className="flex flex-1 flex-col items-center justify-center px-6 py-5 sm:px-10 md:items-start">
                  <span className="text-xs font-normal text-muted-foreground">
                    Conversion Rate
                  </span>
                  <div className="mt-2 flex flex-col items-center md:items-start">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`m-conv-${current.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="flex flex-col items-center gap-1 md:flex-row md:items-baseline md:gap-3"
                      >
                        <span className="text-[clamp(1.25rem,7vw,1.875rem)] font-medium tracking-tight text-foreground tabular-nums">
                          {current.conversionRate.value}
                        </span>
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <TrendingUp
                            className="size-4 shrink-0"
                            strokeWidth={1.75}
                          />
                          <span className="text-sm font-medium">
                            {current.conversionRate.change}
                          </span>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center px-6 py-5 sm:px-10 md:items-start">
                  <span className="text-xs font-normal text-muted-foreground">
                    Avg. Sales Cycle
                  </span>
                  <div className="mt-2 flex flex-col items-center md:items-start">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={`m-cycle-${current.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="flex flex-col items-center gap-1 md:flex-row md:items-baseline md:gap-3"
                      >
                        <span className="text-[clamp(1.25rem,7vw,1.875rem)] font-medium tracking-tight text-foreground tabular-nums">
                          {current.salesCycle.value.replace(" days", "D")}
                        </span>
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                          <TrendingDown
                            className="size-4 shrink-0"
                            strokeWidth={1.75}
                          />
                          <span className="text-sm font-medium">
                            {current.salesCycle.change}
                          </span>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Author Info & Tablet Arrow Controls Bar — bar and buttons are static */}
              <div className="flex items-stretch justify-between sm:border-t sm:border-border lg:border-t-0">
                <div className="flex items-center gap-3 sm:px-10 sm:py-5 lg:p-0">
                  {/* Small avatar with cross-fade & b/w hover filter */}
                  <div className="group/avatar relative size-11 shrink-0 cursor-pointer overflow-hidden rounded bg-muted lg:hidden">
                    <AnimatePresence initial={false}>
                      <motion.div
                        key={current.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="absolute inset-0 size-full"
                      >
                        <img
                          src={current.image}
                          alt={current.name}
                          className="size-full object-cover object-center grayscale contrast-[1.05] transition-all duration-500 ease-out group-hover/avatar:grayscale-0 group-hover/avatar:contrast-100"
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Author text animation */}
                  <div className="flex flex-col gap-0.5">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={current.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        className="flex flex-col gap-0.5"
                      >
                        <span className="text-base font-medium text-foreground">
                          {current.name}
                        </span>
                        <span className="text-sm font-normal text-muted-foreground">
                          {current.role}, {current.company}
                        </span>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Tablet Arrow Controls — Static, never unmounts or fades */}
                <div className="hidden shrink-0 grid-cols-2 divide-x divide-border border-l border-border self-stretch sm:grid lg:hidden">
                  <button
                    type="button"
                    onClick={handlePrev}
                    aria-label="Previous testimonial"
                    className="group flex aspect-square h-full cursor-pointer items-center justify-center bg-card transition-colors hover:bg-muted active:bg-muted/80"
                  >
                    <ArrowLeft className="size-5 text-muted-foreground transition-transform duration-100 ease-out group-hover:-translate-x-0.5 group-hover:text-foreground active:scale-95" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    aria-label="Next testimonial"
                    className="group relative flex aspect-square h-full cursor-pointer items-center justify-center overflow-hidden bg-card transition-colors hover:bg-muted active:bg-muted/80"
                  >
                    <ArrowRight className="size-5 text-muted-foreground transition-transform duration-100 ease-out group-hover:translate-x-0.5 group-hover:text-foreground active:scale-95" />
                    {/* Tablet autoscroll progress line */}
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-transparent">
                      <motion.div
                        key={`tablet-timer-${currentIndex}-${timerKey}`}
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{
                          duration: AUTO_SCROLL_DURATION / 1000,
                          ease: "linear",
                        }}
                        className="h-full bg-primary"
                      />
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Third Column: Three Rows (2 Metrics + Controls) ──────── */}
          <div className="hidden h-full grid-rows-3 divide-y divide-border lg:col-span-3 lg:grid">
            {/* Row 1: Conversion Rate Metric */}
            <div className="flex flex-col justify-center bg-card p-6">
              <span className="text-sm font-normal text-muted-foreground">
                Conversion Rate
              </span>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`conv-${current.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="mt-4 flex items-baseline justify-between gap-3"
                >
                  <span className="text-5xl font-medium tracking-tight text-foreground tabular-nums">
                    {current.conversionRate.value}
                  </span>

                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp
                      className="size-5 shrink-0"
                      strokeWidth={1.75}
                    />
                    <span className="text-lg font-medium tracking-tight">
                      {current.conversionRate.change}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Row 2: Avg Sales Cycle Metric */}
            <div className="flex flex-col justify-center bg-card p-6">
              <span className="text-sm font-normal text-muted-foreground">
                Avg. Sales Cycle
              </span>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`cycle-${current.id}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="mt-4 flex items-baseline justify-between gap-3"
                >
                  <span className="text-5xl font-medium tracking-tight text-foreground tabular-nums">
                    {current.salesCycle.value}
                  </span>

                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <TrendingDown
                      className="size-5 shrink-0"
                      strokeWidth={1.75}
                    />
                    <span className="text-lg font-medium tracking-tight">
                      {current.salesCycle.change}
                    </span>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Row 3: Split Button Container (Each half is a button) */}
            <div className="grid h-full grid-cols-2 divide-x divide-border">
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous testimonial"
                className="group flex size-full cursor-pointer items-center justify-center bg-card transition-colors duration-200 hover:bg-muted active:bg-muted/80"
              >
                <ArrowLeft className="size-6 text-muted-foreground transition-transform duration-100 ease-out group-hover:-translate-x-1 group-hover:text-foreground active:scale-95" />
              </button>

              <button
                type="button"
                onClick={handleNext}
                aria-label="Next testimonial"
                className="group relative flex size-full cursor-pointer items-center justify-center overflow-hidden bg-card transition-colors duration-200 hover:bg-muted active:bg-muted/80"
              >
                <ArrowRight className="size-6 text-muted-foreground transition-transform duration-100 ease-out group-hover:translate-x-1 group-hover:text-foreground active:scale-95" />

                {/* Auto-scroll progress timer line at the bottom of the next button */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 bg-transparent">
                  <motion.div
                    key={`timer-${currentIndex}-${timerKey}`}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{
                      duration: AUTO_SCROLL_DURATION / 1000,
                      ease: "linear",
                    }}
                    className="h-full bg-primary"
                  />
                </div>
              </button>
            </div>
          </div>

          {/* Auto-scroll progress line spanning the bottom of the whole section on mobile only */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-1 overflow-hidden bg-muted sm:hidden">
            <motion.div
              key={`progress-full-${currentIndex}-${timerKey}`}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{
                duration: AUTO_SCROLL_DURATION / 1000,
                ease: "linear",
              }}
              className="h-full bg-primary"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
