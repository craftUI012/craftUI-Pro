import Link from "next/link";

import { AccessBadges } from "@/components/admin-panel/access-badges";
import { AddUserDialog } from "@/components/admin-panel/user-forms";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { itemOptions, listUsers } from "@/lib/admin/data";
import { formatDate, formatDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/session";

// Every user (newest first), searchable by email or name (?q=), with what
// they can use now. A row opens the user's page.
const AdminUsersPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) => {
  await requireAdminPage();
  const { q = "" } = await searchParams;
  const rows = await listUsers(q);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Users{" "}
          <span className="text-muted-foreground font-normal">
            {rows.length}
          </span>
        </h1>
        <div className="flex items-center gap-2">
          <form className="flex gap-2">
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search email or name"
              className="w-56"
            />
            <Button type="submit" variant="outline" size="sm">
              Search
            </Button>
          </form>
          <AddUserDialog items={itemOptions()} />
        </div>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Purchases</TableHead>
              <TableHead>Sessions</TableHead>
              <TableHead>Last active</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground text-center"
                >
                  {q ? `No users match "${q}".` : "No users yet."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.user.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`${ROUTES.ADMIN_PANEL}/users/${row.user.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {row.user.email}
                  </Link>
                </TableCell>
                <TableCell>{row.user.name || "—"}</TableCell>
                <TableCell>
                  <AccessBadges access={row.access} />
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.purchaseCount}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.sessionCount}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDateTime(row.lastSessionAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(row.user.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <p className="text-muted-foreground text-xs">
        Buyers who paid but never signed in have no user yet: they&apos;re on
        the Purchases page.
      </p>
    </div>
  );
};

export default AdminUsersPage;
