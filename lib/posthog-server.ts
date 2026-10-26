// Server-side PostHog events, sent straight to PostHog's capture API with
// fetch, so no SDK runs on the server. For things the browser never sees,
// like the shadcn CLI downloading a registry item. Without a project token
// it does nothing, same as the client.
//
// Callers should hand the returned promise to waitUntil() (or ignore it):
// capturing never delays or fails the response it describes.

const token = () => process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const host = () =>
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

type Properties = Record<string, string | number | boolean | null>;

export const captureServerEvent = async ({
  distinctId,
  event,
  properties,
}: {
  distinctId: string;
  event: string;
  properties: Properties;
}) => {
  const apiKey = token();
  if (!apiKey) {
    return;
  }
  try {
    await fetch(`${host()}/i/v0/e/`, {
      body: JSON.stringify({
        api_key: apiKey,
        distinct_id: distinctId,
        event,
        properties: {
          environment: process.env.NODE_ENV,
          ...properties,
        },
        timestamp: new Date().toISOString(),
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
  } catch {
    // Analytics must never break the request it describes.
  }
};

// A stable, anonymous ID for a requester (no raw IP stored in the ID):
// the same machine and client hash to the same value, so "unique
// installers" can be counted without identifying anyone.
export const anonymousId = async (...parts: string[]) => {
  const bytes = new TextEncoder().encode(parts.join("|"));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `anon_${[...new Uint8Array(digest)]
    .slice(0, 12)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")}`;
};

// Who fetched a registry item, from its user agent: the shadcn CLI (a real
// install), a browser tab, a crawler or link preview, or another script.
export const registryClientOf = (userAgent: string) => {
  // The shadcn CLI sends the user agent "shadcn".
  if (/shadcn/i.test(userAgent)) {
    return "cli";
  }
  if (/bot|crawl|spider|slurp|preview|fetcher/i.test(userAgent)) {
    return "bot";
  }
  // A person opening the JSON, or a script (curl, an AI agent, …).
  return /mozilla/i.test(userAgent) ? "browser" : "other";
};
