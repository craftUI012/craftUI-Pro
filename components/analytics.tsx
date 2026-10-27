"use client";

import { Analytics as VercelAnalytics } from "@vercel/analytics/react";
import type { BeforeSendEvent } from "@vercel/analytics/react";
import Script from "next/script";
import { useSyncExternalStore } from "react";

// The visit counters: Vercel Analytics, and Umami in production builds.
// Neither counts a page shown inside an iframe (the docs' live component
// previews, the landing page's device previews): it's part of the page
// around it, which is already counted, not a visit of its own. PostHog skips
// them the same way (instrumentation-client.ts).

const framed = () => window.self !== window.top;

const skipFramed = (event: BeforeSendEvent) => (framed() ? null : event);

// Whether the page is the top window never changes: nothing to listen to.
const subscribeNothing = () => () => {
  // Nothing to stop listening to.
};
const topLevel = () => !framed();
const onServer = () => false;

export const Analytics = () => {
  const counted = useSyncExternalStore(subscribeNothing, topLevel, onServer);

  return (
    <>
      <VercelAnalytics beforeSend={skipFramed} />
      {/* Umami. next/script's default strategy (afterInteractive) loads it
          once the page is interactive, so it never blocks rendering.
          Production builds only, so local visits don't count. */}
      {counted && process.env.NODE_ENV === "production" ? (
        <Script
          data-website-id="d4ba3a77-4ab2-4a15-bd56-5abd94afe5f5"
          src="https://cloud.umami.is/script.js"
          strategy="afterInteractive"
        />
      ) : null}
    </>
  );
};
