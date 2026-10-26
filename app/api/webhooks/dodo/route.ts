import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";

import { handleDodoEvent } from "@/lib/billing/dodo-webhook";
import { getDodo } from "@/lib/dodo";

// Dodo Payments webhooks: the only thing that records purchases (the
// checkout redirect can be skipped or faked; this can't). Register
// <site>/api/webhooks/dodo in the Dodo dashboard (Developer → Webhooks) and
// put its secret in DODO_PAYMENTS_WEBHOOK_KEY. What each event does:
// lib/billing/dodo-webhook.ts.
//
// Answers: 401 for a bad signature (or a timestamp over 5 minutes old),
// 500 if recording failed, so Dodo retries; 200 otherwise. Repeated
// deliveries are safe: purchases are upserted by provider ID.
export const POST = async (request: Request) => {
  if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY) {
    return Response.json(
      { error: "Webhook secret isn't configured." },
      { status: 503 }
    );
  }

  // The signature covers the exact raw body, so read it as text.
  const body = await request.text();
  let event: UnwrapWebhookEvent;
  try {
    event = getDodo().webhooks.unwrap(body, {
      headers: Object.fromEntries(request.headers.entries()),
    });
  } catch {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  try {
    await handleDodoEvent(event);
  } catch (error) {
    console.error(`[dodo] Couldn't record ${event.type}`, error);
    return Response.json({ error: "Not recorded." }, { status: 500 });
  }

  return Response.json({ received: true });
};
