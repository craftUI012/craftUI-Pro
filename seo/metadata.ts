import type { Metadata } from "next";

import { LINK } from "@/constants/links";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";

interface CreatePageMetadataOptions {
  description?: string;
  noIndex?: boolean;
  ogDescription?: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogTitle?: string;
  ogType?: "article" | "website";
  path: string;
  title: string;
}

export const createPageMetadata = ({
  description,
  noIndex = false,
  ogDescription,
  ogImage,
  ogImageAlt,
  ogTitle,
  ogType = "website",
  path,
  title,
}: CreatePageMetadataOptions): Metadata => {
  const canonical = path.startsWith(ROUTES.HOME)
    ? path
    : `${ROUTES.HOME}${path}`;
  const markdownAlternate =
    canonical === ROUTES.DOCS || canonical.startsWith(`${ROUTES.DOCS}/`)
      ? `${canonical}.md`
      : undefined;
  const resolvedTitle = ogTitle ?? title;
  // Pages without their own card (docs pages pass theirs) get the site card
  // with their title and description: /og takes both as query params.
  const resolvedOgImage =
    ogImage ??
    `${ROUTES.OG}?${new URLSearchParams({
      title: resolvedTitle,
      ...((ogDescription ?? description) && {
        description: ogDescription ?? description,
      }),
    })}`;

  return {
    alternates: {
      canonical,
      ...(markdownAlternate && {
        types: {
          "text/markdown": markdownAlternate,
        },
      }),
    },
    description,
    openGraph: {
      description: ogDescription ?? description,
      images: [
        {
          alt: ogImageAlt ?? resolvedTitle,
          height: 630,
          url: resolvedOgImage,
          width: 1200,
        },
      ],
      locale: "en_US",
      siteName: SITE.NAME,
      title: resolvedTitle,
      type: ogType,
      url: `${SITE.URL}${canonical}`,
    },
    title,
    twitter: {
      card: "summary_large_image",
      description: ogDescription ?? description,
      images: [resolvedOgImage],
      title: resolvedTitle,
    },
    ...(noIndex
      ? {
          robots: {
            follow: false,
            googleBot: { follow: false, index: false },
            index: false,
          },
        }
      : {}),
  };
};

// Site-wide defaults, set once on the root layout. Every page inherits them
// and overrides what it knows better (title, description, canonical, card)
// through createPageMetadata.
//
// No canonical here on purpose: a default canonical would be inherited by
// every page that doesn't set its own, telling search engines those pages
// are copies of the home page. Pages set theirs (the home page included).
export const baseMetadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE.NAME,
  },
  applicationName: SITE.NAME,
  authors: [{ name: SITE.AUTHOR.NAME, url: LINK.GITHUB_ORG }],
  category: "technology",
  creator: SITE.AUTHOR.NAME,
  description: SITE.DESCRIPTION.META,
  formatDetection: { address: false, email: false, telephone: false },
  // Built from public/logo by `pnpm brand:icons`. The SVG is the sharpest
  // and is full colour, so it serves light and dark tabs alike; the .ico and
  // PNG are for browsers without SVG favicons.
  icons: {
    apple: {
      sizes: "180x180",
      type: "image/png",
      url: "/apple-touch-icon.png",
    },
    icon: [
      {
        sizes: "48x48",
        url: "/favicon.ico",
      },
      {
        sizes: "96x96",
        type: "image/png",
        url: "/favicon-96x96.png",
      },
      {
        sizes: "any",
        type: "image/svg+xml",
        url: "/favicon.svg",
      },
    ],
  },
  keywords: [...SITE.KEYWORDS],
  manifest: ROUTES.MANIFEST,
  metadataBase: new URL(SITE.URL),
  openGraph: {
    description: SITE.DESCRIPTION.META,
    images: [
      {
        alt: `${SITE.NAME}: ${SITE.TAGLINE}`,
        height: 630,
        url: SITE.OG_IMAGE,
        width: 1200,
      },
    ],
    locale: "en_US",
    siteName: SITE.NAME,
    title: `${SITE.NAME} – ${SITE.TAGLINE}`,
    type: "website",
    url: SITE.URL,
  },
  publisher: SITE.AUTHOR.NAME,
  // Let search engines show large image previews and full snippets.
  robots: {
    follow: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
    index: true,
  },
  title: {
    default: `${SITE.NAME} – ${SITE.TAGLINE}`,
    template: `%s | ${SITE.NAME}`,
  },
  twitter: {
    card: "summary_large_image",
    description: SITE.DESCRIPTION.META,
    images: [SITE.OG_IMAGE],
    title: `${SITE.NAME} – ${SITE.TAGLINE}`,
  },
  // Google Search Console ownership: <meta name="google-site-verification">
  // on every page. Keep it after verifying; removing it un-verifies the site.
  verification: {
    google: "pjJj0f3fm6sC8Sshy4wz7bHNGl1b0K7Mg-sZoT2pTOg",
  },
};
