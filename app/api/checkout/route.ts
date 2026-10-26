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

export const POST = async (request: Request) => {
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

  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);
  const email = session?.user.email.toLowerCase();

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
    return Response.json({ url: checkout.checkout_url });
  } catch (error) {
    console.error("[checkout] Dodo checkout failed", error);
    return Response.json(
      { error: "Couldn't start checkout. Please try again." },
      { status: 502 }
    );
  }
};
