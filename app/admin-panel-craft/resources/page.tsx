import Link from "next/link";

import {
  DeleteResourceButton,
  ResourceDialog,
} from "@/components/admin-panel/resource-forms";
import { Badge } from "@/components/ui/badge";
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
import {
  RESOURCE_CATEGORIES,
  isResourceCategory,
  normalizeTags,
} from "@/lib/admin/constants";
import type { ResourceCategory } from "@/lib/admin/constants";
import { listResources } from "@/lib/admin/data";
import { formatDate } from "@/lib/admin/format";
import { requireAdminPage } from "@/lib/admin/session";
import { cn } from "@/lib/utils";

const BASE = `${ROUTES.ADMIN_PANEL}/resources`;

const labelOf = (category: ResourceCategory) =>
  RESOURCE_CATEGORIES.find((option) => option.id === category)?.one ?? category;

// The page's state is its URL (?category=people&tags=design,motion&q=…), so
// a filtered view can be bookmarked. Switching category clears the tags,
// since each category has its own.
const hrefFor = ({
  category,
  q,
  tags = [],
}: {
  category?: ResourceCategory;
  q?: string;
  tags?: string[];
}) => {
  const params = new URLSearchParams();
  if (category) {
    params.set("category", category);
  }
  if (tags.length > 0) {
    params.set("tags", tags.join(","));
  }
  if (q) {
    params.set("q", q);
  }
  const search = params.toString();
  return search ? `${BASE}?${search}` : BASE;
};

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Saved websites, people and X posts, each with a name, a link and tags.
// Filter by category (tabs), by tags (chips: a resource must have every
// chosen tag), and by name or link (search).
const AdminResourcesPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; tags?: string }>;
}) => {
  await requireAdminPage();
  const params = await searchParams;
  const category = isResourceCategory(params.category)
    ? params.category
    : undefined;
  const tags = normalizeTags(params.tags ?? "");
  const q = params.q?.trim() ?? "";
  const { categoryCounts, rows, tagCounts } = await listResources({
    category,
    query: q,
    tags,
  });
  const total = Object.values(categoryCounts).reduce(
    (sum, count) => sum + (count ?? 0),
    0
  );
  const filtered = tags.length > 0 || q !== "";

  const tabs = [
    { count: total, href: hrefFor({ q }), id: undefined, label: "All" },
    ...RESOURCE_CATEGORIES.map((option) => ({
      count: categoryCounts[option.id] ?? 0,
      href: hrefFor({ category: option.id, q }),
      id: option.id,
      label: option.label,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">
          Resources{" "}
          <span className="text-muted-foreground font-normal">{total}</span>
        </h1>
        <ResourceDialog
          defaultCategory={category}
          knownTags={tagCounts.map((entry) => entry.tag)}
        />
      </div>

      <nav aria-label="Category" className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = tab.id === category;
          return (
            <Button
              key={tab.label}
              asChild
              size="sm"
              variant="outline"
              className={cn(active && "bg-accent text-accent-foreground")}
            >
              <Link href={tab.href} aria-current={active ? "page" : undefined}>
                {tab.label}
                <span className="text-muted-foreground tabular-nums">
                  {tab.count}
                </span>
              </Link>
            </Button>
          );
        })}
      </nav>

      <form className="flex flex-wrap items-center gap-2">
        {category && <input type="hidden" name="category" value={category} />}
        {tags.length > 0 && (
          <input type="hidden" name="tags" value={tags.join(",")} />
        )}
        <Input
          name="q"
          defaultValue={q}
          placeholder="Search name or link"
          className="w-64"
        />
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {filtered && (
          <Button asChild variant="ghost" size="sm">
            <Link href={hrefFor({ category })}>Clear filters</Link>
          </Button>
        )}
      </form>

      {tagCounts.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-xs">
            Tags{category ? ` in ${labelOf(category)}` : ""}: pick one or more
            (a resource must have all of them).
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tagCounts.map(({ count, tag }) => {
              const selected = tags.includes(tag);
              const next = selected
                ? tags.filter((value) => value !== tag)
                : [...tags, tag];
              return (
                <Link
                  key={tag}
                  href={hrefFor({ category, q, tags: next })}
                  aria-pressed={selected}
                >
                  <Badge variant={selected ? "default" : "outline"}>
                    {tag}
                    <span className="opacity-60 tabular-nums">{count}</span>
                  </Badge>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Added</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-muted-foreground text-center"
                >
                  {filtered || category
                    ? "Nothing matches these filters."
                    : "No resources yet. Add the first one."}
                </TableCell>
              </TableRow>
            )}
            {rows.map((resource) => (
              <TableRow key={resource._id}>
                <TableCell className="max-w-80">
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {resource.name}
                  </a>
                  <div className="text-muted-foreground truncate text-xs">
                    {hostOf(resource.url)}
                  </div>
                </TableCell>
                <TableCell>{labelOf(resource.category)}</TableCell>
                <TableCell>
                  <div className="flex max-w-80 flex-wrap gap-1">
                    {resource.tags.map((tag) => (
                      <Link
                        key={tag}
                        href={hrefFor({
                          category,
                          q,
                          tags: tags.includes(tag) ? tags : [...tags, tag],
                        })}
                      >
                        <Badge variant="secondary">{tag}</Badge>
                      </Link>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(resource.createdAt)}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <ResourceDialog
                    resource={resource}
                    knownTags={tagCounts.map((entry) => entry.tag)}
                    trigger="edit"
                  />
                  <DeleteResourceButton resource={resource} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminResourcesPage;
