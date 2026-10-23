export const FALLBACK_SITE_ORIGIN = "https://craftui-pro.vercel.app" as const;

// The site's public address comes from NEXT_PUBLIC_SITE_URL (.env locally,
// the host's environment variables in production). NEXT_PUBLIC_ makes it
// available to client components too, so server and browser always agree.
const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return "http://localhost:3000";
  }

  return FALLBACK_SITE_ORIGIN;
};

const baseUrl = getBaseUrl();

export const SITE = {
  AUTHOR: {
    NAME: "Indranil and Pranav",
  },
  DESCRIPTION: {
    // Longer copy for llms.txt, the RSS feed and structured data.
    LONG: "UI Blocks, components and landing page designs for businesses and SaaS products built with shadcn/ui, tailwindcss and Motion. Browse the collection and add any of them to your project with one command. It is device agnostic, responsive and production-ready.",
    // The meta description, social cards and app manifest. Search results
    // show about 155 characters, so it stays under that and leads with what
    // the site is.
    META: "Production-ready shadcn/ui sections, blocks, illustrations and isometric art for SaaS and startup sites. Built with Tailwind CSS and Motion.",
    SHORT:
      "Beautiful Landing pages, UI Blocks and components for businesses startups, and SaaS products focusing on conversion, accessibility and performance. Built with shadcn/ui, tailwindcss and Motion.",
  },
  KEYWORDS: [
    "craftUI",
    "shadcn",
    "shadcn/ui",
    "shadcn blocks",
    "shadcn registry",
    "landing page sections",
    "SaaS UI blocks",
    "illustrations",
    "isometric illustrations",
    "react components",
    "tailwindcss",
    "next.js",
    "npx shadcn add",
  ] as const,
  // Square logo for structured data and anywhere a crawler wants one
  // (512 × 512, on its light tile; built by `pnpm brand:icons`).
  LOGO: `${baseUrl}/logo/logo-512.png`,
  NAME: "craftUI",
  OG_IMAGE: `${baseUrl}/og`,
  REGISTRY: baseUrl,
  // The home page's title, after the name. Kept short: search results cut
  // titles at about 60 characters.
  TAGLINE: "shadcn/ui Sections, Blocks & Illustrations",
  URL: baseUrl,
};

export const META_THEME_COLORS = {
  dark: "#09090b",
  light: "#ffffff",
};

export const UTM_PARAMS = {
  utm_source: new URL(baseUrl).hostname,
};
