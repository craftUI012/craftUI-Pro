import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { KitCard } from "@/components/design-admin/kit-card";
import { InvoiceDownloadButton } from "@/components/invoice-download-button";
import { SignOutButton } from "@/components/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { formatDate, formatMoney } from "@/lib/admin/format";
import { auth } from "@/lib/auth";
import { getAccount } from "@/lib/billing/account";
import type {
  AccountPayment,
  PaymentStatus,
  PlanSummary,
} from "@/lib/billing/account";
import { backfillPurchasesToUser } from "@/lib/billing/entitlements";
import { cn } from "@/lib/utils";
import { createPageMetadata } from "@/seo/metadata";

// Signed-in only, so never in search results.
export const metadata: Metadata = createPageMetadata({
  noIndex: true,
  path: ROUTES.DASHBOARD,
  title: "Dashboard",
});

const STATUS: Record<
  PaymentStatus,
  { label: string; variant: "destructive" | "outline" | "secondary" }
> = {
  failed: { label: "Failed", variant: "destructive" },
  paid: { label: "Paid", variant: "secondary" },
  "partially-refunded": { label: "Partly refunded", variant: "outline" },
  pending: { label: "Pending", variant: "outline" },
  refunded: { label: "Refunded", variant: "outline" },
};

// The plan as a badge and one line about what it means.
const planCopy = (
  plan: PlanSummary
): { badge: string; detail: string; hasAccess: boolean } => {
  switch (plan.kind) {
    case "lifetime": {
      return {
        badge: "Lifetime",
        detail: "Every section, block and illustration, forever.",
        hasAccess: true,
      };
    }
    case "yearly": {
      return {
        badge: "Yearly",
        detail: plan.periodEnd
          ? `Everything is unlocked. The current year runs until ${formatDate(plan.periodEnd)}.`
          : "Everything is unlocked.",
        hasAccess: true,
      };
    }
    case "items": {
      return {
        badge: `${plan.items.length} ${plan.items.length === 1 ? "item" : "items"}`,
        detail: `You own ${plan.items.join(", ")}.`,
        hasAccess: true,
      };
    }
    default: {
      return {
        badge: "No plan",
        detail: "Get lifetime or yearly access to unlock every item.",
        hasAccess: false,
      };
    }
  }
};

const InvoiceButton = ({ payment }: { payment: AccountPayment }) =>
  payment.id && payment.invoice ? (
    <InvoiceDownloadButton paymentId={payment.id} />
  ) : (
    <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>—</span>
  );

const StatusBadge = ({ status }: { status: PaymentStatus }) => (
  <Badge variant={STATUS[status].variant}>{STATUS[status].label}</Badge>
);

// The signed-in user's account: who they are, their plan, their last
// payment, and every payment with its invoice (from Dodo). Built from the
// design system's kit cards (the /design-admin showcase), so it follows the
// theme in light and dark. Payments are a table from md up and a stacked
// list on phones.
const DashboardPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(ROUTES.LOGIN);
  }

  // Link any guest-checkout purchases (paid before sign-in) to this user.
  await backfillPurchasesToUser(session.user.id);
  const { invoicesAvailable, lastPayment, payments, plan } = await getAccount(
    session.user.id,
    session.user.email
  );
  const { badge, detail, hasAccess } = planCopy(plan);

  const profile = [
    { label: "Name", value: session.user.name || "Not set" },
    { label: "Email", value: session.user.email },
    { label: "Member since", value: formatDate(session.user.createdAt) },
  ];

  return (
    <div className="container-wrapper px-4 lg:px-6">
      <div className="container flex max-w-5xl flex-col gap-8 py-10 lg:py-14">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className={cn(TYPE.headingSection, "tracking-tight")}>
              Dashboard
            </h1>
            <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
              Your plan, payments and invoices.
            </p>
          </div>
          <SignOutButton />
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <KitCard title="Account">
            <dl className="flex flex-col gap-3">
              {profile.map((row) => (
                <div key={row.label} className="flex flex-col gap-0.5">
                  <dt className={cn(TYPE.cardCaption, "text-muted-foreground")}>
                    {row.label}
                  </dt>
                  <dd className={cn(TYPE.cardBody, "break-all")}>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
          </KitCard>

          <KitCard
            title="Plan"
            action={
              <Badge variant={hasAccess ? "default" : "outline"}>{badge}</Badge>
            }
            footer={
              <Button asChild size="sm" variant="outline">
                <Link href={hasAccess ? ROUTES.HOME : ROUTES.PRICING}>
                  {hasAccess ? "Browse the library" : "See plans"}
                </Link>
              </Button>
            }
          >
            <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
              {detail}
            </p>
          </KitCard>

          <KitCard title="Last payment">
            {lastPayment ? (
              <div className="flex flex-col gap-1">
                <p className={cn(TYPE.cardMetric, "tabular-nums")}>
                  {formatMoney(lastPayment.amountCents, lastPayment.currency)}
                </p>
                <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
                  {lastPayment.description} ·{" "}
                  {formatDate(lastPayment.createdAt)}
                </p>
              </div>
            ) : (
              <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
                No payments yet.
              </p>
            )}
          </KitCard>
        </div>

        <KitCard
          title="Payments"
          description={
            invoicesAvailable
              ? "Every charge, newest first. Download an invoice for your records."
              : "Invoices can't be loaded right now. Your payments below are from our records; try again later for invoices."
          }
          contentClassName="px-0 md:px-4"
        >
          {payments.length === 0 ? (
            <p
              className={cn(
                TYPE.cardBody,
                "text-muted-foreground px-4 md:px-0"
              )}
            >
              No payments yet.
            </p>
          ) : (
            <>
              {/* From md up: a table. */}
              <Table className="hidden md:table">
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Invoice</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((payment, index) => (
                    <TableRow key={payment.id ?? index}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(payment.createdAt)}
                      </TableCell>
                      <TableCell>{payment.description}</TableCell>
                      <TableCell>
                        <StatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(payment.amountCents, payment.currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <InvoiceButton payment={payment} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Phones: one stacked row per payment. */}
              <ul className="divide-y border-t md:hidden">
                {payments.map((payment, index) => (
                  <li
                    key={payment.id ?? index}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className={cn(TYPE.cardLabel, "truncate")}>
                        {payment.description}
                      </p>
                      <p
                        className={cn(
                          TYPE.cardCaption,
                          "text-muted-foreground flex flex-wrap items-center gap-2"
                        )}
                      >
                        <span className="tabular-nums">
                          {formatMoney(payment.amountCents, payment.currency)}
                        </span>
                        <span aria-hidden>·</span>
                        {formatDate(payment.createdAt)}
                        <StatusBadge status={payment.status} />
                      </p>
                    </div>
                    <InvoiceButton payment={payment} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </KitCard>
      </div>
    </div>
  );
};

export default DashboardPage;
