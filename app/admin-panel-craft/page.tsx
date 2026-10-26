import Link from "next/link";

import { StatusBadge } from "@/components/admin-panel/access-badges";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { getOverview } from "@/lib/admin/data";
import { formatDateTime, formatMoney } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/session";

// The panel's first page: totals, and the latest purchases.
const AdminOverviewPage = async () => {
  await requireAdminPage();
  const overview = await getOverview();

  const stats = [
    {
      hint: "Accounts created by signing in or added here",
      label: "Users",
      value: overview.userCount,
    },
    {
      hint: "Signed-in browsers right now",
      label: "Active sessions",
      value: overview.sessionCount,
    },
    {
      hint: `${overview.activePurchases} granting access now`,
      label: "Purchases",
      value: overview.purchaseCount,
    },
    {
      hint: "Paid, but the buyer hasn't signed in yet",
      label: "Guest purchases",
      value: overview.guestPurchases,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground text-xs">
              {stat.hint}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardDescription>Revenue (not refunded)</CardDescription>
          <CardTitle className="text-2xl tabular-nums">
            {overview.revenue.length === 0
              ? "—"
              : overview.revenue
                  .map((entry) => formatMoney(entry.cents, entry.currency))
                  .join(" · ")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground text-xs">
          From the amounts Dodo reported. Manual grants have no amount.
          Dodo&apos;s dashboard is the source of truth for payouts.
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Latest purchases</h2>
          <Link
            href={`${ROUTES.ADMIN_PANEL}/purchases`}
            className="text-sm underline underline-offset-4"
          >
            All purchases
          </Link>
        </div>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.recentPurchases.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground text-center"
                  >
                    No purchases yet.
                  </TableCell>
                </TableRow>
              )}
              {overview.recentPurchases.map((purchase) => (
                <TableRow key={purchase._id}>
                  <TableCell className="font-medium">
                    {purchase.email}
                  </TableCell>
                  <TableCell>
                    {purchase.kind}
                    {purchase.itemId ? ` · ${purchase.itemId}` : ""}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={purchase.status} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatMoney(purchase.amountCents, purchase.currency)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(purchase.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
};

export default AdminOverviewPage;
