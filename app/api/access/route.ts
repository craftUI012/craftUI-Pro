import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";
import { signInstallToken } from "@/lib/install-token";

// What the signed-in user can use (hooks/use-access.ts reads it to unlock
// paid items' Code view, Copy for AI and install command), plus the token
// that goes in their install commands.
export const GET = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const entitlements = await getEntitlements(session.user.id);
  return Response.json(
    { ...entitlements, installToken: signInstallToken(session.user.id) },
    { headers: { "Cache-Control": "private, no-store" } }
  );
};
