import { readFile } from "node:fs/promises";
import path from "node:path";

import { after } from "next/server";
import type { NextRequest } from "next/server";

import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { canAccessItem } from "@/lib/billing/entitlements";
import { verifyInstallToken } from "@/lib/install-token";
import {
  anonymousId,
  captureServerEvent,
  registryClientOf,
} from "@/lib/posthog-server";
import { getRegistryItem, isPaidItem } from "@/lib/registry";

// /r/<item>.json for everything that isn't a static file in public/r: paid
// items (moved to registry-paid/ by scripts/build-registry.mjs) and URLs by
// product code (/r/SEC-0003.json). Free items by name are served from
// public/ before this route is reached.
//
// A paid item needs `?t=<install token>` (lib/install-token.ts), which the
// docs page puts in the install command for buyers. On every request the
// token's user is checked against the database: all-access, or a purchase
// of this item's product code.

const PAID_DIR = path.join(process.cwd(), "registry-paid");
const PUBLIC_DIR = path.join(process.cwd(), "public", "r");

// The shadcn CLI prints the response's `error` (or `message`) to the user,
// so every refusal says what to do next.
const refuse = (status: number, error: string) =>
  Response.json(
    { error, message: error },
    { headers: { "Cache-Control": "no-store" }, status }
  );

const serve = async (file: string) =>
  new Response(await readFile(file, "utf-8"), {
    headers: {
      // Paid files are per-buyer: never cached by a CDN or shared proxy.
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });

export const GET = async (
  request: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) => {
  const { file } = await params;
  const key = file.endsWith(".json") ? file.slice(0, -".json".length) : null;
  const item = key ? getRegistryItem(key) : undefined;

  if (!item) {
    return refuse(404, `There's no craftUI item called "${key ?? file}".`);
  }

  if (!isPaidItem(item.name)) {
    return serve(path.join(PUBLIC_DIR, `${item.name}.json`));
  }

  const userAgent = request.headers.get("user-agent") ?? "";
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  // The item's docs page (variants share one: meta.docs).
  const meta = item.meta as { docs?: string; library?: string } | undefined;
  const pageUrl = `${SITE.URL}${ROUTES.DOCS}/${meta?.library}/${meta?.docs ?? item.name}`;
  const userId = verifyInstallToken(request.nextUrl.searchParams.get("t"));
  const allowed =
    userId !== null && (await canAccessItem(userId, String(item.meta?.id)));

  let deniedReason: string | null = null;
  if (!allowed) {
    deniedReason = userId ? "no_access" : "no_token";
  }

  // Recorded after the response, like free installs in proxy.ts. A granted
  // install is tied to the buyer; a refusal stays anonymous and uses its own
  // event, so it never counts as an install.
  const track = async () => {
    await captureServerEvent({
      distinctId: allowed && userId ? userId : await anonymousId(ip, userAgent),
      event: allowed ? "registry_item_fetched" : "registry_access_denied",
      properties: {
        $ip: ip || null,
        ...(allowed ? {} : { $process_person_profile: false }),
        client: registryClientOf(userAgent),
        item: item.name,
        product_id: String(item.meta?.id),
        reason: deniedReason,
        user_agent: userAgent.slice(0, 200),
      },
    });
  };
  // After the response: the file (or refusal) goes out without waiting on
  // PostHog.
  after(track);

  if (!userId) {
    return refuse(
      401,
      `"${item.title}" is a paid craftUI item. Sign in at ${SITE.URL} and copy the install command from its docs page (${pageUrl}).`
    );
  }
  if (!allowed) {
    return refuse(
      403,
      `Your craftUI account doesn't include "${item.title}". See plans at ${SITE.URL}${ROUTES.PRICING}.`
    );
  }

  return serve(path.join(PAID_DIR, `${item.name}.json`));
};
