import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { formatDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/session";
import { getSavedEmail } from "@/lib/emails/store";
import { EMAIL_TEMPLATES } from "@/lib/emails/templates";

// Every email the site sends on its own, with the subject it goes out with
// and whether it uses its default words or edited ones. Open one to edit it
// (emails/[id]).
const AdminEmailsPage = async () => {
  await requireAdminPage();
  const rows = await Promise.all(
    EMAIL_TEMPLATES.map(async (template) => ({
      saved: await getSavedEmail(template.id),
      template,
    }))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
        <p className="text-muted-foreground text-sm">
          The emails the site sends on its own. Edits go live with the next
          email sent, no deploy needed.
        </p>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Sent when</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Words</TableHead>
              <TableHead>Last edited</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ saved, template }) => (
              <TableRow key={template.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`${ROUTES.ADMIN_PANEL}/emails/${template.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {template.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {template.sentWhen}
                </TableCell>
                <TableCell>
                  {(saved?.content ?? template.defaults).subject}
                </TableCell>
                <TableCell>
                  {saved ? (
                    <Badge>Edited</Badge>
                  ) : (
                    <Badge variant="secondary">Default</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {saved
                    ? `${formatDateTime(saved.updatedAt)} · ${saved.updatedBy}`
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link
                      href={`${ROUTES.ADMIN_PANEL}/emails/${template.id}`}
                      aria-label={`Edit ${template.name.toLowerCase()}`}
                    >
                      Edit
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminEmailsPage;
