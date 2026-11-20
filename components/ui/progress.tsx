"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";

import { cn } from "@/lib/utils";

// Base UI computes the fill itself (the Indicator's width), so there is no
// manual translate. `className` styles the bar (the Track), as it did before.
const Progress = ({ className, ...props }: ProgressPrimitive.Root.Props) => (
  <ProgressPrimitive.Root data-slot="progress" className="w-full" {...props}>
    <ProgressPrimitive.Track
      data-slot="progress-track"
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-primary/20",
        className
      )}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full bg-primary transition-[width]"
      />
    </ProgressPrimitive.Track>
  </ProgressPrimitive.Root>
);

export { Progress };
