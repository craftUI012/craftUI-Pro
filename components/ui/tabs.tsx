"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";

import type { FeedbackType } from "@/hooks/use-feedback";
import { useFeedback } from "@/hooks/use-feedback";
import { cn } from "@/lib/utils";

const Tabs = ({ className, ...props }: TabsPrimitive.Root.Props) => (
  <TabsPrimitive.Root
    data-slot="tabs"
    className={cn("flex flex-col gap-2", className)}
    {...props}
  />
);

// Arrow keys select the tab they move to (automatic activation), as Radix
// did; Base UI's default is manual. Pass activateOnFocus={false} to opt out.
const TabsList = ({
  className,
  activateOnFocus = true,
  ...props
}: TabsPrimitive.List.Props) => (
  <TabsPrimitive.List
    data-slot="tabs-list"
    activateOnFocus={activateOnFocus}
    className={cn(
      "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-0.75",
      className
    )}
    {...props}
  />
);

const TabsTrigger = ({
  className,
  onClick,
  sound,
  haptic,
  ...props
}: TabsPrimitive.Tab.Props & {
  sound?: FeedbackType;
  haptic?: boolean;
}) => {
  const play = useFeedback({ haptic, sound });

  const handleClick: TabsPrimitive.Tab.Props["onClick"] = (e) => {
    play();
    onClick?.(e);
  };

  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      onClick={handleClick}
      className={cn(
        "data-active:bg-background dark:data-active:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring dark:data-active:border-input dark:data-active:bg-input/30 text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 data-active:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    />
  );
};

const TabsContent = ({ className, ...props }: TabsPrimitive.Panel.Props) => (
  <TabsPrimitive.Panel
    data-slot="tabs-content"
    className={cn("flex-1 outline-none", className)}
    {...props}
  />
);

export { Tabs, TabsContent, TabsList, TabsTrigger };
