import type { MetadataRoute } from "next";

import { ROUTES } from "@/constants/routes";
import { SITE, META_THEME_COLORS } from "@/constants/site";

// Icons are built from public/logo by `pnpm brand:icons`. The plain ones are
// the mark on transparent; the maskable one is the mark on its dark tile, so
// Android can crop it to any shape without cutting into the mark.
export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: META_THEME_COLORS.dark,
    categories: ["design", "developer", "productivity"],
    description: SITE.DESCRIPTION.META,
    display: "standalone",
    icons: [
      {
        purpose: "any",
        sizes: "192x192",
        src: "/android-chrome-192x192.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "512x512",
        src: "/android-chrome-512x512.png",
        type: "image/png",
      },
      {
        purpose: "maskable",
        sizes: "512x512",
        src: "/android-chrome-maskable-512x512.png",
        type: "image/png",
      },
      {
        purpose: "any",
        sizes: "any",
        src: "/favicon.svg",
        type: "image/svg+xml",
      },
    ],
    id: ROUTES.HOME,
    lang: "en-US",
    name: `${SITE.NAME} – ${SITE.TAGLINE}`,
    short_name: SITE.NAME,
    start_url: ROUTES.HOME,
    theme_color: META_THEME_COLORS.light,
  };
}
