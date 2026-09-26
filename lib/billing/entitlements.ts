import { and, eq, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { purchase, user } from "@/lib/db/schema";

export interface Entitlements {
  hasAllAccess: boolean;
  hasLifetime: boolean;
  hasYearly: boolean;
  templates: string[];
}

const isYearlyActive = (row: typeof purchase.$inferSelect) => {
  if (row.kind !== "yearly" || row.status !== "active") {
    return false;
  }
  if (!row.currentPeriodEnd) {
    return true;
  }
  return row.currentPeriodEnd.getTime() > Date.now();
};

const userEmail = async (userId: string) => {
  const rows = await db
    .select({ email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1);
  return rows[0]?.email;
};

// Checkout happens BEFORE sign-in, so purchases are keyed by email first.
// Match rows by userId or by the user's email to cover guest checkouts.
const activePurchases = async (userId: string) => {
  const email = await userEmail(userId);
  const match = email
    ? or(eq(purchase.userId, userId), eq(purchase.email, email))
    : eq(purchase.userId, userId);
  return db
    .select()
    .from(purchase)
    .where(and(match, eq(purchase.status, "active")));
};

export const getEntitlements = async (
  userId: string
): Promise<Entitlements> => {
  const rows = await activePurchases(userId);

  const hasLifetime = rows.some((row) => row.kind === "lifetime");
  const hasYearly = rows.some((row) => isYearlyActive(row));
  const templates = rows
    .filter((row) => row.kind === "template" && row.templateSlug)
    .map((row) => row.templateSlug as string);

  return {
    hasAllAccess: hasLifetime || hasYearly,
    hasLifetime,
    hasYearly,
    templates,
  };
};

// After sign-in, attach any guest purchases (email match, no user yet)
// to the user so future lookups are direct.
export const backfillPurchasesToUser = async (userId: string) => {
  const email = await userEmail(userId);
  if (!email) {
    return;
  }
  await db
    .update(purchase)
    .set({ updatedAt: new Date(), userId })
    .where(and(eq(purchase.email, email), eq(purchase.status, "active")));
};

export const canAccessComponents = async (userId: string) => {
  const entitlements = await getEntitlements(userId);
  return entitlements.hasAllAccess;
};

export const canAccessTemplate = async (userId: string, slug: string) => {
  const entitlements = await getEntitlements(userId);
  if (entitlements.hasAllAccess) {
    return true;
  }
  return entitlements.templates.includes(slug);
};
