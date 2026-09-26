import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { getEntitlements } from "@/lib/billing/entitlements";

export const GET = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const entitlements = await getEntitlements(session.user.id);
  return Response.json(entitlements);
};
