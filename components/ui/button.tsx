"use client";

import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import type { FeedbackType } from "@/hooks/use-feedback";
import { useFeedback } from "@/hooks/use-feedback";
import { cn } from "@/lib/utils";

// Polish built into every button (make-interfaces-feel-better):
// - Press: scales to 0.96 while held (`static` turns it off; reduced motion
//   keeps it still). Transitions name their properties, never `all`.
// - Optical padding: mark an icon with data-icon="inline-start" or
//   "inline-end" and the side without the icon gets 1px more padding, so the
//   label doesn't look pushed toward the edge.
// - Hit area: sizes under 40px (sm, icon-sm, icon) extend their target to
//   40px with an invisible pseudo-element.
const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[color,background-color,box-shadow,scale] duration-150 ease-out-strong active:scale-[0.96] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default:
          "h-9 px-4 py-2 has-[>svg]:px-3 has-data-[icon=inline-start]:pr-[calc(--spacing(3)+1px)] has-data-[icon=inline-end]:pl-[calc(--spacing(3)+1px)]",
        icon: "size-9 after:absolute after:-inset-0.5",
        "icon-lg": "size-10",
        "icon-sm": "size-8 after:absolute after:-inset-1",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4 has-data-[icon=inline-start]:pr-[calc(--spacing(4)+1px)] has-data-[icon=inline-end]:pl-[calc(--spacing(4)+1px)]",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 has-data-[icon=inline-start]:pr-[calc(--spacing(2.5)+1px)] has-data-[icon=inline-end]:pl-[calc(--spacing(2.5)+1px)] after:absolute after:inset-x-0 after:-inset-y-1",
      },
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-button-primary hover:bg-primary/90 hover:shadow-button-primary-hover",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",
        outline:
          "bg-background shadow-button-secondary hover:bg-accent hover:text-accent-foreground hover:shadow-button-secondary-hover dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground shadow-button-secondary hover:bg-secondary/80 hover:shadow-button-secondary-hover",
      },
    },
  }
);

export interface ButtonProps
  extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  sound?: FeedbackType;
  haptic?: boolean;
  // Skip the press scale, where motion would distract (dense toolbars).
  static?: boolean;
}

const Button = ({
  className,
  variant,
  size,
  asChild = false,
  sound,
  haptic,
  static: isStatic = false,
  onClick,
  ...props
}: ButtonProps) => {
  const play = useFeedback({ haptic, sound });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    play();
    onClick?.(e);
  };

  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      data-size={size}
      data-variant={variant}
      className={cn(
        buttonVariants({ size, variant }),
        isStatic && "active:scale-100",
        className
      )}
      onClick={handleClick}
      {...props}
    />
  );
};

export { Button, buttonVariants };
