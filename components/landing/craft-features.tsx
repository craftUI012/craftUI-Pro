import { ArrowUpRight, Box, Component, Terminal } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

export const CraftFeatures = () => (
  <section className="relative py-16 md:py-24">
    <div className="container mx-auto px-4">
      {/* Section Header */}
      <div className="mx-auto max-w-2xl text-center">
        <Badge
          variant="outline"
          className="mb-3 rounded-full px-3 py-1 text-xs"
        >
          Built for modern SaaS
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to ship world-class UI
        </h2>
        <p className="mt-3 text-muted-foreground">
          Carefully crafted blocks with math-exact isometric geometry and smooth
          motion primitives.
        </p>
      </div>

      {/* 3-Column Bento Grid */}
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Card 1: Isometric Engine & Art */}
        <Card className="group relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-xs transition hover:border-border hover:shadow-md">
          <CardContent className="flex flex-col p-6 sm:p-8">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Box className="size-5" />
            </div>
            <h3 className="mt-5 text-xl font-semibold">
              Mathematical Isometric Art
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Vector 3D scenes for cloud, devtools, and fintech that load with
              zero WebGL overhead and razor-sharp SVG precision.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                IsoStage
              </span>
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                Cylinder
              </span>
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                Slab
              </span>
            </div>
            <div className="mt-8 pt-4 border-t border-border/50">
              <Link
                href={`${ROUTES.BROWSE}?library=isometric`}
                className="inline-flex items-center text-xs font-medium text-primary hover:underline"
              >
                Explore Isometric scenes{" "}
                <ArrowUpRight className="ml-1 size-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Production Sections */}
        <Card className="group relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-xs transition hover:border-border hover:shadow-md">
          <CardContent className="flex flex-col p-6 sm:p-8">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Component className="size-5" />
            </div>
            <h3 className="mt-5 text-xl font-semibold">
              Production-Ready Blocks
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Hero sections, Bento grids, pricing tables, testimonials, and
              interactive menus designed to convert visitors into customers.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                Hero Variants
              </span>
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                Bento Grids
              </span>
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                Motion Carousels
              </span>
            </div>
            <div className="mt-8 pt-4 border-t border-border/50">
              <Link
                href={`${ROUTES.BROWSE}?library=sections`}
                className="inline-flex items-center text-xs font-medium text-primary hover:underline"
              >
                Browse SaaS blocks <ArrowUpRight className="ml-1 size-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: 1-Command CLI & Ownership */}
        <Card className="group relative overflow-hidden border-border/80 bg-card/60 backdrop-blur-xs transition hover:border-border hover:shadow-md">
          <CardContent className="flex flex-col p-6 sm:p-8">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Terminal className="size-5" />
            </div>
            <h3 className="mt-5 text-xl font-semibold">100% Code Ownership</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              No npm package dependencies or black-box lock-in. Added directly
              into your codebase with the official shadcn CLI.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs">
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                Tailwind v4
              </span>
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                TypeScript
              </span>
              <span className="rounded-md bg-muted px-2.5 py-1 font-mono text-muted-foreground">
                Framer Motion
              </span>
            </div>
            <div className="mt-8 pt-4 border-t border-border/50">
              <Link
                href={ROUTES.DOCS_INSTALLATION}
                className="inline-flex items-center text-xs font-medium text-primary hover:underline"
              >
                Read installation guide{" "}
                <ArrowUpRight className="ml-1 size-3.5" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </section>
);
