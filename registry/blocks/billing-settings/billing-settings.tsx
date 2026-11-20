"use client";

import {
  CreditCardIcon,
  Folder01Icon,
  Home01Icon,
  Plug01Icon,
  Settings02Icon,
  SquareLock02Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import type * as React from "react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import { BillingActionsProvider, DEMO_ACTIONS } from "./actions";
import type { BillingActions, BillingInfo } from "./actions";
import { AppShell } from "./app-shell";
import type { AppShellProps } from "./app-shell";
import { BillingDetailsCard, DEMO_BILLING } from "./billing-details";
import { CardMark } from "./brand-marks";
import { describe, healthOf, statusLine } from "./card-data";
import type { CardBook, SavedCard } from "./card-data";
import { PaymentMethodsDialog } from "./payment-methods-dialog";
import { LIFT } from "./surface";
import {
  Amount,
  LinkAction,
  Pill,
  RowDownload,
  SummaryCard,
  usd,
  useAppear,
} from "./ui";
import type { WalletState } from "./wallets";

/* ─────────────────────────────────────────────────────────
 * BILLING SETTINGS: a SaaS subscription billing page inside the app.
 *
 *   ┌ Current plan ─────────────── Active ┐ ┌ Payment method ─ Expiring ┐
 *   │ $25 per month                       │ │ [VISA] Visa ending 4242    │
 *   │ Plan   Seats   Renews   Next invoice│ │ Expires soon, 01/27        │
 *   │ Change plan ›                       │ │ Manage payment methods ›   │
 *   └─────────────────────────────────────┘ └────────────────────────────┘
 *   ┌ Billing details ──────────────────────────────────────────── Edit ┐
 *   ┌ Invoices ─────────────────────────────────────────────── View all ┐
 *   │ Invoice   Date   Plan   Status   Amount                         ↓ │
 *
 * One fact per place: the price lives on the plan card, every payment in
 * the table. Details are label over value, never joined with dots.
 *
 * "Manage payment methods" opens the dialog: a method switcher (Cards,
 * PayPal, Apple Pay, Google Pay) over one panel; cards are slots you
 * choose, edit, add and remove in place. Every call to your server goes
 * through `actions` (see actions.tsx); leave it out for the demo.
 * ───────────────────────────────────────────────────────── */

export interface BillingPlan {
  /** Plan name, e.g. "Pro". */
  name: string;
  /** Price per interval, in dollars. */
  price: number;
  /** Billed each month or each year. */
  interval: "month" | "year";
  /** Seats on the plan. */
  seats: number;
  /** When it renews, as you want it shown, e.g. "Dec 1, 2026". */
  renewsOn: string;
  /** The next invoice's total, in dollars. */
  nextInvoice: number;
  /** "active" shows a green pill; "past_due" an amber one. */
  status: "active" | "past_due" | "canceled";
}

export interface Invoice {
  /** Shown as the invoice number, e.g. "#1042". */
  id: string;
  /** As you want it shown, e.g. "Nov 1, 2026". */
  date: string;
  /** What it was for, e.g. "Pro, 10 seats". */
  description: string;
  /** In dollars. */
  amount: number;
  /** Shown as a pill: Paid, Open, Failed or Refunded. */
  status: "paid" | "open" | "failed" | "refunded";
}

export interface BillingSettingsProps {
  /** The app around the page: brand, sidebar links, the person. */
  shell?: Partial<Omit<AppShellProps, "children">>;
  /** The current plan and its next invoice. */
  plan?: BillingPlan;
  /** Saved cards, the default one and the backup. */
  cards?: CardBook;
  /** Wallets already connected (the account), or null. */
  wallets?: WalletState;
  /** What prints on every invoice. */
  billing?: BillingInfo;
  /** Recent invoices, newest first. */
  invoices?: Invoice[];
  /** Your server calls; anything left out uses the demo. */
  actions?: Partial<BillingActions>;
  /** Opens your plan picker. */
  onChangePlan?: () => void;
  /** Opens your full invoice list. */
  onViewAllInvoices?: () => void;
  /** Height and placement of the app, e.g. "h-dvh" or "h-[46rem]". */
  className?: string;
}

/* ---------------------------------- Demo ---------------------------------- */

export const DEMO_PLAN: BillingPlan = {
  interval: "month",
  name: "Pro",
  nextInvoice: 25,
  price: 25,
  renewsOn: "Dec 1, 2026",
  seats: 10,
  status: "active",
};

// One of each health, so every state shows: expiring soon, declined
// (Retry), expired (Update, can't be chosen).
export const DEMO_CARDS: CardBook = {
  backupId: "mc",
  cards: [
    {
      addedBy: "Maya Chen",
      addedOn: "Mar 2, 2024",
      brand: "visa",
      expires: "01/27",
      id: "visa",
      last4: "4242",
      name: "Maya Chen",
      nickname: "Company card",
    },
    {
      addedBy: "Sam Ortiz",
      addedOn: "Jun 18, 2025",
      brand: "mastercard",
      declinedOn: "Nov 1",
      expires: "08/28",
      id: "mc",
      last4: "8210",
      name: "Sam Ortiz",
    },
    {
      addedBy: "Maya Chen",
      addedOn: "Oct 9, 2022",
      brand: "amex",
      expires: "10/26",
      id: "amex",
      last4: "1005",
      name: "Maya Chen",
      nickname: "Personal",
    },
  ],
  defaultId: "visa",
};

export const DEMO_WALLETS: WalletState = {
  apple: null,
  google: null,
  paypal: "maya@acme.co",
};

export const DEMO_INVOICES: Invoice[] = [
  {
    amount: 25,
    date: "Nov 1, 2026",
    description: "Pro, 10 seats",
    id: "#1042",
    status: "paid",
  },
  {
    amount: 25,
    date: "Oct 1, 2026",
    description: "Pro, 10 seats",
    id: "#1031",
    status: "paid",
  },
  {
    amount: 18.4,
    date: "Sep 14, 2026",
    description: "Pro, prorated",
    id: "#1019",
    status: "paid",
  },
  {
    amount: 12,
    date: "Sep 1, 2026",
    description: "Starter, 4 seats",
    id: "#1007",
    status: "paid",
  },
];

export const DEMO_SHELL: Omit<AppShellProps, "children"> = {
  active: "billing",
  brand: "Acme",
  brandColor: "#4F46E5",
  description: "Your plan, invoices and the card we charge.",
  groups: [
    {
      items: [
        { icon: Home01Icon, id: "home", label: "Home" },
        { icon: Folder01Icon, id: "projects", label: "Projects" },
        { icon: UserGroupIcon, id: "members", label: "Members" },
        { icon: Plug01Icon, id: "integrations", label: "Integrations" },
      ],
    },
    {
      items: [
        { icon: Settings02Icon, id: "general", label: "General" },
        { icon: CreditCardIcon, id: "billing", label: "Billing" },
        { icon: SquareLock02Icon, id: "security", label: "Security" },
      ],
      label: "Settings",
    },
  ],
  title: "Billing",
  trail: ["Settings", "Billing"],
  user: { email: "maya@acme.co", name: "Maya Chen" },
};

/* --------------------------------- Pieces --------------------------------- */

const HEALTH_TONE = {
  declined: "text-red-600 dark:text-red-400",
  expired: "text-red-600 dark:text-red-400",
  expiring: "text-amber-700 dark:text-amber-400",
  ok: "text-muted-foreground",
  updated: "text-emerald-700 dark:text-emerald-400",
};

const HealthPill = ({ card }: { card: SavedCard }) => {
  const health = healthOf(card);
  if (health === "expiring") {
    return <Pill tone="warn">Expiring</Pill>;
  }
  if (health === "declined") {
    return <Pill tone="bad">Payment failed</Pill>;
  }
  return null;
};

const PLAN_STATUS = {
  active: { tone: "ok", word: "Active" },
  canceled: { tone: "muted", word: "Canceled" },
  past_due: { tone: "warn", word: "Past due" },
} as const;

const INVOICE_STATUS = {
  failed: { tone: "bad", word: "Failed" },
  open: { tone: "warn", word: "Open" },
  paid: { tone: "ok", word: "Paid" },
  refunded: { tone: "muted", word: "Refunded" },
} as const;

const Detail = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="text-sm tabular-nums">{children}</dd>
  </div>
);

const TH =
  "text-muted-foreground bg-muted/60 dark:bg-muted/40 h-8 px-2 text-left text-xs font-normal first:rounded-l-lg last:rounded-r-lg sm:px-3";
const TD = "h-12 px-2 text-sm sm:px-3";

const InvoiceTable = ({
  invoices,
  onViewAll,
}: {
  invoices: Invoice[];
  onViewAll?: () => void;
}) => (
  <section
    aria-labelledby="billing-invoices"
    className={cn(LIFT, "bg-card flex flex-col gap-2 rounded-2xl p-2")}
  >
    <div className="flex items-center justify-between gap-3 px-2 pt-2">
      <h2 id="billing-invoices" className="text-sm font-medium">
        Invoices
      </h2>
      <LinkAction label="View all invoices" onClick={onViewAll}>
        View all
      </LinkAction>
    </div>
    {/* relative: keeps the hidden "Download" header label inside. */}
    <div className="relative overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 sm:min-w-[30rem]">
        <thead>
          <tr>
            <th scope="col" className={TH}>
              Invoice
            </th>
            <th scope="col" className={cn(TH, "max-sm:hidden")}>
              Date
            </th>
            <th scope="col" className={cn(TH, "max-sm:hidden")}>
              Plan
            </th>
            <th scope="col" className={TH}>
              Status
            </th>
            <th scope="col" className={cn(TH, "text-right")}>
              Amount
            </th>
            <th scope="col" className={cn(TH, "w-12")}>
              <span className="sr-only">Download</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((row) => (
            <tr key={row.id}>
              <td className={cn(TD, "tabular-nums")}>
                {row.id}
                {/* Phones: the date folds under the number. */}
                <span className="text-muted-foreground block text-xs sm:hidden">
                  {row.date}
                </span>
              </td>
              <td
                className={cn(
                  TD,
                  "text-muted-foreground tabular-nums max-sm:hidden"
                )}
              >
                {row.date}
              </td>
              <td className={cn(TD, "text-muted-foreground max-sm:hidden")}>
                {row.description}
              </td>
              <td className={TD}>
                <span className="inline-flex">
                  <Pill tone={INVOICE_STATUS[row.status].tone}>
                    {INVOICE_STATUS[row.status].word}
                  </Pill>
                </span>
              </td>
              <td className={cn(TD, "text-right tabular-nums")}>
                {usd(row.amount)}
              </td>
              <td className={cn(TD, "px-1 text-right")}>
                <RowDownload id={row.id} what={`invoice ${row.id}`} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

/* ---------------------------------- Block --------------------------------- */

export const BillingSettings = ({
  shell,
  plan = DEMO_PLAN,
  cards = DEMO_CARDS,
  wallets = DEMO_WALLETS,
  billing = DEMO_BILLING,
  invoices = DEMO_INVOICES,
  actions,
  onChangePlan,
  onViewAllInvoices,
  className,
}: BillingSettingsProps) => {
  const { ref, shown } = useAppear({ price: plan.price }, { price: 0 });
  const [book, setBook] = useState(cards);
  const [managing, setManaging] = useState(false);
  const merged = useMemo(() => ({ ...DEMO_ACTIONS, ...actions }), [actions]);
  const card = book.cards.find((each) => each.id === book.defaultId);
  const backup = book.cards.find((each) => each.id === book.backupId);
  const status = PLAN_STATUS[plan.status];

  return (
    <BillingActionsProvider value={merged}>
      <AppShell {...DEMO_SHELL} {...shell} className={className}>
        <div className="flex w-full flex-col gap-3">
          <div ref={ref} className="grid w-full gap-3 lg:grid-cols-3">
            <SummaryCard
              label="Current plan"
              className="lg:col-span-2"
              aside={<Pill tone={status.tone}>{status.word}</Pill>}
            >
              <Amount
                text={usd(shown.price, false)}
                suffix={plan.interval === "month" ? "per month" : "per year"}
              />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
                <Detail label="Plan">{plan.name}</Detail>
                <Detail label="Seats">{plan.seats}</Detail>
                <Detail label="Renews">{plan.renewsOn}</Detail>
                <Detail label="Next invoice">{usd(plan.nextInvoice)}</Detail>
              </dl>
              <div className="mt-auto">
                <LinkAction onClick={onChangePlan}>Change plan</LinkAction>
              </div>
            </SummaryCard>

            <SummaryCard
              label="Payment method"
              aside={card ? <HealthPill card={card} /> : null}
            >
              {card ? (
                <div className="flex items-center gap-3">
                  <CardMark brand={card.brand} />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="truncate text-sm">{describe(card)}</p>
                    <p
                      className={cn(
                        "text-xs tabular-nums",
                        HEALTH_TONE[healthOf(card)]
                      )}
                    >
                      {statusLine(card)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">No card on file</p>
              )}
              {backup ? (
                <p className="text-muted-foreground text-xs">
                  Backup: {describe(backup)}
                </p>
              ) : null}
              <div className="mt-auto">
                <LinkAction onClick={() => setManaging(true)}>
                  Manage payment methods
                </LinkAction>
              </div>
              <PaymentMethodsDialog
                open={managing}
                onOpenChange={setManaging}
                saved={book}
                onSave={setBook}
                initialWallets={wallets}
              />
            </SummaryCard>
          </div>

          <BillingDetailsCard initial={billing} />

          <InvoiceTable invoices={invoices} onViewAll={onViewAllInvoices} />
        </div>
      </AppShell>
    </BillingActionsProvider>
  );
};

export default BillingSettings;
