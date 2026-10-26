// oxlint-disable unicorn/no-array-method-this-argument -- .find() here is MongoDB's find(filter, options), not Array#find.
import type { PaymentListResponse } from "dodopayments/resources/payments";

import { isGranting } from "@/lib/billing/entitlements";
import { purchases } from "@/lib/db";
import type { PurchaseDoc } from "@/lib/db/schema";
import { getDodo, isDodoConfigured } from "@/lib/dodo";
import { getRegistryItem } from "@/lib/registry-items";

// What the user dashboard (app/(app)/dashboard) shows: the plan, and every
// payment with its invoice. Purchases come from our database; payments come
// from Dodo, which holds each charge (a yearly plan has one per renewal) and
// its invoice.

export type PlanSummary =
  | { kind: "lifetime" }
  | { kind: "yearly"; periodEnd: Date | null }
  | { items: string[]; kind: "items" }
  | { kind: "none" };

export type PaymentStatus =
  | "failed"
  | "paid"
  | "partially-refunded"
  | "pending"
  | "refunded";

export interface AccountPayment {
  amountCents: number;
  createdAt: Date;
  currency: string;
  // "Lifetime plan", "Yearly plan", or an item's name.
  description: string;
  // Dodo's payment ID, for the invoice download. Null when the payment
  // only exists in our records (Dodo unreachable).
  id: string | null;
  // An invoice exists for paid (and refunded) payments.
  invoice: boolean;
  status: PaymentStatus;
}

// Every purchase of this user, newest first: linked to them, or bought with
// their email before they signed in.
const purchasesOf = async (userId: string, email: string) => {
  const collection = await purchases();
  return collection
    .find(
      { $or: [{ userId }, { email: email.toLowerCase() }] },
      { sort: { createdAt: -1 } }
    )
    .toArray();
};

// The Dodo customers this user paid as (one per email they checked out
// with, in practice one).
const dodoCustomerIds = (rows: PurchaseDoc[]) => [
  ...new Set(
    rows.flatMap((row) =>
      row.provider === "dodo" && row.providerCustomerId
        ? [row.providerCustomerId]
        : []
    )
  ),
];

const itemTitle = (itemId: string | null) =>
  (itemId ? getRegistryItem(itemId)?.title : undefined) ?? "craftUI item";

// The best plan they hold right now: lifetime beats yearly beats items.
const planOf = (rows: PurchaseDoc[]): PlanSummary => {
  const active = rows.filter(isGranting);
  if (active.some((row) => row.kind === "lifetime")) {
    return { kind: "lifetime" };
  }
  const yearly = active.find((row) => row.kind === "yearly");
  if (yearly) {
    return { kind: "yearly", periodEnd: yearly.currentPeriodEnd };
  }
  const items = active.filter((row) => row.kind === "item");
  if (items.length > 0) {
    return { items: items.map((row) => itemTitle(row.itemId)), kind: "items" };
  }
  return { kind: "none" };
};

const describe = (kind: PurchaseDoc["kind"], itemId: string | null) => {
  if (kind === "lifetime") {
    return "Lifetime plan";
  }
  if (kind === "yearly") {
    return "Yearly plan";
  }
  return itemTitle(itemId);
};

const statusOf = (payment: PaymentListResponse): PaymentStatus => {
  if (payment.status === "succeeded") {
    if (payment.refund_status === "full") {
      return "refunded";
    }
    return payment.refund_status === "partial" ? "partially-refunded" : "paid";
  }
  if (payment.status === "failed" || payment.status === "cancelled") {
    return "failed";
  }
  return "pending";
};

// A payment from Dodo, described by the purchase it belongs to: a
// subscription charge is the yearly plan; a one-time charge is the
// lifetime plan or an item, whichever our record for it says.
const fromDodo = (
  payment: PaymentListResponse,
  rows: PurchaseDoc[]
): AccountPayment => {
  const subscription =
    payment.subscription_id ?? payment.subscription_ids[0] ?? null;
  const purchase = rows.find(
    (row) =>
      row.providerOrderId === payment.payment_id ||
      (subscription !== null && row.providerSubscriptionId === subscription)
  );
  const status = statusOf(payment);
  let description = "craftUI purchase";
  if (purchase) {
    description = describe(purchase.kind, purchase.itemId);
  } else if (subscription) {
    description = "Yearly plan";
  }
  return {
    amountCents: payment.total_amount,
    createdAt: new Date(payment.created_at),
    currency: payment.currency,
    description,
    id: payment.payment_id,
    invoice: status !== "failed" && status !== "pending",
    status,
  };
};

// Without Dodo (no key, or it's down): one row per paid purchase from our
// records, without invoices. Manual grants (no amount) aren't payments.
const fromRecords = (rows: PurchaseDoc[]): AccountPayment[] =>
  rows.flatMap((row) =>
    row.amountCents === null
      ? []
      : [
          {
            amountCents: row.amountCents,
            createdAt: row.createdAt,
            currency: row.currency ?? "USD",
            description: describe(row.kind, row.itemId),
            id: null,
            invoice: false,
            status: row.status === "refunded" ? "refunded" : "paid",
          } satisfies AccountPayment,
        ]
  );

// Up to this many payments per Dodo customer: years of renewals.
const PAYMENT_LIMIT = 100;

const paymentsOf = async (
  rows: PurchaseDoc[]
): Promise<{ invoicesAvailable: boolean; payments: AccountPayment[] }> => {
  const customers = dodoCustomerIds(rows);
  if (customers.length === 0) {
    return { invoicesAvailable: true, payments: [] };
  }
  if (!isDodoConfigured()) {
    return { invoicesAvailable: false, payments: fromRecords(rows) };
  }
  try {
    const lists = await Promise.all(
      customers.map(async (customerId) => {
        const found: PaymentListResponse[] = [];
        for await (const payment of getDodo().payments.list({
          customer_id: customerId,
          page_size: PAYMENT_LIMIT,
        })) {
          found.push(payment);
          if (found.length >= PAYMENT_LIMIT) {
            break;
          }
        }
        return found;
      })
    );
    const payments = lists
      .flat()
      .map((payment) => fromDodo(payment, rows))
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { invoicesAvailable: true, payments };
  } catch (error) {
    console.error("[account] Couldn't list Dodo payments", error);
    return { invoicesAvailable: false, payments: fromRecords(rows) };
  }
};

export const getAccount = async (userId: string, email: string) => {
  const rows = await purchasesOf(userId, email);
  const { invoicesAvailable, payments } = await paymentsOf(rows);
  return {
    invoicesAvailable,
    lastPayment:
      payments.find((payment) => payment.status !== "failed") ?? null,
    payments,
    plan: planOf(rows),
  };
};

// Whether this Dodo payment belongs to this user, before handing them its
// invoice: it must be charged to one of their Dodo customers. Throws if
// Dodo can't be reached.
export const ownsPayment = async (
  userId: string,
  email: string,
  paymentId: string
) => {
  const customers = dodoCustomerIds(await purchasesOf(userId, email));
  if (customers.length === 0) {
    return false;
  }
  const payment = await getDodo().payments.retrieve(paymentId);
  return customers.includes(payment.customer.customer_id);
};
