// The documents this app stores in MongoDB (connection: lib/db/index.ts).
//
// better-auth's own collections (user, session, account, verification) are
// created and indexed by its MongoDB adapter (lib/auth.ts). A user's `_id` is
// an ObjectId; the app sees it as its hex string (`session.user.id`), and
// that string is what `purchase.userId` and install tokens hold.

// Relative, not "@/…": scripts load this file without the path alias.
import type { PurchaseKind } from "../billing/plans";

// One document per order or subscription. What it unlocks:
//   kind "lifetime" | "yearly" → everything (all-access)
//   kind "item"                → one product, `itemId` (its product code,
//                                registry.json meta.id, e.g. "SEC-0003")
export interface PurchaseDoc {
  // "order_<provider order id>" or "sub_<provider subscription id>", so a
  // provider's repeated webhooks update one document instead of adding more.
  _id: string;
  // What was paid, in the currency's minor unit (cents). Null if the
  // provider didn't say.
  amountCents: number | null;
  createdAt: Date;
  currency: string | null;
  currentPeriodEnd: Date | null;
  // Lowercase. Guest checkout happens before sign-in, so purchases are
  // matched by email until `userId` is filled in.
  email: string;
  itemId: string | null;
  kind: PurchaseKind;
  // The payment provider ("polar", "dodo") and its own IDs.
  provider: string;
  providerCustomerId: string | null;
  providerOrderId: string | null;
  providerSubscriptionId: string | null;
  status: string;
  updatedAt: Date;
  // Null until the buyer signs in, then backfilled to their user ID.
  userId: string | null;
}

// MongoDB has no check constraints, so writers call this: a single-item
// purchase must name its item, and an all-access plan mustn't.
export const assertPurchaseShape = (
  purchase: Pick<PurchaseDoc, "itemId" | "kind">
) => {
  if ((purchase.kind === "item") !== (purchase.itemId !== null)) {
    throw new Error(
      `A "${purchase.kind}" purchase ${purchase.kind === "item" ? "needs" : "can't have"} an itemId.`
    );
  }
};
