import type { Metadata } from "next";
import Link from "next/link";

import { AdminNav } from "@/components/admin-panel/admin-nav";
import { LogoMark } from "@/components/logo";
import { SignOutButton } from "@/components/sign-out-button";
import { ROUTES } from "@/constants/routes";
import { requireAdminPage } from "@/lib/admin/session";
import { createPageMetadata } from "@/seo/metadata";

// The admin panel: users, purchases and the raw MongoDB collections. Only
// for the emails in ADMIN_EMAILS (lib/admin/emails.ts): signed out goes to
// sign-in, anyone else gets a 404. Never indexed, and disallowed in
// robots.txt. Outside the site's route groups, so it has its own bar
// instead of the site navbar.
export const metadata: Metadata = createPageMetadata({
  noIndex: true,
  path: ROUTES.ADMIN_PANEL,
  title: "Admin",
});

export default async function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminPage();

  return (
    <div className="bg-background min-h-svh">
      <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
        <div className="container flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <Link
            href={ROUTES.ADMIN_PANEL}
            className="flex items-center gap-2 text-sm font-medium"
          >
            <LogoMark className="size-5" />
            craftUI admin
          </Link>
          <AdminNav />
          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground hidden text-sm sm:inline">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}
