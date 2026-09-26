import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { SITE } from "@/constants/site";
import { TYPE_ROLES, TYPE_SIZES } from "@/constants/typography";

// Register the custom type scale as font sizes. Without this, tailwind-merge
// reads `text-card-header-sm` as a text colour and drops e.g.
// `text-muted-foreground` sitting next to it.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: TYPE_ROLES.flatMap((role) =>
        TYPE_SIZES.map((size) => `${role}-${size}`)
      ),
    },
  },
});

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const absoluteUrl = (path: string) => `${SITE.URL}${path}`;

export const formatLabelFromSlug = (slug: string) =>
  slug
    .split("-")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
