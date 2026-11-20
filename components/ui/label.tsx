import type * as React from "react";

import { cn } from "@/lib/utils";

// Base UI has no Label primitive: a native <label> does the job (inside a
// Base UI Field, use Field.Label instead).
const Label = ({ className, ...props }: React.ComponentProps<"label">) => (
  // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- the caller passes htmlFor or wraps the control
  <label
    data-slot="label"
    className={cn(
      "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      className
    )}
    {...props}
  />
);

export { Label };
