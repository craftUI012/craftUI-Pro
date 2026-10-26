import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { isAdminEmail } from "@/lib/admin/emails";
import { auth } from "@/lib/auth";

// The signed-in admin, or null for anyone else (signed out, or signed in
// without an ADMIN_EMAILS address).
export const getAdminSession = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session && isAdminEmail(session.user.email) ? session : null;
};

// For server actions: every write checks again on the server, since an
// action can be called directly, not only from the panel's pages.
export const requireAdmin = async () => {
  const session = await getAdminSession();
  if (!session) {
    throw new Error("Not allowed.");
  }
  return session;
};

// For the panel's layout and pages: signed out goes to sign-in (and back
// here after the link), signed in as anyone else gets a 404, so the panel
// doesn't reveal it exists. Pages check too, not only the layout: a layout
// doesn't re-run on navigation between its pages.
export const requireAdminPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    redirect(`${ROUTES.LOGIN}?next=${encodeURIComponent(ROUTES.ADMIN_PANEL)}`);
  }
  if (!isAdminEmail(session.user.email)) {
    notFound();
  }
  return session;
};
