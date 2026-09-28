import { FeaturesShowcase } from "@/components/hero-features/features-showcase";
import { RHYTHM } from "@/constants/rhythm";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Server entry for "Why craftUI": the case against a plain UI kit. Header,
// then the qualities every component is built with (details left, one
// illustration right; see features-showcase.tsx).
//
// Rhythm: minor inside the header text, major between header > showcase,
// section padding = 2 x major. No CTA here: it answers "why this library",
// and the templates section just above carries the Pro action.
export const FeaturesSection = () => (
  <section aria-labelledby="features-heading" className="container-wrapper">
    <div
      className={cn("container flex flex-col", RHYTHM.major, RHYTHM.section)}
    >
      <header className={cn("flex max-w-2xl flex-col", RHYTHM.minor)}>
        <span
          className={cn(TYPE.cardEyebrow, "text-muted-foreground uppercase")}
        >
          Why craftUI
        </span>
        <h2
          id="features-heading"
          className={cn(TYPE.headingSection, "text-balance")}
        >
          The details your customers notice, built into every component
        </h2>
        <p className={cn(TYPE.pageLead, "text-muted-foreground text-pretty")}>
          Most UI kits stop at how a component looks. Every craftUI component
          also handles access, motion, themes, screen sizes and the small
          details, so your product looks finished without a designer.
        </p>
      </header>

      <FeaturesShowcase />
    </div>
  </section>
);
