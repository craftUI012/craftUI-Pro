// oxlint-disable unicorn/no-array-method-this-argument -- Every .find() here is MongoDB's find(filter, options), not Array#find.
import { ObjectId } from "mongodb";
import type { Document, Filter } from "mongodb";

import { isGranting, summarizeAccess } from "@/lib/billing/entitlements";
import type { Entitlements } from "@/lib/billing/entitlements";
import { db, ensureIndexes, purchases } from "@/lib/db";
import type { PurchaseDoc } from "@/lib/db/schema";
import registry from "@/registry.json";

// Everything the admin panel (app/admin-panel-craft) reads. Pages call these
// only after the admin check in the panel's layout; writes are in the
// panel's actions.ts.

// better-auth's user document.
export interface UserDoc {
  _id: ObjectId;
  createdAt: Date;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  name: string;
  updatedAt: Date;
}

interface SessionDoc {
  _id: ObjectId;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string | null;
  token: string;
  updatedAt: Date;
  userAgent?: string | null;
  userId: ObjectId;
}

// What the panel shows of a user: the ID as its hex string (as purchases and
// install tokens hold it).
export interface AdminUser {
  createdAt: Date;
  email: string;
  emailVerified: boolean;
  id: string;
  name: string;
  updatedAt: Date;
}

export interface AdminSession {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  ipAddress: string | null;
  tokenPreview: string;
  userAgent: string | null;
}

// The raw collections the panel can browse.
export const COLLECTIONS = [
  "user",
  "session",
  "account",
  "verification",
  "purchase",
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

const toAdminUser = (user: UserDoc): AdminUser => ({
  createdAt: user.createdAt,
  email: user.email,
  emailVerified: user.emailVerified,
  id: user._id.toHexString(),
  name: user.name,
  updatedAt: user.updatedAt,
});

const users = async () => {
  await ensureIndexes();
  return db.collection<UserDoc>("user");
};

const sessions = () => db.collection<SessionDoc>("session");

// Secrets are shortened wherever the panel shows them: a session token or a
// pending sign-in link's token is as good as being signed in.
const preview = (secret: string) =>
  secret.length > 8 ? `${secret.slice(0, 6)}…` : "••••";

const SECRET_FIELDS: Partial<Record<CollectionName, string[]>> = {
  account: ["accessToken", "idToken", "password", "refreshToken"],
  session: ["token"],
  verification: ["identifier"],
};

// A user's ObjectId from its hex string, or null for anything else.
export const toObjectId = (id: string) =>
  ObjectId.isValid(id) && id.length === 24 ? new ObjectId(id) : null;

const escapeRegex = (value: string) =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

// Purchases that belong to these users: by user ID, or by email (a guest
// purchase isn't linked to its user until they visit the dashboard).
const purchasesOf = async (list: AdminUser[]) => {
  if (list.length === 0) {
    return [];
  }
  const collection = await purchases();
  return collection
    .find(
      {
        $or: [
          { userId: { $in: list.map((user) => user.id) } },
          { email: { $in: list.map((user) => user.email.toLowerCase()) } },
        ],
      },
      { sort: { createdAt: -1 } }
    )
    .toArray();
};

const belongsTo = (user: AdminUser) => (purchase: PurchaseDoc) =>
  purchase.userId === user.id || purchase.email === user.email.toLowerCase();

// Product codes and titles of every library item, for the "item" purchase
// form and for showing what an item purchase is.
export const itemOptions = () =>
  registry.items.flatMap((item) => {
    const meta = item.meta as { id?: string } | undefined;
    return meta?.id ? [{ id: meta.id, title: item.title ?? item.name }] : [];
  });

export const getOverview = async () => {
  const [userCollection, purchaseCollection] = await Promise.all([
    users(),
    purchases(),
  ]);
  const now = new Date();
  const [userCount, sessionCount, allPurchases] = await Promise.all([
    userCollection.countDocuments(),
    sessions().countDocuments({ expiresAt: { $gt: now } }),
    purchaseCollection.find({}, { sort: { createdAt: -1 } }).toArray(),
  ]);

  const granting = allPurchases.filter(isGranting);
  // Revenue per currency, from purchases that weren't refunded. Manual
  // grants carry no amount.
  const revenue = new Map<string, number>();
  for (const purchase of allPurchases) {
    if (purchase.status !== "refunded" && purchase.amountCents !== null) {
      const currency = purchase.currency ?? "USD";
      revenue.set(
        currency,
        (revenue.get(currency) ?? 0) + purchase.amountCents
      );
    }
  }

  return {
    activePurchases: granting.length,
    guestPurchases: allPurchases.filter((purchase) => purchase.userId === null)
      .length,
    purchaseCount: allPurchases.length,
    recentPurchases: allPurchases.slice(0, 8),
    revenue: [...revenue].map(([currency, cents]) => ({ cents, currency })),
    sessionCount,
    userCount,
  };
};

export interface AdminUserRow {
  access: Entitlements;
  lastSessionAt: Date | null;
  purchaseCount: number;
  sessionCount: number;
  user: AdminUser;
}

// Users (newest first), optionally filtered by a search over email and name,
// each with what they own and how many browsers they're signed in on.
export const listUsers = async (query: string): Promise<AdminUserRow[]> => {
  const collection = await users();
  const search = query.trim();
  const filter: Filter<UserDoc> = search
    ? {
        $or: [
          { email: { $options: "i", $regex: escapeRegex(search) } },
          { name: { $options: "i", $regex: escapeRegex(search) } },
        ],
      }
    : {};
  const docs = await collection
    .find(filter, { limit: 500, sort: { createdAt: -1 } })
    .toArray();
  const list = docs.map(toAdminUser);

  const [owned, sessionStats] = await Promise.all([
    purchasesOf(list),
    sessions()
      .aggregate<{ _id: ObjectId; count: number; last: Date }>([
        {
          $match: {
            expiresAt: { $gt: new Date() },
            userId: { $in: list.map((user) => new ObjectId(user.id)) },
          },
        },
        {
          $group: {
            _id: "$userId",
            count: { $sum: 1 },
            last: { $max: "$updatedAt" },
          },
        },
      ])
      .toArray(),
  ]);
  const statsByUser = new Map(
    sessionStats.map((stat) => [stat._id.toHexString(), stat])
  );

  return list.map((user) => {
    const mine = owned.filter(belongsTo(user));
    const stats = statsByUser.get(user.id);
    return {
      access: summarizeAccess(mine),
      lastSessionAt: stats?.last ?? null,
      purchaseCount: mine.length,
      sessionCount: stats?.count ?? 0,
      user,
    };
  });
};

// One user and everything stored about them, or null if there's no such user.
export const getUserDetail = async (id: string) => {
  const objectId = toObjectId(id);
  if (!objectId) {
    return null;
  }
  const collection = await users();
  const found = await collection.findOne({ _id: objectId });
  if (!found) {
    return null;
  }
  const user = toAdminUser(found);

  const [owned, sessionDocs, accounts, verificationCount] = await Promise.all([
    purchasesOf([user]),
    sessions()
      .find({ userId: objectId }, { sort: { updatedAt: -1 } })
      .toArray(),
    db
      .collection("account")
      .find({ userId: objectId })
      .project<{ _id: ObjectId; createdAt?: Date; providerId?: string }>({
        createdAt: 1,
        providerId: 1,
      })
      .toArray(),
    // Pending sign-in links: magic-link verifications store the email in
    // their value.
    db.collection("verification").countDocuments({
      value: { $regex: escapeRegex(user.email) },
    }),
  ]);

  return {
    access: summarizeAccess(owned),
    accounts: accounts.map((account) => ({
      createdAt: account.createdAt ?? null,
      id: account._id.toHexString(),
      providerId: account.providerId ?? "unknown",
    })),
    purchases: owned,
    sessions: sessionDocs.map(
      (session): AdminSession => ({
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        id: session._id.toHexString(),
        ipAddress: session.ipAddress ?? null,
        tokenPreview: preview(session.token),
        userAgent: session.userAgent ?? null,
      })
    ),
    user,
    verificationCount,
  };
};

export interface PurchaseFilters {
  kind?: string;
  query?: string;
  status?: string;
}

// Every purchase (newest first), guests included, with the user it belongs
// to when there's one.
export const listPurchases = async ({
  kind,
  query,
  status,
}: PurchaseFilters) => {
  const collection = await purchases();
  const filter: Filter<PurchaseDoc> = {};
  if (kind) {
    filter.kind = kind as PurchaseDoc["kind"];
  }
  if (status) {
    filter.status = status;
  }
  const search = query?.trim();
  if (search) {
    filter.$or = [
      { email: { $options: "i", $regex: escapeRegex(search) } },
      { _id: { $options: "i", $regex: escapeRegex(search) } },
    ];
  }
  const rows = await collection
    .find(filter, { limit: 500, sort: { createdAt: -1 } })
    .toArray();

  const emails = [...new Set(rows.map((row) => row.email))];
  const userCollection = await users();
  const owners = await userCollection
    .find({ email: { $in: emails } })
    .project<{ _id: ObjectId; email: string }>({ email: 1 })
    .toArray();
  const ownerByEmail = new Map(
    owners.map((owner) => [owner.email.toLowerCase(), owner._id.toHexString()])
  );

  return rows.map((purchase) => ({
    ownerId: purchase.userId ?? ownerByEmail.get(purchase.email) ?? null,
    purchase,
  }));
};

const PAGE_SIZE = 20;

// One page of a collection's raw documents, as JSON, newest first, with
// secrets shortened.
export const listCollection = async (name: CollectionName, page: number) => {
  await ensureIndexes();
  const collection = db.collection<Document>(name);
  const [total, docs] = await Promise.all([
    collection.countDocuments(),
    collection
      .find(
        {},
        { limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE, sort: { _id: -1 } }
      )
      .toArray(),
  ]);
  const secrets = SECRET_FIELDS[name] ?? [];

  return {
    docs: docs.map((doc) => {
      const shown: Document = { ...doc };
      for (const field of secrets) {
        if (typeof shown[field] === "string") {
          shown[field] = preview(shown[field]);
        }
      }
      return { id: String(doc._id), json: JSON.stringify(shown, null, 2) };
    }),
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    total,
  };
};
