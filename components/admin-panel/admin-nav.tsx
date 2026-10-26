"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: ROUTES.ADMIN_PANEL, label: "Overview" },
  { href: `${ROUTES.ADMIN_PANEL}/users`, label: "Users" },
  { href: `${ROUTES.ADMIN_PANEL}/purchases`, label: "Purchases" },
  { href: `${ROUTES.ADMIN_PANEL}/collections`, label: "Collections" },
];

// The panel's sections. A section stays active on its sub-pages (a user's
// page keeps "Users" active).
export const AdminNav = () => {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin" className="flex flex-wrap items-center gap-1">
      {LINKS.map((link) => {
        const active =
          link.href === ROUTES.ADMIN_PANEL
            ? pathname === link.href
            : pathname.startsWith(link.href);
        return (
          <Button
            key={link.href}
            asChild
            size="sm"
            variant="ghost"
            className={cn(
              "text-muted-foreground",
              active && "bg-accent text-accent-foreground"
            )}
          >
            <Link href={link.href} aria-current={active ? "page" : undefined}>
              {link.label}
            </Link>
          </Button>
        );
      })}
    </nav>
  );
};
