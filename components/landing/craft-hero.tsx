import { ArrowRight, Box, Code2, Sparkles, Terminal } from "lucide-react";
import Link from "next/link";

import { HeroCliInput } from "@/components/landing/hero-cli-input";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

export const CraftHero = () => (
  <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-28">
    {/* Background ambient radial glow */}
    <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
      <div className="h-[40rem] w-[40rem] rounded-full bg-gradient-to-tr from-primary/10 via-primary/5 to-transparent blur-3xl" />
    </div>

    <div className="container mx-auto flex flex-col items-center px-4 text-center">
      {/* Eyebrow Announcement Pill */}
      <Link
        href={ROUTES.BROWSE}
        className="group inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/60 px-3.5 py-1 text-xs font-medium text-muted-foreground shadow-xs backdrop-blur-md transition hover:border-border hover:bg-muted/50 hover:text-foreground"
      >
        <Sparkles className="size-3.5 text-primary" />
        <span>Explore 100+ production-ready blocks & isometric art</span>
        <ArrowRight className="size-3 transition-transform duration-200 group-hover:translate-x-0.5" />
      </Link>

      {/* Main H1 Title */}
      <h1 className="mt-8 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl md:text-7xl">
        Craft landing pages that{" "}
        <span className="bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
          stand out
        </span>
        , not blend in.
      </h1>

      {/* Subtitle */}
      <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg md:text-xl">
        {SITE.DESCRIPTION.SHORT}
      </p>

      {/* Action Row */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        <Button
          asChild
          size="lg"
          className="rounded-full px-7 font-medium shadow-sm"
        >
          <Link href={ROUTES.BROWSE}>
            Explore Collection
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>

        <Button
          asChild
          variant="outline"
          size="lg"
          className="rounded-full px-6 font-medium"
        >
          <Link href={ROUTES.PRICING}>Pro Access</Link>
        </Button>

        <div className="w-full sm:w-auto">
          <HeroCliInput command="npx shadcn add @craftui/hero" />
        </div>
      </div>

      {/* Feature stats ticker */}
      <div className="mt-14 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground sm:gap-10 sm:text-sm">
        <div className="flex items-center gap-2">
          <Box className="size-4 text-primary" />
          <span>3D Isometric Art</span>
        </div>
        <div className="flex items-center gap-2">
          <Code2 className="size-4 text-primary" />
          <span>Tailwind CSS v4 & Motion</span>
        </div>
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-primary" />
          <span>1-Command shadcn CLI</span>
        </div>
      </div>
    </div>
  </section>
);
