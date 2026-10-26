import { getSessionCookie } from "better-auth/cookies";
import { isMarkdownPreferred, rewritePath } from "fumadocs-core/negotiation";
import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";

import { ROUTES } from "@/constants/routes";
import { docsContentRoute, homeContentRoute } from "@/lib/docs";
import {
  anonymousId,
  captureServerEvent,
  registryClientOf,
} from "@/lib/posthog-server";
import { getRegistryItem, isPaidItem } from "@/lib/registry";

const { rewrite: rewriteDocs } = rewritePath(
  `${ROUTES.DOCS}{/*path}`,
  `${docsContentRoute}{/*path}/content.md`
);
const { rewrite: rewriteSuffix } = rewritePath(
  `${ROUTES.DOCS}{/*path}.md`,
  `${docsContentRoute}{/*path}/content.md`
);

// /r/<item>.json is what `npx shadcn add <site>/r/<item>.json` downloads, so
// a fetch here is an install, which the browser never sees. It's recorded
// server-side as `registry_item_fetched` (registry.json, the index, isn't an
// install and is skipped). `client` separates real installs (`cli`) from
// people opening the JSON in a browser, crawlers and other scripts.
//
// Only free items are recorded here. Paid items are served by
// app/r/[file]/route.ts, which records them itself once it knows whether the
// requester has access, so refused attempts never count as installs.
const REGISTRY_ITEM = /^\/r\/([\w-]+)\.json$/;

// A static file in public/r: a free item, by its name (product-code URLs
// and paid items go through the route).
const isFreeRegistryFile = (key: string) => {
  const item = getRegistryItem(key);
  return item?.name === key && !isPaidItem(key);
};

const trackRegistryFetch = (request: NextRequest, event: NextFetchEvent) => {
  const item = REGISTRY_ITEM.exec(request.nextUrl.pathname)?.[1];
  if (
    !item ||
    item === "registry" ||
    request.method !== "GET" ||
    !isFreeRegistryFile(item)
  ) {
    return;
  }
  const userAgent = request.headers.get("user-agent") ?? "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  // After the response: the file is served without waiting on PostHog.
  event.waitUntil(
    (async () => {
      await captureServerEvent({
        distinctId: await anonymousId(ip, userAgent),
        event: "registry_item_fetched",
        properties: {
          // For PostHog's country lookup; it isn't kept on the person.
          $ip: ip || null,
          // An install isn't a visitor: no person profile.
          $process_person_profile: false,
          client: registryClientOf(userAgent),
          item,
          user_agent: userAgent.slice(0, 200),
        },
      });
    })()
  );
};

const proxy = (request: NextRequest, event: NextFetchEvent) => {
  trackRegistryFetch(request, event);

  if (
    request.nextUrl.pathname === ROUTES.DASHBOARD &&
    !getSessionCookie(request)
  ) {
    return NextResponse.redirect(new URL(ROUTES.LOGIN, request.url));
  }

  if (
    request.nextUrl.pathname === ROUTES.HOME &&
    (request.method === "GET" || request.method === "HEAD") &&
    isMarkdownPreferred(request)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = homeContentRoute;

    return NextResponse.rewrite(url);
  }

  const result = rewriteSuffix(request.nextUrl.pathname);
  if (result) {
    return NextResponse.rewrite(new URL(result, request.nextUrl));
  }

  if (isMarkdownPreferred(request)) {
    const result2 = rewriteDocs(request.nextUrl.pathname);

    if (result2) {
      return NextResponse.rewrite(new URL(result2, request.nextUrl));
    }
  }

  return NextResponse.next();
};

export default proxy;
