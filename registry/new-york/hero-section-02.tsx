import { ArrowRight, Check, Sparkles } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

// MOCK HERO, for the hero gallery layout only. A split hero: copy and two
// CTAs on the left, a drawn product panel on the right (no images, so it
// renders anywhere). Colours are the host's semantic tokens, so it follows
// the site's light/dark theme. Replace with a real design when one lands.

const POINTS = ["Copy-paste source", "Light and dark", "Keyboard ready"];

const BARS = [42, 64, 38, 80, 56, 92, 70];

const HeroSection02 = ({ className }: { className?: string }) => (
  <section
    className={cn(
      "bg-background text-foreground w-full px-6 py-16 sm:px-10 md:py-24",
      className
    )}
  >
    <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
      <div className="flex flex-col items-start gap-6">
        <span className="bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <Sparkles aria-hidden className="size-3.5" />
          New in v2
        </span>
        <h2 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Ship polished interfaces without starting from zero
        </h2>
        <p className="text-muted-foreground max-w-md text-base text-pretty sm:text-lg">
          Sections, blocks and components built to drop into a real product,
          tuned for motion, sound and every screen size.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/docs/installation"
            className="bg-primary text-primary-foreground inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium"
          >
            Get started
            <ArrowRight aria-hidden className="size-4" />
          </Link>
          <Link
            href="/docs"
            className="border-border inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium"
          >
            Browse library
          </Link>
        </div>
        <ul className="text-muted-foreground flex flex-wrap gap-x-5 gap-y-2 text-sm">
          {POINTS.map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <Check aria-hidden className="text-foreground size-4" />
              {point}
            </li>
          ))}
        </ul>
      </div>

      <div
        aria-hidden
        className="border-border bg-card rounded-xl border p-5 shadow-sm"
      >
        <div className="flex items-center gap-1.5 pb-4">
          <span className="bg-muted size-2.5 rounded-full" />
          <span className="bg-muted size-2.5 rounded-full" />
          <span className="bg-muted size-2.5 rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {["Revenue", "Users", "Uptime"].map((label, i) => (
            <div key={label} className="bg-muted/60 rounded-lg p-3">
              <p className="text-muted-foreground text-xs">{label}</p>
              <p className="pt-1 text-lg font-semibold">
                {["$48.2k", "12,940", "99.98%"][i]}
              </p>
            </div>
          ))}
        </div>
        <div className="bg-muted/60 mt-3 flex h-40 items-end gap-2 rounded-lg p-4">
          {BARS.map((height, i) => (
            <div
              // Static mock data: index is a stable key.
              // oxlint-disable-next-line no-array-index-key
              key={i}
              className="bg-primary/80 flex-1 rounded-sm"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  </section>
);

export default HeroSection02;
