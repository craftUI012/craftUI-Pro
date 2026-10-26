import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";

import { cn } from "@/lib/utils";

// craftUI's own icon: a Hugeicons icon (@hugeicons/core-free-icons) at one
// of the site's icon sizes, with the stroke from the --icon-stroke token, so
// the line stays proportional to the size (styles/globals.css, shown on
// /design-admin). For the site's UI only: registry components keep their
// own icons and imports, since buyers install those.
//
//   import { ViewIcon } from "@hugeicons/core-free-icons";
//   <Icon icon={ViewIcon} />            16px (sm)
//   <Icon icon={ViewIcon} size="lg" />  24px

export type IconSvg = React.ComponentProps<typeof HugeiconsIcon>["icon"];

export type IconSize = "sm" | "md" | "lg";

// Each size: the token class, and the same size in px for the SVG's own
// width/height. The token wins when the stylesheet is loaded; the px values
// keep icons the right size if it isn't (a stale dev stylesheet, say).
const SIZES: Record<IconSize, { className: string; px: number }> = {
  lg: { className: "size-(--icon-size-lg)", px: 24 },
  md: { className: "size-(--icon-size-md)", px: 20 },
  sm: { className: "size-(--icon-size-sm)", px: 16 },
};

// The --icon-stroke default, for the same reason.
const STROKE = 1.5;

export const Icon = ({
  className,
  icon,
  label,
  size = "sm",
}: {
  className?: string;
  icon: IconSvg;
  // Accessible name for icons that mean something on their own. Without
  // one, the icon is decorative and hidden from screen readers.
  label?: string;
  size?: IconSize;
}) => (
  <HugeiconsIcon
    icon={icon}
    size={SIZES[size].px}
    strokeWidth={STROKE}
    aria-hidden={label ? undefined : true}
    aria-label={label}
    role={label ? "img" : undefined}
    className={cn("site-icon shrink-0", SIZES[size].className, className)}
  />
);
