import { and, eq, or } from "drizzle-orm";

import { db } from "@/lib/db";
import { purchase, user } from "@/lib/db/schema";

export interface Entitlements {
  hasAllAccess: boolean;
  hasLifetime: boolean;
  hasYearly: boolean;
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

  return {
    hasAllAccess: hasLifetime || hasYearly,
    hasLifetime,
    hasYearly,
  };
};

// Pay-first gate: does this email own an active plan? Covers guest
// checkouts (no user row yet), so it works before sign-in.
export const hasActivePlanForEmail = async (email: string) => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const rows = await db
    .select()
    .from(purchase)
    .where(and(eq(purchase.email, normalized), eq(purchase.status, "active")));
  return rows.some((row) => row.kind === "lifetime" || isYearlyActive(row));
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
