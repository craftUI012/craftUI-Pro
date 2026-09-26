import { headers } from "next/headers";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  LIFETIME_PLAN,
  YEARLY_PLAN,
  templateBySlug,
} from "@/lib/billing/plans";
import { isPolarConfigured, polar } from "@/lib/polar";

const siteUrl = () =>
  process.env.BETTER_AUTH_URL ??
  process.env.NEXT_PUBLIC_SITE_URL ??
  "http://localhost:3000";

// Guest checkout: the buyer pays FIRST with just an email, then signs in
// with a magic link using the same email. No session required here.
const checkoutSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  plan: z.enum(["lifetime", "yearly", "template"]),
  templateSlug: z.string().optional(),
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
      { error: "Enter a valid email to continue." },
      { status: 400 }
    );
  }

  const { email, plan, templateSlug } = parsed.data;

  let productId: string | undefined;
  let kind = "";
  let resolvedTemplate: string | undefined;

  if (plan === "lifetime") {
    productId = LIFETIME_PLAN.polarProductId;
    kind = "lifetime";
  } else if (plan === "yearly") {
    productId = YEARLY_PLAN.polarProductId;
    kind = "yearly";
  } else {
    const template = templateSlug ? templateBySlug(templateSlug) : undefined;
    if (!template) {
      return Response.json({ error: "Unknown template." }, { status: 400 });
    }
    productId = template.polarProductId;
    kind = "template";
    resolvedTemplate = template.slug;
  }

  if (!productId) {
    return Response.json(
      { error: "This product is not wired to Polar yet." },
      { status: 503 }
    );
  }

  const checkout = await polar.checkouts.create({
    customerEmail: email,
    // Link to the signed-in user when possible; guests match by email later.
    ...(session?.user.id ? { externalCustomerId: session.user.id } : {}),
    metadata: {
      email,
      kind,
      templateSlug: resolvedTemplate ?? "",
      userId: session?.user.id ?? "",
    },
    products: [productId],
    successUrl: `${siteUrl()}/checkout/success?checkout_id={CHECKOUT_ID}`,
  });

  return Response.json({ url: checkout.url });
};
