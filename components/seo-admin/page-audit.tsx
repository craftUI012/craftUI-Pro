import Link from "next/link";

import { SeoEditor } from "@/components/seo-admin/seo-editor";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SITE } from "@/constants/site";
import { TYPE } from "@/constants/typography";
import { LIMITS, auditPage, mapLimit } from "@/lib/seo-audit";
import { readEditableSeo } from "@/lib/seo-edit";
import { cn } from "@/lib/utils";

// A character count, red when over the limit search results show.
const Count = ({ max, value }: { max: number; value?: string }) =>
  value ? (
    <span
      className={cn(
        "font-mono tabular-nums",
        value.length > max ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {value.length}/{max}
    </span>
  ) : null;

// Every page, fetched live from this dev server and checked (lib/seo-audit.ts).
// Rendered under Suspense: the rest of /seo-admin shows while it runs.
export const PageAudit = async ({
  origin,
  pages,
  siteUrl,
}: {
  origin: string;
  pages: { inSitemap: boolean; path: string }[];
  siteUrl: string;
}) => {
  const audits = await mapLimit(pages, 4, (page) =>
    auditPage({ ...page, origin, siteUrl })
  );
  // Docs pages can be edited here: their text, read from the files.
  const editable = await readEditableSeo();
  const rows = audits.map((audit) => ({
    audit,
    edit: editable.get(audit.path),
  }));
  const failing = audits.filter((audit) => audit.issues.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <p className={cn(TYPE.cardLabel)}>
        {audits.length} pages checked ·{" "}
        <span className={failing > 0 ? "text-destructive" : "text-emerald-600"}>
          {failing === 0 ? "no issues" : `${failing} with issues`}
        </span>
      </p>
      <div className="overflow-hidden rounded-lg border">
        <Table className={TYPE.cardCaption}>
          <TableHeader>
            <TableRow>
              <TableHead>Page</TableHead>
              <TableHead>Title · description</TableHead>
              <TableHead>Indexing</TableHead>
              <TableHead>Social card</TableHead>
              <TableHead>Structured data</TableHead>
              <TableHead>Issues</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ audit, edit }) => (
              <TableRow key={audit.path} className="align-top">
                <TableCell className="font-mono">
                  <Link
                    href={audit.path}
                    className="underline-offset-4 hover:underline"
                  >
                    {audit.path}
                  </Link>
                  <div className="text-muted-foreground mt-1">
                    HTTP {audit.status} · {audit.h1Count} h1
                  </div>
                </TableCell>
                <TableCell className="max-w-md whitespace-normal">
                  <div className="font-medium">
                    {audit.title ?? "—"}{" "}
                    <Count max={LIMITS.titleMax} value={audit.title} />
                  </div>
                  <div className="text-muted-foreground mt-1 text-pretty">
                    {audit.description ?? "—"}{" "}
                    <Count
                      max={LIMITS.descriptionMax}
                      value={audit.description}
                    />
                  </div>
                  {edit ? (
                    <SeoEditor
                      limits={{
                        description: LIMITS.descriptionMax,
                        title: LIMITS.titleMax,
                      }}
                      siteName={SITE.NAME}
                      values={edit}
                    />
                  ) : null}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-1">
                    <Badge variant={audit.indexable ? "secondary" : "outline"}>
                      {audit.indexable ? "index" : "noindex"}
                    </Badge>
                    {audit.inSitemap && (
                      <span className="text-muted-foreground">in sitemap</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {audit.ogImage ? (
                    <a
                      href={audit.ogImage.replace(siteUrl, origin)}
                      target="_blank"
                      rel="noreferrer"
                      className="block w-32"
                    >
                      {/* oxlint-disable-next-line nextjs/no-img-element -- Dev-only preview of a generated image. */}
                      <img
                        src={audit.ogImage.replace(siteUrl, origin)}
                        alt={`Social card for ${audit.path}`}
                        width={1200}
                        height={630}
                        loading="lazy"
                        className="h-auto w-full rounded border"
                      />
                    </a>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {audit.jsonLdTypes.join(", ") || "—"}
                </TableCell>
                <TableCell className="whitespace-normal">
                  {audit.issues.length === 0 ? (
                    <span className="text-emerald-600">OK</span>
                  ) : (
                    <ul className="text-destructive flex flex-col gap-1">
                      {audit.issues.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
