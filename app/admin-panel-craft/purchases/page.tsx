import Link from "next/link";

import { StatusBadge } from "@/components/admin-panel/access-badges";
import {
  DeletePurchaseButton,
  PurchaseDialog,
} from "@/components/admin-panel/purchase-forms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { PURCHASE_KINDS, PURCHASE_STATUSES } from "@/lib/admin/constants";
import { itemOptions, listPurchases } from "@/lib/admin/data";
import { formatDate, formatMoney } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/session";

// Every purchase, guests included (paid, not signed in yet), filterable by
// email or ID (?q=), kind and status. Add a purchase to grant access by hand.
const AdminPurchasesPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string; status?: string }>;
}) => {
  await requireAdminPage();
  const { kind = "", q = "", status = "" } = await searchParams;
  const rows = await listPurchases({ kind, query: q, status });
  const items = itemOptions();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Purchases{" "}
          <span className="text-muted-foreground font-normal">
            {rows.length}
          </span>
        </h1>
        <PurchaseDialog items={items} />
      </div>

      <form className="flex flex-wrap items-center gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search email or ID"
          className="w-56"
        />
        <NativeSelect name="kind" defaultValue={kind} aria-label="Kind">
          <NativeSelectOption value="">All kinds</NativeSelectOption>
          {PURCHASE_KINDS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect name="status" defaultValue={status} aria-label="Status">
          <NativeSelectOption value="">All statuses</NativeSelectOption>
          {PURCHASE_STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {value.replaceAll("_", " ")}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button type="submit" variant="outline" size="sm">
          Filter
        </Button>
        {(q || kind || status) && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`${ROUTES.ADMIN_PANEL}/purchases`}>Clear</Link>
          </Button>
        )}
      </form>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Ends</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>Bought</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground text-center"
                >
                  No purchases match.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ ownerId, purchase }) => (
              <TableRow key={purchase._id}>
                <TableCell className="font-medium">
                  {ownerId ? (
                    <Link
                      href={`${ROUTES.ADMIN_PANEL}/users/${ownerId}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {purchase.email}
                    </Link>
                  ) : (
                    <>
                      {purchase.email}
                      <div className="text-muted-foreground text-xs font-normal">
                        Guest: hasn&apos;t signed in
                      </div>
                    </>
                  )}
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
                <TableCell>
                  {purchase.kind === "yearly"
                    ? formatDate(purchase.currentPeriodEnd)
                    : "Never"}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {purchase.provider}
                  <div className="text-muted-foreground">{purchase._id}</div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(purchase.createdAt)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <PurchaseDialog
                    items={items}
                    purchase={purchase}
                    trigger="edit"
                  />
                  <DeletePurchaseButton purchase={purchase} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminPurchasesPage;
