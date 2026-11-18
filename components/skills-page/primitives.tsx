"use client";

import { motion, useReducedMotion } from "motion/react";
import type * as React from "react";

import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Shared pieces of the skill marketing pages (/skills/…): the 12-column
// grid, section headings, handwritten notes and the sketched arrows that
// draw in once as they scroll into view.

/** The page grid: 12 columns from md, one column on phones. */
export const GRID = "grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-12";

/** A keyword that steers the skill: bold, in brand blue. */
export const K = ({ children }: { children: React.ReactNode }) => (
  <strong className="text-brand-text font-semibold">{children}</strong>
);

/** Inline code: a file, a command, a prop. */
export const C = ({ children }: { children: React.ReactNode }) => (
  <code className="bg-surface dark:bg-card text-foreground rounded px-1.5 py-0.5 font-mono text-[0.875em]">
    {children}
  </code>
);

/** A small uppercase label over a heading. */
export const Eyebrow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <p
    className={cn(
      TYPE.cardEyebrow,
      "text-brand-text font-medium tracking-wide uppercase",
      className
    )}
  >
    {children}
  </p>
);

/** A handwritten margin note (Caveat), in brand blue. */
export const Note = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <span
    className={cn(
      "font-hand text-brand-text text-xl leading-tight font-semibold md:text-2xl",
      className
    )}
    // Inline too: a dev server's CSS can lag the font-hand theme token.
    style={{ fontFamily: "var(--font-hand)" }}
  >
    {children}
  </span>
);

/**
 * A sketched arrow: a hand-drawn curve with an open head, drawn in once
 * when it scrolls into view (shown whole under reduced motion).
 */
export const Arrow = ({
  d,
  head,
  className,
  viewBox = "0 0 120 60",
  delay = 0,
}: {
  d: string;
  head: string;
  className?: string;
  viewBox?: string;
  delay?: number;
}) => {
  const reduced = useReducedMotion();
  const draw = (extra: number) =>
    reduced
      ? {}
      : {
          initial: { pathLength: 0 },
          transition: {
            delay: delay + extra,
            duration: extra ? 0.2 : 0.7,
            ease: [0.65, 0, 0.35, 1] as const,
          },
          viewport: { amount: 0.8, once: true },
          whileInView: { pathLength: 1 },
        };
  return (
    <svg
      aria-hidden="true"
      className={cn("text-brand-text pointer-events-none", className)}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox={viewBox}
    >
      <motion.path d={d} {...draw(0)} />
      <motion.path d={head} {...draw(0.7)} />
    </svg>
  );
};

/** A section's heading row: title on the left, an optional aside on the right. */
export const SectionHead = ({
  id,
  eyebrow,
  title,
  aside,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  aside?: React.ReactNode;
}) => (
  <>
    <div className="flex flex-col gap-3 md:col-span-7">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2
        className={cn(
          TYPE.headingSection,
          "scroll-mt-24 font-semibold tracking-tight text-balance"
        )}
        id={id}
      >
        {title}
      </h2>
    </div>
    {aside ? (
      <p
        className={cn(
          TYPE.cardBody,
          "text-muted-foreground text-pretty md:col-span-4 md:col-start-9 md:self-end"
        )}
      >
        {aside}
      </p>
    ) : null}
  </>
);

/** A bento tile: a card surface with a title and a line of copy. */
export const Tile = ({
  title,
  body,
  className,
  children,
}: {
  title: string;
  body: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      "bg-card shadow-card relative flex flex-col overflow-hidden rounded-2xl",
      className
    )}
  >
    <div className="relative flex flex-1 items-center justify-center p-6">
      {children}
    </div>
    <div className="flex flex-col gap-1 px-6 pb-6">
      <p className={cn(TYPE.cardHeader, "font-medium")}>{title}</p>
      <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
        {body}
      </p>
    </div>
  </div>
);
