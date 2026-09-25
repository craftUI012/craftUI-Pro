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
    LONG: "UI Blocks, components and landing page designs for businesses and SaaS products built with shadcn/ui, tailwindcss and Motion. Browse the collection and add any of them to your project with one command. It is device agnostic, responsive and production-ready.",
    SHORT:
      "Beautiful Landing pages, UI Blocks and components for businesses startups, and SaaS products focusing on conversion, accessibility and performance. Built with shadcn/ui, tailwindcss and Motion.",
  },
  KEYWORDS: [
    "craftUI Pro",
    "shadcn",
    "shadcn/ui",
    "shadcn registry",
    "react components",
    "tailwindcss",
    "next.js",
    "npx shadcn add",
  ] as const,
  NAME: "craftUI Pro",
  OG_IMAGE: `${baseUrl}/og`,
  REGISTRY: baseUrl,
  URL: baseUrl,
};

export const META_THEME_COLORS = {
  dark: "#09090b",
  light: "#ffffff",
};

export const UTM_PARAMS = {
  utm_source: new URL(baseUrl).hostname,
};
