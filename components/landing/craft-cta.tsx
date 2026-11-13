import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export const CraftCta = () => (
    <section className="relative py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-card/80 to-muted/30 p-8 text-center sm:p-14 md:p-20 shadow-xl">
          {/* Subtle glow */}
          <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
            <div className="h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          </div>

          <div className="mx-auto max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3.5 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" />
              <span>Instant Setup</span>
            </div>

            <h2 className="mt-6 text-3xl font-extrabold tracking-tight sm:text-5xl">
              Start building your next SaaS landing page today.
            </h2>

            <p className="mt-4 text-base text-muted-foreground sm:text-lg">
              Explore the entire collection of production-ready components, or
              unlock all Pro kits with a lifetime license.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="rounded-full px-8 font-medium"
              >
                <Link href={ROUTES.BROWSE}>
                  Browse Registry <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="rounded-full px-7 font-medium"
              >
                <Link href={ROUTES.PRICING}>View Pricing</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
