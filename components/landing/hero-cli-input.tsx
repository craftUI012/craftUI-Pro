"use client";

import { Check, Copy, Terminal } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const HeroCliInput = ({
  command = "npx shadcn add @craftui/hero-section",
  className,
}: {
  command?: string;
  className?: string;
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div
      className={cn(
        "group relative flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 px-3.5 py-1.5 font-mono text-xs text-muted-foreground shadow-xs transition hover:border-border hover:bg-muted/70",
        className
      )}
    >
      <Terminal className="size-3.5 text-primary/80" />
      <span className="select-all text-foreground/90">{command}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 rounded-full hover:bg-background/80"
        onClick={handleCopy}
        aria-label="Copy install command"
      >
        {copied ? (
          <Check className="size-3 text-emerald-500" />
        ) : (
          <Copy className="size-3 text-muted-foreground transition group-hover:text-foreground" />
        )}
      </Button>
    </div>
  );
};
