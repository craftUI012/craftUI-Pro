import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { COLLECTIONS, listCollection } from "@/lib/admin/data";
import type { CollectionName } from "@/lib/admin/data";
import { requireAdminPage } from "@/lib/admin/session";
import { cn } from "@/lib/utils";

const BASE = `${ROUTES.ADMIN_PANEL}/collections`;

// What each collection holds, shown above its documents.
const ABOUT: Record<CollectionName, string> = {
  account:
    "Sign-in methods linked to a user (better-auth). Empty while sign-in is magic link only.",
  purchase:
    'One document per order or subscription (ours). Only status "active" grants access.',
  resource:
    "Saved links from the Resources page (ours): websites, designers on X, X posts and tools, with tags.",
  session:
    "One per signed-in browser (better-auth). Tokens are shortened here.",
  user: "One per person who signed in, or was added here (better-auth).",
  verification:
    "Pending magic links (better-auth), removed when used or expired. Tokens are shortened here.",
};

// The raw MongoDB documents, read-only, 20 per page, newest first: to check
// exactly what's stored. Edit through the Users, Purchases and Resources
// pages.
const AdminCollectionsPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; page?: string }>;
}) => {
  await requireAdminPage();
  const params = await searchParams;
  const name =
    COLLECTIONS.find((collection) => collection === params.name) ?? "user";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const { docs, pageCount, total } = await listCollection(name, page);
  const pageHref = (target: number) => `${BASE}?name=${name}&page=${target}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Collections</h1>

      <nav aria-label="Collection" className="flex flex-wrap gap-1">
        {COLLECTIONS.map((collection) => (
          <Button
            key={collection}
            asChild
            size="sm"
            variant="outline"
            className={cn(
              collection === name && "bg-accent text-accent-foreground"
            )}
          >
            <Link
              href={`${BASE}?name=${collection}`}
              aria-current={collection === name ? "page" : undefined}
            >
              {collection}
            </Link>
          </Button>
        ))}
      </nav>

      <p className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium">{name}</span> · {total}{" "}
        {total === 1 ? "document" : "documents"}. {ABOUT[name]}
      </p>

      {docs.length === 0 ? (
        <p className="text-muted-foreground text-sm">Empty.</p>
      ) : (
        <div className="grid gap-3">
          {docs.map((doc) => (
            <Card key={doc.id} className="py-0">
              <CardContent className="p-0">
                <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
                  {doc.json}
                </pre>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" disabled={page <= 1}>
            <Link href={pageHref(Math.max(1, page - 1))}>Previous</Link>
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {pageCount}
          </span>
          <Button
            asChild
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
          >
            <Link href={pageHref(Math.min(pageCount, page + 1))}>Next</Link>
          </Button>
        </div>
      )}
    </div>
  );
};

export default AdminCollectionsPage;
