"use client";

import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

const TooltipProvider = ({
  delay = 0,
  ...props
}: TooltipPrimitive.Provider.Props) => (
  <TooltipPrimitive.Provider
    data-slot="tooltip-provider"
    delay={delay}
    {...props}
  />
);

const Tooltip = ({ ...props }: TooltipPrimitive.Root.Props) => (
  <TooltipProvider>
    <TooltipPrimitive.Root data-slot="tooltip" {...props} />
  </TooltipProvider>
);

const TooltipTrigger = ({ ...props }: TooltipPrimitive.Trigger.Props) => (
  <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
);

// Positioning props belong to the Positioner: declared, destructured and
// forwarded, so they never fall through onto the Popup.
const TooltipContent = ({
  className,
  side = "top",
  sideOffset = 0,
  align = "center",
  alignOffset = 0,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<
    TooltipPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  >) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Positioner
      align={align}
      alignOffset={alignOffset}
      side={side}
      sideOffset={sideOffset}
      className="isolate z-50"
    >
      <TooltipPrimitive.Popup
        data-slot="tooltip-content"
        className={cn(
          "bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 ease-out-strong data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] data-[side=bottom]:top-1 data-[side=left]:top-1/2! data-[side=left]:-right-1 data-[side=left]:-translate-y-1/2 data-[side=right]:top-1/2! data-[side=right]:-left-1 data-[side=right]:-translate-y-1/2 data-[side=top]:-bottom-2.5" />
      </TooltipPrimitive.Popup>
    </TooltipPrimitive.Positioner>
  </TooltipPrimitive.Portal>
);

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
