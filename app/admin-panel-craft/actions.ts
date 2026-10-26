"use server";

import { randomUUID } from "node:crypto";

import { MongoServerError } from "mongodb";
import type { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ROUTES } from "@/constants/routes";
import { PURCHASE_KINDS, PURCHASE_STATUSES } from "@/lib/admin/constants";
import { itemOptions, toObjectId } from "@/lib/admin/data";
import type { UserDoc } from "@/lib/admin/data";
import { requireAdmin } from "@/lib/admin/session";
import { db, ensureIndexes, purchases } from "@/lib/db";
import { assertPurchaseShape } from "@/lib/db/schema";
import type { PurchaseDoc } from "@/lib/db/schema";

// The admin panel's writes. Each one checks the admin first (an action can
// be called directly, not only from the panel), and answers { error } for
// the form to show, or { ok }. These change our database only: refunding
// or cancelling here moves no money in Dodo.

export type ActionResult = { error: string } | { message?: string; ok: true };

const fail = (error: unknown): ActionResult => {
  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message ?? "Invalid input." };
  }
  if (error instanceof MongoServerError && error.code === 11_000) {
    return { error: "Another user already has this email." };
  }
  return {
    error: error instanceof Error ? error.message : "Something went wrong.",
  };
};

const done = (message?: string): ActionResult => {
  revalidatePath(ROUTES.ADMIN_PANEL, "layout");
  return { message, ok: true };
};

const email = z.string().trim().toLowerCase().email("Enter a valid email.");

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

// A yearly grant runs to the end of the chosen day, or a year from today
// without one. Other kinds have no end.
const periodEndOf = (kind: string, date?: string) => {
  if (kind !== "yearly") {
    return null;
  }
  return date
    ? new Date(`${date}T23:59:59.000Z`)
    : new Date(Date.now() + YEAR_MS);
};

const grant = z
  .object({
    currentPeriodEnd: z.string().optional(),
    itemId: z.string().optional(),
    kind: z.enum(PURCHASE_KINDS),
  })
  .transform((value) => ({
    currentPeriodEnd: periodEndOf(value.kind, value.currentPeriodEnd),
    itemId: value.kind === "item" ? (value.itemId ?? null) : null,
    kind: value.kind,
  }))
  .refine(
    (value) =>
      value.kind !== "item" ||
      itemOptions().some((item) => item.id === value.itemId),
    { message: "Pick the item this purchase is for." }
  );

const users = async () => {
  await ensureIndexes();
  return db.collection<UserDoc>("user");
};

// A purchase added by hand: no provider IDs, no amount, provider "manual".
const insertManualPurchase = async (
  buyer: string,
  access: z.infer<typeof grant>,
  status = "active"
) => {
  assertPurchaseShape(access);
  const userCollection = await users();
  const owner = await userCollection.findOne(
    { email: buyer },
    { projection: { _id: 1 } }
  );
  const now = new Date();
  const collection = await purchases();
  await collection.insertOne({
    _id: `manual_${randomUUID()}`,
    amountCents: null,
    createdAt: now,
    currency: null,
    currentPeriodEnd: access.currentPeriodEnd,
    email: buyer,
    itemId: access.itemId,
    kind: access.kind,
    provider: "manual",
    providerCustomerId: null,
    providerOrderId: null,
    providerSubscriptionId: null,
    status,
    updatedAt: now,
    userId: owner ? owner._id.toHexString() : null,
  });
};

export const createUser = async (input: {
  email: string;
  grant: "none" | "lifetime" | "yearly" | "item";
  itemId?: string;
  name: string;
  periodEnd?: string;
}): Promise<ActionResult> => {
  try {
    await requireAdmin();
    const address = email.parse(input.email);
    const name = z.string().trim().max(120).parse(input.name);
    const now = new Date();
    const userCollection = await users();
    await userCollection.insertOne({
      createdAt: now,
      email: address,
      emailVerified: false,
      name,
      updatedAt: now,
    } as UserDoc);
    if (input.grant !== "none") {
      await insertManualPurchase(
        address,
        grant.parse({
          currentPeriodEnd: input.periodEnd,
          itemId: input.itemId,
          kind: input.grant,
        })
      );
    }
    return done(`Added ${address}.`);
  } catch (error) {
    return fail(error);
  }
};

export const updateUser = async (input: {
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
}): Promise<ActionResult> => {
  try {
    await requireAdmin();
    const id = toObjectId(input.id);
    if (!id) {
      return { error: "No such user." };
    }
    const address = email.parse(input.email);
    const name = z.string().trim().max(120).parse(input.name);
    const collection = await users();
    const before = await collection.findOne({ _id: id });
    if (!before) {
      return { error: "No such user." };
    }
    await collection.updateOne(
      { _id: id },
      {
        $set: {
          email: address,
          emailVerified: input.emailVerified,
          name,
          updatedAt: new Date(),
        },
      }
    );
    // Purchases are found by email too, so they move with the address.
    const previous = before.email.toLowerCase();
    if (previous !== address) {
      const purchaseCollection = await purchases();
      await purchaseCollection.updateMany(
        { email: previous },
        { $set: { email: address, updatedAt: new Date() } }
      );
    }
    return done("Saved.");
  } catch (error) {
    return fail(error);
  }
};

// Signs the user out everywhere (or on one browser, with sessionId).
export const revokeSessions = async (input: {
  sessionId?: string;
  userId: string;
}): Promise<ActionResult> => {
  try {
    await requireAdmin();
    const userId = toObjectId(input.userId);
    if (!userId) {
      return { error: "No such user." };
    }
    const sessionId = input.sessionId ? toObjectId(input.sessionId) : null;
    const result = await db
      .collection<{ _id: ObjectId; userId: ObjectId }>("session")
      .deleteMany(sessionId ? { _id: sessionId, userId } : { userId });
    return done(
      `Signed out of ${result.deletedCount} ${result.deletedCount === 1 ? "session" : "sessions"}.`
    );
  } catch (error) {
    return fail(error);
  }
};

// Removes the user and every record about them: sessions, linked accounts,
// pending sign-in links, and all their purchases (by user ID or email).
// `confirmEmail` must match, typed by hand in the panel.
export const deleteUserEverywhere = async (input: {
  confirmEmail: string;
  id: string;
}): Promise<ActionResult> => {
  try {
    await requireAdmin();
    const id = toObjectId(input.id);
    if (!id) {
      return { error: "No such user." };
    }
    const collection = await users();
    const user = await collection.findOne({ _id: id });
    if (!user) {
      return { error: "No such user." };
    }
    const address = user.email.toLowerCase();
    if (input.confirmEmail.trim().toLowerCase() !== address) {
      return { error: "Type the user's email exactly to confirm." };
    }
    const purchaseCollection = await purchases();
    const escaped = address.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const [sessions, accounts, verifications, removedPurchases] =
      await Promise.all([
        db.collection("session").deleteMany({ userId: id }),
        db.collection("account").deleteMany({ userId: id }),
        db
          .collection("verification")
          .deleteMany({ value: { $regex: escaped } }),
        purchaseCollection.deleteMany({
          $or: [{ userId: id.toHexString() }, { email: address }],
        }),
      ]);
    await collection.deleteOne({ _id: id });
    return done(
      `Deleted ${address}: ${removedPurchases.deletedCount} purchases, ${sessions.deletedCount} sessions, ${accounts.deletedCount} accounts, ${verifications.deletedCount} pending links.`
    );
  } catch (error) {
    return fail(error);
  }
};

export const createPurchase = async (input: {
  email: string;
  itemId?: string;
  kind: "lifetime" | "yearly" | "item";
  periodEnd?: string;
  status: string;
}): Promise<ActionResult> => {
  try {
    await requireAdmin();
    const address = email.parse(input.email);
    const status = z.enum(PURCHASE_STATUSES).parse(input.status);
    await insertManualPurchase(
      address,
      grant.parse({
        currentPeriodEnd: input.periodEnd,
        itemId: input.itemId,
        kind: input.kind,
      }),
      status
    );
    return done(`Added a ${input.kind} purchase for ${address}.`);
  } catch (error) {
    return fail(error);
  }
};

export const updatePurchase = async (input: {
  email: string;
  id: string;
  itemId?: string;
  kind: "lifetime" | "yearly" | "item";
  periodEnd?: string;
  status: string;
}): Promise<ActionResult> => {
  try {
    await requireAdmin();
    const address = email.parse(input.email);
    const status = z.enum(PURCHASE_STATUSES).parse(input.status);
    const access = grant.parse({
      currentPeriodEnd: input.periodEnd,
      itemId: input.itemId,
      kind: input.kind,
    });
    assertPurchaseShape(access);
    const collection = await purchases();
    const result = await collection.updateOne(
      { _id: input.id },
      {
        $set: {
          currentPeriodEnd: access.currentPeriodEnd,
          email: address,
          itemId: access.itemId,
          kind: access.kind,
          status,
          updatedAt: new Date(),
        } satisfies Partial<PurchaseDoc>,
      }
    );
    if (result.matchedCount === 0) {
      return { error: "No such purchase." };
    }
    return done("Saved.");
  } catch (error) {
    return fail(error);
  }
};

export const deletePurchase = async (input: {
  id: string;
}): Promise<ActionResult> => {
  try {
    await requireAdmin();
    const purchaseCollection = await purchases();
    const result = await purchaseCollection.deleteOne({ _id: input.id });
    if (result.deletedCount === 0) {
      return { error: "No such purchase." };
    }
    return done("Purchase deleted.");
  } catch (error) {
    return fail(error);
  }
};
