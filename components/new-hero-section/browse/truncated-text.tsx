"use client";

import { useRef, useState } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Long enough that sweeping the pointer across the grid doesn't flash
// tooltips, short enough to feel like a response to hovering the text.
const DELAY_MS = 300;

// One line of text, cut off with "…" when it doesn't fit. Hovering shows the
// full text in a tooltip, but only when it was actually cut off.
export const TruncatedText = ({
  text,
  className,
}: {
  text: string;
  className?: string;
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const isTruncated = () => {
    const element = ref.current;
    return element ? element.scrollWidth > element.clientWidth : false;
  };

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => setOpen(next && isTruncated())}
      delayDuration={DELAY_MS}
    >
      <TooltipTrigger asChild>
        <span ref={ref} className={cn("truncate", className)}>
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={6}
        className="max-w-xs text-left text-pretty"
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
};
