import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { z } from "zod";

import { ROUTES } from "@/constants/routes";
import { auth } from "@/lib/auth";
import { LIFETIME_PLAN, YEARLY_PLAN } from "@/lib/billing/plans";
import { getDodo, isDodoConfigured } from "@/lib/dodo";

const siteUrl = () =>
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

// Pay first, sign in after: no session needed. Dodo collects the buyer's
// email at checkout, the webhook (app/api/webhooks/dodo) stores the purchase
// by that email, and the buyer then signs in with a magic link to the same
// email. A signed-in buyer just gets their email prefilled and their user ID
// in the metadata, so the purchase links to their account straight away.
const checkoutSchema = z.object({
  // The visitor's PostHog ID, so the purchase joins their browsing in the
  // funnel (lib/billing/dodo-webhook.ts sends purchase_completed with it).
  distinctId: z.string().max(200).optional(),
  plan: z.enum(["lifetime", "yearly"]),
});

// Warms the function: the pricing page calls this when it opens, so the
// buyer's click doesn't wait for a cold start (loading the auth, database
// and Dodo modules). Does no work and returns nothing.
export const GET = () =>
  new Response(null, { headers: { "Cache-Control": "no-store" }, status: 204 });

// A checkout slower than this is logged, to spot it in production.
const SLOW_MS = 3000;

export const POST = async (request: Request) => {
  const started = performance.now();
  if (!isDodoConfigured()) {
    return Response.json(
      { error: "Payments are not configured yet." },
      { status: 503 }
    );
  }

  const parsed = checkoutSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json(
      { error: "Pick a plan to continue." },
      { status: 400 }
    );
  }

  const { distinctId, plan } = parsed.data;
  const productId = (plan === "lifetime" ? LIFETIME_PLAN : YEARLY_PLAN)
    .dodoProductId;
  if (!productId) {
    return Response.json(
      { error: "This plan is not set up in Dodo Payments yet." },
      { status: 503 }
    );
  }

  // Most buyers are guests: without a session cookie there's no session to
  // look up, so skip the database and go straight to Dodo.
  const session = getSessionCookie(request)
    ? await auth.api.getSession({ headers: await headers() }).catch(() => null)
    : null;
  const email = session?.user.email.toLowerCase();
  const sessionMs = performance.now() - started;

  try {
    const checkout = await getDodo().checkoutSessions.create({
      ...(email
        ? { customer: { email, name: session?.user.name || undefined } }
        : {}),
      // Read back by the webhook. Values must be strings, and empty ones
      // are left out.
      metadata: {
        kind: plan,
        ...(distinctId ? { posthogDistinctId: distinctId } : {}),
        ...(session ? { userId: session.user.id } : {}),
      },
      product_cart: [{ product_id: productId, quantity: 1 }],
      // Dodo adds ?status=…&email=… (and payment_id or subscription_id).
      return_url: `${siteUrl()}${ROUTES.CHECKOUT_SUCCESS}`,
    });

    if (!checkout.checkout_url) {
      throw new Error("Dodo returned no checkout URL.");
    }
    const totalMs = performance.now() - started;
    if (totalMs > SLOW_MS) {
      console.warn(
        `[checkout] Slow checkout: ${Math.round(totalMs)}ms (session ${Math.round(sessionMs)}ms, Dodo ${Math.round(totalMs - sessionMs)}ms)`
      );
    }
    return Response.json(
      { url: checkout.checkout_url },
      {
        // Visible in the browser's network panel: where the time went.
        headers: {
          "Server-Timing": `session;dur=${sessionMs.toFixed(0)}, dodo;dur=${(totalMs - sessionMs).toFixed(0)}`,
        },
      }
    );
  } catch (error) {
    console.error(
      `[checkout] Dodo checkout failed after ${Math.round(performance.now() - started)}ms`,
      error
    );
    return Response.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 502 }
    );
  }
};
