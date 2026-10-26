import { ObjectId } from "mongodb";

import { db, purchases } from "@/lib/db";
import type { PurchaseDoc } from "@/lib/db/schema";

export interface Entitlements {
  hasAllAccess: boolean;
  hasLifetime: boolean;
  hasYearly: boolean;
  // Product codes (registry.json meta.id) of items bought one by one.
  itemIds: string[];
}

// A renewal is charged at the period's end and its webhook can land a few
// minutes later: a day's grace keeps a renewing subscriber unlocked
// meanwhile. A renewal that fails moves the plan off "active" instead.
const RENEWAL_GRACE_MS = 24 * 60 * 60 * 1000;

const isYearlyActive = (row: PurchaseDoc) => {
  if (row.kind !== "yearly" || row.status !== "active") {
    return false;
  }
  if (!row.currentPeriodEnd) {
    return true;
  }
  return row.currentPeriodEnd.getTime() + RENEWAL_GRACE_MS > Date.now();
};

// Does this row grant anything right now? Lifetime and single items are
// forever (until refunded); yearly only until its period ends.
export const isGranting = (row: PurchaseDoc) =>
  row.status === "active" && (row.kind !== "yearly" || isYearlyActive(row));

// better-auth stores a user's ID as an ObjectId; the app (and install
// tokens) carry it as its hex string.
const userEmail = async (userId: string) => {
  if (!ObjectId.isValid(userId)) {
    return;
  }
  const found = await db
    .collection<{ _id: ObjectId; email: string }>("user")
    .findOne({ _id: new ObjectId(userId) }, { projection: { email: 1 } });
  return found?.email.toLowerCase();
};

// Checkout happens BEFORE sign-in, so purchases are keyed by email first.
// Match rows by userId or by the user's email to cover guest checkouts.
const activePurchases = async (userId: string) => {
  const email = await userEmail(userId);
  const collection = await purchases();
  return collection
    .find({
      $or: email ? [{ userId }, { email }] : [{ userId }],
      status: "active",
    })
    .toArray();
};

// What a set of purchases unlocks right now (rows that no longer grant
// anything, like refunded or lapsed ones, are skipped). The admin panel uses
// it to show each user's access from purchases it already loaded.
export const summarizeAccess = (purchaseRows: PurchaseDoc[]): Entitlements => {
  const rows = purchaseRows.filter(isGranting);

  const hasLifetime = rows.some((row) => row.kind === "lifetime");
  const hasYearly = rows.some((row) => row.kind === "yearly");
  const itemIds = [
    ...new Set(
      rows.flatMap((row) =>
        row.kind === "item" && row.itemId ? [row.itemId] : []
      )
    ),
  ];

  return {
    hasAllAccess: hasLifetime || hasYearly,
    hasLifetime,
    hasYearly,
    itemIds,
  };
};

export const getEntitlements = async (userId: string): Promise<Entitlements> =>
  summarizeAccess(await activePurchases(userId));

// Can this user use this item's code? `itemId` is its product code.
export const canAccessItem = async (userId: string, itemId: string) => {
  const entitlements = await getEntitlements(userId);
  return entitlements.hasAllAccess || entitlements.itemIds.includes(itemId);
};

// Pay-first gate: does this email own anything active (a plan or an item)?
// Covers guest checkouts (no user row yet), so it works before sign-in.
export const hasActivePurchaseForEmail = async (email: string) => {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  const collection = await purchases();
  const rows = await collection
    .find({ email: normalized, status: "active" })
    .toArray();
  return rows.some(isGranting);
};

// After sign-in, attach any guest purchases (email match, no user yet)
// to the user so future lookups are direct.
export const backfillPurchasesToUser = async (userId: string) => {
  const email = await userEmail(userId);
  if (!email) {
    return;
  }
  const collection = await purchases();
  await collection.updateMany(
    { email, status: "active", userId: null },
    { $set: { updatedAt: new Date(), userId } }
  );
};
