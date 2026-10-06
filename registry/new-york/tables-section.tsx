import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Default tables section (v1). Intentionally plain shadcn Table in a
// section shell — eyebrow, heading, description, then the table card.
// We will improve the UI as we go (sorting, selection, pagination).
// Colours are host theme tokens only, so it follows light/dark.

export interface TablesRow {
  id: string;
  customer: string;
  email: string;
  plan: string;
  status: "active" | "trial" | "past-due" | "cancelled";
  amount: string;
}

export interface TablesSectionProps {
  eyebrow?: string;
  heading?: ReactNode;
  description?: ReactNode;
  caption?: string;
  rows?: TablesRow[];
  className?: string;
}

const DEFAULT_ROWS: TablesRow[] = [
  {
    amount: "$48.00",
    customer: "Maya Ellis",
    email: "maya@studio.co",
    id: "row-maya",
    plan: "Pro",
    status: "active",
  },
  {
    amount: "$19.00",
    customer: "Noor Haddad",
    email: "noor@studio.co",
    id: "row-noor",
    plan: "Starter",
    status: "trial",
  },
  {
    amount: "$96.00",
    customer: "Tom Brandt",
    email: "tom@studio.co",
    id: "row-tom",
    plan: "Team",
    status: "past-due",
  },
  {
    amount: "$19.00",
    customer: "Dev Sharma",
    email: "dev@studio.co",
    id: "row-dev",
    plan: "Starter",
    status: "cancelled",
  },
];

const STATUS_LABEL: Record<TablesRow["status"], string> = {
  active: "Active",
  cancelled: "Cancelled",
  "past-due": "Past due",
  trial: "Trial",
};

export default function TablesSection({
  eyebrow = "Tables",
  heading = "A default table to build on",
  description = "Customers, plans and statuses in a plain table. Swap the rows via props — richer UI lands in later iterations.",
  caption = "A list of your recent customers.",
  rows = DEFAULT_ROWS,
  className,
}: TablesSectionProps = {}) {
  return (
    <section
      data-slot="tables-section"
      className={cn("bg-background text-foreground w-full", className)}
    >
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-20 xl:py-24">
        <div className="max-w-xl">
          <p className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
            {eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-medium tracking-tight text-balance sm:text-4xl">
            {heading}
          </h2>
          <p className="text-muted-foreground mt-4 text-base leading-relaxed text-pretty">
            {description}
          </p>
        </div>

        <div className="border-border bg-card mt-10 overflow-hidden rounded-xl border shadow-sm">
          <Table>
            <TableCaption className="px-4">{caption}</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-4 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="pl-4">
                    <span className="block font-medium">{row.customer}</span>
                    <span className="text-muted-foreground block text-xs">
                      {row.email}
                    </span>
                  </TableCell>
                  <TableCell>{row.plan}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4 text-right tabular-nums">
                    {row.amount}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4" colSpan={3}>
                  Total
                </TableCell>
                <TableCell className="pr-4 text-right tabular-nums">
                  {rows.length} customers
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </div>
    </section>
  );
}
