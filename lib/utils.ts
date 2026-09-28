import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

import { RHYTHM_SPACING } from "@/constants/rhythm";
import { SHADOW_TOKENS } from "@/constants/shadows";
import { SITE } from "@/constants/site";
import { TYPE_ROLES, TYPE_SIZES } from "@/constants/typography";

// Register the custom type scale as font sizes (without this, tailwind-merge
// reads `text-card-header-sm` as a text colour and drops e.g.
// `text-muted-foreground` next to it) and the rhythm units as spacing, so
// `gap-minor` / `py-section-sm` merge like any other gap or padding. The
// shadow tokens are registered too, or `shadow-card` reads as a shadow colour
// and never replaces the variant's own shadow.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      ease: ["out-strong", "in-out-strong"],
      shadow: [...SHADOW_TOKENS],
      spacing: [...RHYTHM_SPACING],
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
