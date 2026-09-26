import { Webhooks } from "@polar-sh/nextjs";
import { eq } from "drizzle-orm";

import { LIFETIME_PLAN, YEARLY_PLAN, TEMPLATES } from "@/lib/billing/plans";
import { db } from "@/lib/db";
import { purchase, user } from "@/lib/db/schema";

const get = (obj: unknown, path: string): unknown => {
  let current: unknown = obj;
  for (const key of path.split(".")) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
};

const payloadData = (payload: unknown): unknown => {
  if (typeof payload === "object" && payload !== null && "data" in payload) {
    const { data } = payload as Record<string, unknown>;
    return data ?? payload;
  }
  return payload;
};

const asString = (value: unknown): string | null => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return null;
};

const productIdOf = (payload: unknown): string | null =>
  asString(get(payload, "productId")) ?? asString(get(payload, "product.id"));

const kindFromProduct = (productId: string | null) => {
  if (!productId) {
    return null;
  }
  if (productId === LIFETIME_PLAN.polarProductId) {
    return { kind: "lifetime" as const };
  }
  if (productId === YEARLY_PLAN.polarProductId) {
    return { kind: "yearly" as const };
  }
  const template = TEMPLATES.find((t) => t.polarProductId === productId);
  if (template) {
    return { kind: "template" as const, templateSlug: template.slug };
  }
  return null;
};

const resolveUserId = (payload: unknown): string | null => {
  const fromMetadata =
    get(payload, "metadata.userId") ?? get(payload, "checkout.metadata.userId");
  if (typeof fromMetadata === "string" && fromMetadata) {
    return fromMetadata;
  }
  const externalId =
    get(payload, "customer.externalId") ?? get(payload, "customer.external_id");
  if (typeof externalId === "string" && externalId) {
    return externalId;
  }
  return null;
};

const resolveEmail = async (payload: unknown): Promise<string | null> => {
  const fromMetadata =
    get(payload, "metadata.email") ?? get(payload, "checkout.metadata.email");
  if (typeof fromMetadata === "string" && fromMetadata) {
    return fromMetadata.toLowerCase();
  }
  const email = get(payload, "customer.email") ?? get(payload, "customerEmail");
  if (typeof email === "string" && email) {
    return email.toLowerCase();
  }
  const userId = resolveUserId(payload);
  if (userId) {
    const rows = await db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    return rows[0]?.email.toLowerCase() ?? null;
  }
  return null;
};

const resolveKind = (payload: unknown) => {
  const metaKind = get(payload, "metadata.kind");
  const metaTemplate = get(payload, "metadata.templateSlug");
  if (metaKind === "lifetime" || metaKind === "yearly") {
    return { kind: metaKind as "lifetime" | "yearly" };
  }
  if (metaKind === "template" && typeof metaTemplate === "string") {
    return { kind: "template" as const, templateSlug: metaTemplate };
  }
  return kindFromProduct(productIdOf(payload));
};

const upsertPurchase = async (row: typeof purchase.$inferInsert) => {
  await db
    .insert(purchase)
    .values(row)
    .onConflictDoUpdate({
      set: {
        currentPeriodEnd: row.currentPeriodEnd,
        status: row.status,
        templateSlug: row.templateSlug,
        updatedAt: new Date(),
      },
      target: purchase.id,
    });
};

const recordOrder = async (order: unknown) => {
  const payload = payloadData(order);
  const data = payloadData(payload);
  const orderId =
    asString(get(data, "id")) ??
    asString(get(payload, "id")) ??
    asString(get(payload, "orderId"));
  if (!orderId) {
    return;
  }
  // Guest checkout: the buyer may not have signed in yet, so the user
  // lookup can be empty. The purchase is keyed by email and linked to
  // the user on sign-in.
  const userId = resolveUserId(data);
  const email = await resolveEmail(data);
  if (!email) {
    return;
  }
  const kind = resolveKind(data);
  if (!kind) {
    return;
  }
  const subscriptionId =
    asString(get(data, "subscriptionId")) ??
    asString(get(data, "subscription.id"));

  await upsertPurchase({
    currentPeriodEnd: null,
    email,
    id: `order_${orderId}`,
    kind: kind.kind,
    polarCustomerId:
      asString(get(data, "customer.id")) ?? asString(get(data, "customerId")),
    polarOrderId: orderId,
    polarSubscriptionId: subscriptionId,
    status: "active",
    templateSlug: kind.kind === "template" ? (kind.templateSlug ?? null) : null,
    userId,
  });
};

const recordSubscription = async (subscription: unknown, status: string) => {
  const payload = payloadData(subscription);
  const data = payloadData(payload);
  const subscriptionId =
    asString(get(data, "id")) ?? asString(get(payload, "id"));
  if (!subscriptionId) {
    return;
  }
  const userId = resolveUserId(data);
  const email = await resolveEmail(data);
  if (!email) {
    return;
  }
  const kind = resolveKind(data);
  if (!kind) {
    if (status !== "active") {
      const existing = await db
        .select()
        .from(purchase)
        .where(eq(purchase.polarSubscriptionId, subscriptionId))
        .limit(1);
      if (existing[0]) {
        await db
          .update(purchase)
          .set({ status, updatedAt: new Date() })
          .where(eq(purchase.id, existing[0].id));
      }
    }
    return;
  }
  const periodEnd =
    get(data, "currentPeriodEnd") ?? get(data, "current_period_end");

  await upsertPurchase({
    currentPeriodEnd:
      typeof periodEnd === "string" || typeof periodEnd === "number"
        ? new Date(periodEnd)
        : null,
    email,
    id: `sub_${subscriptionId}`,
    kind: kind.kind,
    polarCustomerId:
      asString(get(data, "customer.id")) ?? asString(get(data, "customerId")),
    polarOrderId: null,
    polarSubscriptionId: subscriptionId,
    status,
    templateSlug: kind.kind === "template" ? (kind.templateSlug ?? null) : null,
    userId,
  });
};

export const POST = Webhooks({
  onOrderCreated: async (order) => {
    await recordOrder(order);
  },
  onOrderPaid: async (order) => {
    await recordOrder(order);
  },
  onOrderRefunded: async (order) => {
    const data = payloadData(order);
    const orderId = asString(get(data, "id"));
    if (orderId) {
      await db
        .update(purchase)
        .set({ status: "refunded", updatedAt: new Date() })
        .where(eq(purchase.polarOrderId, orderId));
    }
  },
  onSubscriptionActive: async (subscription) => {
    await recordSubscription(subscription, "active");
  },
  onSubscriptionCanceled: async (subscription) => {
    await recordSubscription(subscription, "canceled");
  },
  onSubscriptionCreated: async (subscription) => {
    await recordSubscription(subscription, "active");
  },
  onSubscriptionRevoked: async (subscription) => {
    await recordSubscription(subscription, "canceled");
  },
  onSubscriptionUpdated: async (subscription) => {
    await recordSubscription(subscription, "active");
  },
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET ?? "",
});
