import type * as React from "react";

import { cn } from "@/lib/utils";

// Base UI has no AspectRatio: the CSS property does it. `relative` keeps
// fill-images (next/image `fill`) inside the box.
const AspectRatio = ({
  ratio = 1,
  className,
  style,
  ...props
}: React.ComponentProps<"div"> & { ratio?: number }) => (
  <div
    data-slot="aspect-ratio"
    className={cn("relative w-full", className)}
    style={{ aspectRatio: ratio, ...style }}
    {...props}
  />
);

export { AspectRatio };
