import { MongoServerError } from "mongodb";
import type { Filter } from "mongodb";

import { purchases } from "@/lib/db";
import { assertPurchaseShape } from "@/lib/db/schema";
import type { PurchaseDoc } from "@/lib/db/schema";

// Writes purchases from payment-provider webhooks (lib/billing/dodo-webhook.ts).

export type PurchaseInput = Omit<
  PurchaseDoc,
  "_id" | "createdAt" | "updatedAt"
> & {
  id: string;
};

// Providers send several webhooks per purchase, sometimes repeated: the
// first inserts the purchase, later ones only move its status and period.
// A refunded purchase stays refunded. Returns true if this call created it.
export const upsertPurchase = async ({
  currentPeriodEnd,
  id,
  status,
  ...fields
}: PurchaseInput) => {
  assertPurchaseShape(fields);
  const now = new Date();
  const collection = await purchases();
  try {
    const result = await collection.updateOne(
      { _id: id, status: { $ne: "refunded" } },
      {
        $set: { currentPeriodEnd, status, updatedAt: now },
        $setOnInsert: { ...fields, createdAt: now },
      },
      { upsert: true }
    );
    return result.upsertedCount === 1;
  } catch (error) {
    // The purchase exists and was refunded, so the filter missed and the
    // upsert collided with its _id: leave it refunded.
    if (error instanceof MongoServerError && error.code === 11_000) {
      return false;
    }
    throw error;
  }
};

export const markRefunded = async (filter: Filter<PurchaseDoc>) => {
  const collection = await purchases();
  await collection.updateMany(filter, {
    $set: { status: "refunded", updatedAt: new Date() },
  });
};
