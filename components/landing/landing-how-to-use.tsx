"use client";

import { Check, Copy, Sparkles } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    description:
      "Explore the live interactive catalog. Preview animations, test responsiveness, and pick the components that fit your SaaS product.",
    step: "01",
    title: "Browse & choose",
  },
  {
    description:
      "Use the official shadcn CLI to pull components directly into your codebase. No manual dependency wiring needed.",
    step: "02",
    title: "One-command install",
  },
  {
    description:
      "The source code lives directly in your repository. Tweak Tailwind classes, modify Motion physics, and deploy with zero vendor lock-in.",
    step: "03",
    title: "Customize & ship",
  },
];

const PACKAGERS = [
  {
    cmd: "pnpm dlx shadcn@latest add @craftui/hero-section",
    id: "pnpm",
    label: "pnpm",
  },
  {
    cmd: "npx shadcn@latest add @craftui/hero-section",
    id: "npm",
    label: "npx",
  },
  {
    cmd: "bunx --bun shadcn@latest add @craftui/hero-section",
    id: "bun",
    label: "bun",
  },
  {
    cmd: "yarn dlx shadcn@latest add @craftui/hero-section",
    id: "yarn",
    label: "yarn",
  },
];

export const LandingHowToUse = () => {
  const [activePkg, setActivePkg] = React.useState("pnpm");
  const [copied, setCopied] = React.useState(false);

  const currentCmd =
    PACKAGERS.find((p) => p.id === activePkg)?.cmd || PACKAGERS[0].cmd;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <section
      id="how-to-use"
      className="relative py-20 md:py-28 bg-muted/20 border-y border-border/50"
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            className="mb-3 rounded-full px-3 py-1 text-xs"
          >
            Workflow
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Up and running in less than 2 minutes
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            No bloated npm packages, no CSS fighting. Pure React components
            installed straight into your project.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
          {STEPS.map((step) => (
            <div
              key={step.step}
              className="relative flex flex-col rounded-3xl border border-border/80 bg-card/60 p-8 shadow-xs backdrop-blur-xs transition hover:border-border hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-semibold text-primary">
                  STEP {step.step}
                </span>
                <Sparkles className="size-4 text-muted-foreground/60" />
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight text-foreground">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </div>
          ))}
        </div>

        {/* Terminal Demo Box */}
        <div className="mt-12 mx-auto max-w-3xl overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg">
          {/* Terminal Window Header */}
          <div className="flex items-center justify-between border-b border-border/60 bg-muted/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-red-500/80 inline-block" />
              <span className="size-3 rounded-full bg-yellow-500/80 inline-block" />
              <span className="size-3 rounded-full bg-green-500/80 inline-block" />
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                Terminal
              </span>
            </div>

            {/* Package Manager Pills */}
            <div className="flex items-center gap-1 rounded-lg bg-background/60 p-0.5 border border-border/60">
              {PACKAGERS.map((pkg) => (
                <button
                  key={pkg.id}
                  onClick={() => setActivePkg(pkg.id)}
                  className={`rounded-md px-2.5 py-1 text-xs font-mono transition ${
                    activePkg === pkg.id
                      ? "bg-primary text-primary-foreground font-medium shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {pkg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Terminal Content */}
          <div className="flex items-center justify-between p-5 font-mono text-xs sm:text-sm">
            <div className="flex items-center gap-3 overflow-x-auto">
              <span className="text-primary font-bold select-none">$</span>
              <span className="text-foreground select-all">{currentCmd}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="ml-4 shrink-0 rounded-lg"
              aria-label="Copy terminal command"
            >
              {copied ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-500">
                  <Check className="size-3.5" /> Copied
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <Copy className="size-3.5" /> Copy
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
