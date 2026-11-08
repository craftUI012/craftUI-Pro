import { createMDX } from "fumadocs-mdx/next";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const { LINK } = await jiti.import("./constants/links");
const { ROUTES } = await jiti.import("./constants/routes");

/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  experimental: {
    viewTransition: true,
  },
  headers() {
    const link = [
      `<${ROUTES.API_CATALOG}>; rel="api-catalog"`,
      `<${ROUTES.OPENAPI}>; rel="service-desc"`,
      `<${ROUTES.DOCS}>; rel="service-doc"`,
      `<${LINK.SHADCN_MCP_DOCS}>; rel="service-doc"; title="shadcn MCP server"`,
      `<${ROUTES.AGENT_SKILLS_INDEX}>; rel="describedby"`,
    ].join(", ");

    return [{ headers: [{ key: "Link", value: link }], source: ROUTES.HOME }];
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatars.githubusercontent.com",
        protocol: "https",
      },
      {
        hostname: "images.unsplash.com",
        protocol: "https",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/*": ["./registry/**/*"],
    // Paid items' built JSON, served to buyers by app/r/[file]/route.ts.
    "/r/*": ["./registry-paid/**/*", "./public/r/**/*"],
  },
  redirects() {
    return [
      // The browse page and its docs moved from /homepage-new to / and /docs.
      // Temporary (307) for now, so browsers don't cache it.
      { destination: ROUTES.HOME, permanent: false, source: "/homepage-new" },
      {
        destination: `${ROUTES.DOCS}/:path*`,
        permanent: false,
        source: "/homepage-new/docs/:path*",
      },
      // The docs introduction became the about page. Its markdown mirrors
      // go there too: the page they mirrored is gone.
      { destination: ROUTES.ABOUT, permanent: true, source: ROUTES.DOCS },
      {
        destination: ROUTES.ABOUT,
        permanent: true,
        source: `${ROUTES.DOCS}.md`,
      },
      {
        destination: ROUTES.ABOUT,
        permanent: true,
        source: `${ROUTES.DOCS}.mdx`,
      },
      {
        destination: `${ROUTES.DOCS}/:path*.md`,
        permanent: true,
        source: `${ROUTES.DOCS}/:path*.mdx`,
      },
    ];
  },
  // PostHog's reverse proxy (instrumentation-client.ts sends to /relay), so
  // ad blockers don't drop events. US region hosts.
  rewrites() {
    return [
      {
        destination: "https://us-assets.i.posthog.com/static/:path*",
        source: "/relay/static/:path*",
      },
      {
        destination: "https://us-assets.i.posthog.com/array/:path*",
        source: "/relay/array/:path*",
      },
      {
        destination: "https://us.i.posthog.com/:path*",
        source: "/relay/:path*",
      },
    ];
  },
  // Some PostHog API paths end in a slash; without this, Next.js redirects
  // them and the proxied requests fail.
  skipTrailingSlashRedirect: true,
};

const withMDX = createMDX({});

export default withMDX(nextConfig);
