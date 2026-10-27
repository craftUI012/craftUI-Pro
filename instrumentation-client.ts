import { posthog } from "posthog-js";

// PostHog, started once on the client before the app hydrates (Next.js runs
// this file first). Without a project token (e.g. a fork, or a preview
// that shouldn't report), PostHog stays off and every capture is a no-op.
//
// Events go to /relay on this site, which next.config.mjs forwards to
// PostHog: ad blockers (common with a developer audience) block PostHog's
// own domains, not ours. The path is deliberately not "/posthog" or
// "/analytics", which blockers also match.
//
// A page inside an iframe (the docs' live component previews, the landing
// page's device previews) doesn't start it: it's part of the page around it,
// not a visit of its own.
const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

if (token && window.self === window.top) {
  posthog.init(token, {
    api_host: "/relay",
    // PostHog's recommended settings as of this date: $pageview and
    // $pageleave on every client-side navigation, person profiles only for
    // identified users, and so on.
    defaults: "2026-08-30",
    // Links PostHog builds (toolbar, replay) point at the app, not /relay.
    ui_host: "https://us.posthog.com",
  });
  // Tags every event, so local and preview traffic can be filtered out.
  posthog.register({ environment: process.env.NODE_ENV });
}
