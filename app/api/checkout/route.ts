import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { LIFETIME_PLAN, YEARLY_PLAN } from "@/lib/billing/plans";
import { isPolarConfigured, polar } from "@/lib/polar";

const siteUrl = () =>
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

// Polar collects the buyer's email at checkout. The buyer then signs in
// with a magic link using the same email. No session required here.
const checkoutSchema = z.object({
  plan: z.enum(["lifetime", "yearly"]),
});

export const POST = async (request: Request) => {
  // Session is optional — a signed-in buyer just gets linked directly.
  const session = await auth.api
    .getSession({ headers: await headers() })
    .catch(() => null);

  if (!isPolarConfigured()) {
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

  const { plan } = parsed.data;

  const productId =
    plan === "lifetime"
      ? LIFETIME_PLAN.polarProductId
      : YEARLY_PLAN.polarProductId;

  if (!productId) {
    return Response.json(
      { error: "This product is not wired to Polar yet." },
      { status: 503 }
    );
  }

  const sessionEmail = session?.user.email?.toLowerCase() || undefined;
  const sessionUserId = session?.user.id || undefined;

  const checkout = await polar.checkouts.create({
    // Prefill when the buyer is signed in; otherwise Polar collects it
    // and the webhook matches the purchase by email later.
    ...(sessionEmail ? { customerEmail: sessionEmail } : {}),
    // Link to the signed-in user when possible; guests match by email later.
    ...(sessionUserId ? { externalCustomerId: sessionUserId } : {}),
    // NOTE: never send empty strings here — Polar rejects them with a 422.
    metadata: {
      ...(sessionEmail ? { email: sessionEmail } : {}),
      ...(sessionUserId ? { userId: sessionUserId } : {}),
      kind: plan,
    },
    products: [productId],
    successUrl: `${siteUrl()}/checkout/success?checkout_id={CHECKOUT_ID}`,
  });

  return Response.json({ url: checkout.url });
};
