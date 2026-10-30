"use client";

/* oxlint-disable func-style, sort-keys, no-inline-comments, nextjs/no-img-element, prefer-destructuring */

import { ArrowLeft, ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface TestimonialAuthor {
  /** The customer's full name, e.g. "Sam Davies". */
  name: string;
  /** Their job title or role, e.g. "VP of Revenue Operations". */
  role: string;
  /** Their company or organization, e.g. "Lattice Corp.". */
  company: string;
  /** Portrait photo URL. Rendered as a square monochrome avatar. */
  avatar: string;
}

export interface TestimonialItem {
  /** Unique identifier for the story. */
  id: string;
  /** Author details including name, role, company and avatar. */
  author: TestimonialAuthor;
  /** Customer quote text. Displayed enclosed in quotation marks. */
  quote: string;
}

const DEFAULT_TESTIMONIALS: TestimonialItem[] = [
  {
    id: "sam-davies",
    author: {
      name: "Sam Davies",
      role: "VP of Revenue Operations",
      company: "Lattice Corp.",
      avatar:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80",
    },
    quote:
      "Before automating our pipelines, deals would sit untouched for days before an AE noticed. Lattice flags bottlenecks immediately and prepares follow-ups automatically. Our team closes more qualified accounts every month with significantly less manual CRM hygiene.",
  },
  {
    id: "elena-rostova",
    author: {
      name: "Elena Rostova",
      role: "VP of Operations",
      company: "Stratum Dynamics",
      avatar:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80",
    },
    quote:
      "Before automating our pipelines, deals would sit untouched for days before an AE noticed. Lattice flags bottlenecks immediately and prepares follow-ups automatically. Our team closes more qualified accounts every month with significantly less manual CRM hygiene.",
  },
  {
    id: "marcus-vance",
    author: {
      name: "Marcus Vance",
      role: "Chief Technology Officer",
      company: "Vance Systems",
      avatar:
        "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=80",
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
      avatar:
        "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80",
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
      avatar:
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&auto=format&fit=crop&q=80",
    },
    quote:
      "The attention to detail and performance consistency across high-load operations has exceeded all our expectations. It is easily the most dependable foundational layer we have adopted.",
  },
];

export interface TestimonialsSection02Props extends Omit<
  ComponentProps<"section">,
  "title"
> {
  /** Main section heading. Defaults to "Trusted by Teams". */
  title?: ReactNode;
  /** Customer testimonial items. If omitted, default sample stories are shown. If passed as an empty array, no stories are rendered. */
  testimonials?: TestimonialItem[];
  /** The heading's level: 1 when this is the page's main heading, 2 or 3 to fit under the page's own. Defaults to 2. */
  headingLevel?: 1 | 2 | 3;
}

export default function TestimonialsSection02({
  className,
  title = "Trusted by Teams",
  testimonials,
  headingLevel = 2,
  ...props
}: TestimonialsSection02Props) {
  // If testimonials prop is not passed (undefined), load sample data.
  // If an empty array [] is explicitly passed, do not load sample data.
  const items =
    testimonials === undefined ? DEFAULT_TESTIMONIALS : testimonials;
  const HeadingTag = `h${headingLevel}` as const;
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);
    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
    };
  }, [items]);

  const handleScroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const cardWidth =
      el.querySelector<HTMLElement>("[data-testimonial-card]")?.offsetWidth ??
      440;
    const scrollAmount = (cardWidth + 24) * (direction === "left" ? -1 : 1);
    el.scrollBy({ left: scrollAmount, behavior: "smooth" });
  };

  return (
    <section
      data-slot="testimonials-section-02"
      className={cn(
        "relative flex min-h-screen w-full flex-col justify-center bg-background py-12 text-foreground",
        className
      )}
      {...props}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header row: Title on left, Carousel controls on right */}
        <div className="flex items-center justify-between gap-4">
          <HeadingTag className="text-3xl font-medium tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            {title}
          </HeadingTag>

          {items.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleScroll("left")}
                aria-label="Previous testimonials"
                disabled={!canScrollLeft}
                className={cn(
                  "flex size-12 sm:size-14 items-center justify-center border border-border bg-background text-foreground rounded-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  canScrollLeft
                    ? "cursor-pointer hover:bg-muted group"
                    : "opacity-35"
                )}
              >
                <ArrowLeft className="size-6 group-active:scale-x-110 group-active:-translate-x-0.5 transition-transform duration-150" />
              </button>

              <button
                type="button"
                onClick={() => handleScroll("right")}
                aria-label="Next testimonials"
                disabled={!canScrollRight}
                className={cn(
                  "flex size-12 sm:size-14 items-center justify-center border border-border bg-background text-foreground rounded-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  canScrollRight
                    ? "cursor-pointer hover:bg-muted group"
                    : "opacity-35"
                )}
              >
                <ArrowRight className="size-6 group-active:scale-x-110 group-active:translate-x-0.5 transition-transform duration-150" />
              </button>
            </div>
          )}
        </div>

        {/* Testimonials horizontal scroll track */}
        {items.length > 0 ? (
          <div
            ref={scrollRef}
            className="mt-24 flex gap-6 overflow-x-auto  snap-x snap-mandatory scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item, index) => (
              <motion.figure
                key={item.id}
                data-testimonial-card
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.2,
                  delay: index * 0.05,
                  ease: "easeOut",
                }}
                className="group flex w-[30vw] shrink-0 snap-start flex-col justify-between border border-border bg-background p-8 rounded-none sm:max-w-none"
              >
                {/* Quote with opening and closing quotation marks */}
                <blockquote className="text-base sm:text-lg font-normal leading-[1.65] text-foreground">
                  &ldquo; {item.quote} &rdquo;
                </blockquote>

                {/* Author row at bottom */}
                <figcaption className="mt-8 sm:mt-12 flex items-center gap-4">
                  <img
                    src={item.author.avatar}
                    alt={item.author.name}
                    className="size-16 shrink-0 rounded-none object-cover grayscale transition-all duration-300 ease-out group-hover:grayscale-0 hover:grayscale-0"
                    loading="lazy"
                  />
                  <div className="min-w-0">
                    <div className="text-base sm:text-lg font-medium text-foreground tracking-tight">
                      {item.author.name}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {item.author.role}
                    </div>
                    <div className="text-xs  text-muted-foreground">
                      {item.author.company}
                    </div>
                  </div>
                </figcaption>
              </motion.figure>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
