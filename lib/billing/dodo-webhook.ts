import type { Payment } from "dodopayments/resources/payments";
import type { Refund } from "dodopayments/resources/refunds";
import type { Subscription } from "dodopayments/resources/subscriptions";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";

import { LIFETIME_PLAN, YEARLY_PLAN } from "@/lib/billing/plans";
import type { PurchaseKind } from "@/lib/billing/plans";
import { markRefunded, upsertPurchase } from "@/lib/billing/purchases";
import { getDodo } from "@/lib/dodo";
import { sendPurchaseThankYouEmail } from "@/lib/email";
import { anonymousId, captureServerEvent } from "@/lib/posthog-server";
import { getRegistryItem } from "@/lib/registry";

// What each Dodo webhook event means for purchases (the route,
// app/api/webhooks/dodo/route.ts, only checks the signature):
//
//   payment.succeeded   → a lifetime (or single-item) purchase, by email
//   subscription.*      → the yearly plan: created, renewed (new period
//                         end), cancelled, on hold, expired…
//   refund.succeeded    → a full refund ends that purchase's access
//
// Purchases are keyed by the buyer's email, so paying before signing in
// works: lib/auth.ts lets that email sign in, and the purchase is linked to
// the account on sign-in. /api/checkout puts `kind`, `userId` and
// `posthogDistinctId` in the checkout metadata; Dodo returns it here.

type Metadata = Payment["metadata"];

const metaString = (metadata: Metadata, key: string) => {
  const value = metadata[key];
  return typeof value === "string" && value ? value : null;
};

// Which plan a purchase is: the checkout's metadata, else its product.
const planOf = (metadata: Metadata, productId?: string | null) => {
  const kind = metaString(metadata, "kind");
  if (kind === "lifetime" || kind === "yearly") {
    return kind;
  }
  if (productId && productId === LIFETIME_PLAN.dodoProductId) {
    return "lifetime";
  }
  if (productId && productId === YEARLY_PLAN.dodoProductId) {
    return "yearly";
  }
  return null;
};

// "purchase_completed" in PostHog, the last step of the buying funnel,
// joined to the visitor's browsing through the ID /api/checkout passed on.
const trackPurchase = async ({
  amountCents,
  currency,
  email,
  itemId,
  kind,
  metadata,
}: {
  amountCents: number | null;
  currency: string | null;
  email: string;
  itemId: string | null;
  kind: PurchaseKind;
  metadata: Metadata;
}) => {
  const distinctId =
    metaString(metadata, "posthogDistinctId") ??
    metaString(metadata, "userId") ??
    (await anonymousId(email));
  await captureServerEvent({
    distinctId,
    event: "purchase_completed",
    properties: {
      amount_cents: amountCents,
      currency,
      item_id: itemId,
      plan: kind,
      provider: "dodo",
      // Major units (e.g. dollars), for PostHog revenue charts.
      revenue: amountCents === null ? null : amountCents / 100,
    },
  });
};

// The founder's thank-you note, once per new purchase. A failed send is
// logged, not thrown: the purchase is already recorded, and an error here
// would make Dodo retry an event that's done.
const sendThankYou = async (input: {
  customerName: string | null;
  email: string;
  itemId: string | null;
  kind: PurchaseKind;
}) => {
  try {
    await sendPurchaseThankYouEmail({
      customerName: input.customerName,
      email: input.email,
      itemTitle: input.itemId
        ? (getRegistryItem(input.itemId)?.title ?? null)
        : null,
      kind: input.kind,
    });
  } catch (error) {
    console.error(
      `[dodo] Couldn't send the thank-you note to ${input.email}`,
      error
    );
  }
};

// A one-time payment: lifetime, or (later) a single item whose product code
// the checkout put in metadata.itemId. Subscription payments are recorded
// from the subscription events instead.
const recordPayment = async (payment: Payment) => {
  if (payment.subscription_id || payment.subscription_ids.length > 0) {
    return;
  }
  const itemId = metaString(payment.metadata, "itemId");
  let kind: PurchaseKind | null = planOf(
    payment.metadata,
    payment.product_cart?.[0]?.product_id
  );
  if (metaString(payment.metadata, "kind") === "item") {
    kind = itemId && getRegistryItem(itemId) ? "item" : null;
  }
  if (kind !== "lifetime" && kind !== "item") {
    console.warn("[dodo] Payment for an unknown product", payment.payment_id);
    return;
  }

  const email = payment.customer.email.toLowerCase();
  const created = await upsertPurchase({
    amountCents: payment.total_amount,
    currency: payment.currency,
    currentPeriodEnd: null,
    email,
    id: `order_${payment.payment_id}`,
    itemId: kind === "item" ? itemId : null,
    kind,
    provider: "dodo",
    providerCustomerId: payment.customer.customer_id,
    providerOrderId: payment.payment_id,
    providerSubscriptionId: null,
    status: "active",
    userId: metaString(payment.metadata, "userId"),
  });
  if (created) {
    await Promise.all([
      trackPurchase({
        amountCents: payment.total_amount,
        currency: payment.currency,
        email,
        itemId: kind === "item" ? itemId : null,
        kind,
        metadata: payment.metadata,
      }),
      sendThankYou({
        customerName: payment.customer.name,
        email,
        itemId: kind === "item" ? itemId : null,
        kind,
      }),
    ]);
  }
};

// The yearly plan. A cancelled subscription was paid to the end of its
// period, so it stays "active" here and lib/billing/entitlements.ts ends
// access when `currentPeriodEnd` passes. Every other Dodo status (on_hold,
// past_due, failed, expired, paused, pending) is stored as is and grants
// nothing.
const recordSubscription = async (subscription: Subscription) => {
  if (planOf(subscription.metadata, subscription.product_id) !== "yearly") {
    console.warn(
      "[dodo] Subscription for an unknown product",
      subscription.subscription_id
    );
    return;
  }
  const status =
    subscription.status === "cancelled" ? "active" : subscription.status;
  const email = subscription.customer.email.toLowerCase();
  const created = await upsertPurchase({
    amountCents: subscription.recurring_pre_tax_amount,
    currency: subscription.currency,
    currentPeriodEnd: new Date(subscription.next_billing_date),
    email,
    id: `sub_${subscription.subscription_id}`,
    itemId: null,
    kind: "yearly",
    provider: "dodo",
    providerCustomerId: subscription.customer.customer_id,
    providerOrderId: null,
    providerSubscriptionId: subscription.subscription_id,
    status,
    userId: metaString(subscription.metadata, "userId"),
  });
  if (created && status === "active") {
    await Promise.all([
      trackPurchase({
        amountCents: subscription.recurring_pre_tax_amount,
        currency: subscription.currency,
        email,
        itemId: null,
        kind: "yearly",
        metadata: subscription.metadata,
      }),
      sendThankYou({
        customerName: subscription.customer.name,
        email,
        itemId: null,
        kind: "yearly",
      }),
    ]);
  }
};

// A full refund ends access: the lifetime or item purchase it paid for, or
// the yearly subscription its payment belonged to. Partial refunds (a
// goodwill discount) leave access alone.
const recordRefund = async (refund: Refund) => {
  if (refund.is_partial) {
    return;
  }
  await markRefunded({ providerOrderId: refund.payment_id });
  const payment = await getDodo().payments.retrieve(refund.payment_id);
  const subscriptionIds = [
    ...payment.subscription_ids,
    ...(payment.subscription_id ? [payment.subscription_id] : []),
  ];
  if (subscriptionIds.length > 0) {
    await markRefunded({ providerSubscriptionId: { $in: subscriptionIds } });
  }
};

export const handleDodoEvent = async (event: UnwrapWebhookEvent) => {
  switch (event.type) {
    case "payment.succeeded": {
      await recordPayment(event.data);
      break;
    }
    case "subscription.active":
    case "subscription.cancelled":
    case "subscription.expired":
    case "subscription.failed":
    case "subscription.on_hold":
    case "subscription.past_due":
    case "subscription.paused":
    case "subscription.plan_changed":
    case "subscription.renewed":
    case "subscription.unpaused":
    case "subscription.updated": {
      await recordSubscription(event.data);
      break;
    }
    case "refund.succeeded": {
      await recordRefund(event.data);
      break;
    }
    default: {
      // Other events (disputes, payouts, …) don't change access.
      break;
    }
  }
};
