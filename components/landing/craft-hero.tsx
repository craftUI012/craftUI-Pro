import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export const CraftHero = () => (
  <section
    aria-labelledby="hero-heading"
    className="relative flex min-h-[calc(100svh-6.5rem)] items-center overflow-hidden py-12 lg:min-h-[calc(100svh-var(--header-height))] lg:py-0"
  >
    {/* Full viewport hero: subtract the sticky navbar so the next section
        doesn't peek in. Below lg the navbar wraps to two rows, so reserve more. */}
    {/* Background ambient radial glow */}
    <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
      <div className="h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-primary/10 via-primary/5 to-transparent blur-3xl" />
    </div>

    <div className="container mx-auto flex flex-col items-center px-4 text-center">
      {/* Eyebrow Announcement Pill */}
      <Link
        href={ROUTES.BROWSE}
        className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-4 py-2 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur-md transition hover:border-border hover:bg-muted/50 hover:text-foreground"
      >
        <Sparkles className="size-3.5 text-primary" />
        <span>Explore 100+ production-ready blocks & isometric art</span>
        <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>

      {/* Main H1 Title */}
      <h1
        id="hero-heading"
        className="mt-8  text-2xl font-semibold sm:text-6xl md:text-6xl"
      >
        UI library to craft
        <br />
        not-so-ordinary websites.
      </h1>

      {/* Subtitle */}
      <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-base md:text-base text-balance">
        Production-ready sections, layouts and components, designed to make your
        next website stand out.
      </p>

      {/* Action Row — the shared site Button: large size, default/outline
          variants, with its own click sound, radius and brand shadow. */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button asChild size="lg" sound="click">
          <Link href={ROUTES.BROWSE}>
            Browse
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>

        <Button asChild size="lg" variant="outline" sound="click">
          <Link href={ROUTES.PRICING}>
            Get Pro
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </div>

      {/* Placeholder window — whatever goes in here comes later. */}
      <div
        aria-hidden="true"
        className="mt-12 w-full max-w-6xl overflow-hidden rounded-xl border border-border/80 bg-card shadow-card md:mt-16"
      >
        <div className="flex h-9 items-center gap-1.5 border-b border-border/80 bg-muted/30 px-4">
          <span className="size-2.5 rounded-full bg-foreground/20" />
          <span className="size-2.5 rounded-full bg-foreground/25" />
          <span className="size-2.5 rounded-full bg-foreground/30" />
        </div>
        <div className="aspect-[4/3] w-full bg-muted/20 md:aspect-[12/5]" />
      </div>
    </div>
  </section>
);
