import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AccessBadges,
  StatusBadge,
} from "@/components/admin-panel/access-badges";
import {
  DeletePurchaseButton,
  PurchaseDialog,
} from "@/components/admin-panel/purchase-forms";
import {
  DeleteUserDialog,
  EditUserForm,
  RevokeSessionsButton,
} from "@/components/admin-panel/user-forms";
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
import { getUserDetail, itemOptions } from "@/lib/admin/data";
import { formatDate, formatDateTime, formatMoney } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/session";

// One user and everything stored about them: profile (editable), access,
// purchases (add, edit, delete), sessions (sign out), linked accounts and
// pending sign-in links, and deleting it all.
const AdminUserPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  await requireAdminPage();
  const { id } = await params;
  const detail = await getUserDetail(id);
  if (!detail) {
    notFound();
  }
  const { access, accounts, purchases, sessions, user, verificationCount } =
    detail;
  const items = itemOptions();

  const facts = [
    { label: "User ID", value: user.id },
    { label: "Joined", value: formatDateTime(user.createdAt) },
    { label: "Updated", value: formatDateTime(user.updatedAt) },
    { label: "Pending sign-in links", value: String(verificationCount) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link
          href={`${ROUTES.ADMIN_PANEL}/users`}
          className="text-muted-foreground text-sm underline-offset-4 hover:underline"
        >
          ← Users
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {user.email}
          </h1>
          <AccessBadges access={access} />
        </div>
        {access.itemIds.length > 0 && (
          <p className="text-muted-foreground text-sm">
            Items owned: {access.itemIds.join(", ")}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
            <CardDescription>
              Changing the email moves their purchases to the new address, so
              they keep their access. They sign in with the new one next time.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EditUserForm user={user} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 text-sm">
              {facts.map((fact) => (
                <div key={fact.label} className="grid gap-0.5">
                  <dt className="text-muted-foreground">{fact.label}</dt>
                  <dd className="font-mono text-xs break-all">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Purchases</h2>
          <PurchaseDialog items={items} defaultEmail={user.email} />
        </div>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Kind</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Ends</TableHead>
                <TableHead>Bought</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchases.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-muted-foreground text-center"
                  >
                    No purchases.
                  </TableCell>
                </TableRow>
              )}
              {purchases.map((purchase) => (
                <TableRow key={purchase._id}>
                  <TableCell className="font-mono text-xs">
                    {purchase._id}
                    <div className="text-muted-foreground">
                      {purchase.provider}
                    </div>
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
                  <TableCell className="text-muted-foreground">
                    {formatDate(purchase.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
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
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Sessions</h2>
          {sessions.length > 0 && (
            <RevokeSessionsButton
              label="Sign out everywhere"
              userId={user.id}
            />
          )}
        </div>
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Token</TableHead>
                <TableHead>Browser</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Signed in</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-muted-foreground text-center"
                  >
                    Not signed in anywhere.
                  </TableCell>
                </TableRow>
              )}
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-mono text-xs">
                    {session.tokenPreview}
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate text-xs"
                    title={session.userAgent ?? ""}
                  >
                    {session.userAgent ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {session.ipAddress ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(session.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {session.expiresAt < new Date()
                      ? "Expired"
                      : formatDateTime(session.expiresAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <RevokeSessionsButton
                      label="Sign out"
                      sessionId={session.id}
                      userId={user.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
        <p className="text-muted-foreground text-xs">
          Linked accounts:{" "}
          {accounts.length === 0
            ? "none (magic link only)"
            : accounts.map((account) => account.providerId).join(", ")}
        </p>
      </section>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Remove this user and every record about them from the database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeleteUserDialog user={user} />
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminUserPage;
