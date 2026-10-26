import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { canAccessItem } from "@/lib/billing/entitlements";
import { formatCode } from "@/lib/format-code";
import { highlightCode } from "@/lib/highlight-code";
import {
  getDemoSource,
  getRegistryItemMeta,
  getRegistrySource,
  isPaidItem,
} from "@/lib/registry";

// A paid item's source, for its owner only: docs pages never render paid
// source into their HTML. The Code view (components/paid-source.tsx) shows
// `html`; Copy for AI copies `code`.
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) => {
  const { name } = await params;
  const noStore = { "Cache-Control": "private, no-store" };

  if (isPaidItem(name)) {
    const session = await auth.api.getSession({ headers: await headers() });
    const itemId = getRegistryItemMeta(name)?.id;
    if (
      !session ||
      !itemId ||
      !(await canAccessItem(session.user.id, itemId))
    ) {
      return Response.json(
        { error: "This item needs a plan." },
        { headers: noStore, status: 403 }
      );
    }
  }

  const source = (await getDemoSource(name)) ?? (await getRegistrySource(name));
  if (!source) {
    return Response.json(
      { error: "No source for this item." },
      { headers: noStore, status: 404 }
    );
  }

  const code = await formatCode(source);
  const html = await highlightCode(code, "tsx");
  return Response.json({ code, html }, { headers: noStore });
};
