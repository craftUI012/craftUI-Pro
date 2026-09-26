import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { canAccessTemplate } from "@/lib/billing/entitlements";
import { templateBySlug } from "@/lib/billing/plans";

export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) => {
  const { slug } = await params;
  const template = templateBySlug(slug);
  if (!template) {
    return Response.json({ error: "Unknown template." }, { status: 404 });
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const allowed = await canAccessTemplate(session.user.id, slug);
  if (!allowed) {
    return Response.json({ error: "Payment required." }, { status: 402 });
  }

  return Response.json({
    downloadUrl: null,
    message: `Template "${template.name}" download goes here.`,
    slug,
  });
};
