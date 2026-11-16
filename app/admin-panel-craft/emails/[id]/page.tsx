import Link from "next/link";
import { notFound } from "next/navigation";

import { EmailEditor } from "@/components/admin-panel/email-editor";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { formatDateTime } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/session";
import { isEmailId } from "@/lib/emails/compose";
import { getSavedEmail } from "@/lib/emails/store";
import { getEmailTemplate } from "@/lib/emails/templates";

// One email's editor: its words on the left, the email as it'll arrive on
// the right (components/admin-panel/email-editor.tsx).
const AdminEmailPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const session = await requireAdminPage();
  const { id } = await params;
  if (!isEmailId(id)) {
    notFound();
  }
  const template = getEmailTemplate(id);
  const saved = await getSavedEmail(id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`${ROUTES.ADMIN_PANEL}/emails`}
          className="text-muted-foreground w-fit text-sm underline-offset-4 hover:underline"
        >
          ← Emails
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {template.name}
          </h1>
          {saved ? (
            <Badge>Edited</Badge>
          ) : (
            <Badge variant="secondary">Default</Badge>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          Sent when: {template.sentWhen}.
          {saved &&
            ` Last edited ${formatDateTime(saved.updatedAt)} by ${saved.updatedBy}.`}
        </p>
      </div>

      <EmailEditor
        // A fresh editor after a save or reset, holding the new words.
        key={saved?.updatedAt.toISOString() ?? "default"}
        adminEmail={session.user.email}
        id={id}
        saved={saved ? { ...template.defaults, ...saved.content } : null}
      />
    </div>
  );
};

export default AdminEmailPage;
