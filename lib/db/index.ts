import { MongoClient } from "mongodb";
import type { IndexDescription } from "mongodb";

import type { PurchaseDoc, ResourceDoc } from "./schema";

// One MongoDB client per server process, reused by every request: opening
// a connection per request would be slow and exhaust Atlas's connection
// limit. In development it's kept on globalThis so hot reloads don't open a
// new one each time. The client connects lazily, on the first query.
//
// MONGODB_URI names the database too (…mongodb.net/craftui). Without it
// (e.g. a build that never queries), the placeholder below only fails if a
// query actually runs.
const globalForMongo = globalThis as typeof globalThis & {
  mongoClient?: MongoClient;
};

export const client =
  globalForMongo.mongoClient ??
  new MongoClient(process.env.MONGODB_URI ?? "mongodb://missing-mongodb-uri", {
    appName: "craftui",
  });

if (process.env.NODE_ENV !== "production") {
  globalForMongo.mongoClient = client;
}

export const db = client.db();

// Every collection's indexes, created once per process on first use
// (createIndex is a no-op when the index exists): ours, and better-auth's,
// whose MongoDB adapter doesn't create them itself. The unique ones are what
// stop two accounts for one email, or two sessions sharing a token.
const INDEXES: Record<string, IndexDescription[]> = {
  account: [{ key: { userId: 1 }, name: "account_user_id" }],
  purchase: [
    { key: { email: 1 }, name: "purchase_email" },
    { key: { userId: 1 }, name: "purchase_user_id" },
    { key: { providerOrderId: 1 }, name: "purchase_provider_order_id" },
    {
      key: { providerSubscriptionId: 1 },
      name: "purchase_provider_subscription_id",
    },
  ],
  // The Resources page lists newest first per category and filters by tag.
  resource: [
    { key: { category: 1, createdAt: -1 }, name: "resource_category" },
    { key: { tags: 1 }, name: "resource_tags" },
  ],
  session: [
    { key: { token: 1 }, name: "session_token", unique: true },
    { key: { userId: 1 }, name: "session_user_id" },
  ],
  user: [{ key: { email: 1 }, name: "user_email", unique: true }],
  verification: [{ key: { identifier: 1 }, name: "verification_identifier" }],
};

let indexes: Promise<unknown> | undefined;

const createIndexes = async () => {
  try {
    return await Promise.all(
      Object.entries(INDEXES).map(([name, specs]) =>
        db.collection(name).createIndexes(specs)
      )
    );
  } catch (error) {
    // Try again on the next call instead of caching the failure.
    indexes = undefined;
    throw error;
  }
};

export const ensureIndexes = () => {
  indexes ??= createIndexes();
  return indexes;
};

// Starts index creation without waiting on it, for module load: a failure
// is logged, and the next ensureIndexes() tries again.
export const prepareIndexes = async () => {
  try {
    await ensureIndexes();
  } catch (error) {
    console.error("[db] Couldn't create MongoDB indexes", error);
  }
};

export const purchases = async () => {
  await ensureIndexes();
  return db.collection<PurchaseDoc>("purchase");
};

export const resources = async () => {
  await ensureIndexes();
  return db.collection<ResourceDoc>("resource");
};
