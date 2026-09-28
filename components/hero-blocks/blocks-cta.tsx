"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

// Client island, like HomeCtas: a `Link` with `transitionTypes` rendered from
// a server component hydrates with a mismatch, so the CTA lives here.
export const BlocksCta = ({ className }: { className?: string }) => (
  <Button asChild variant="outline" className={className}>
    <Link href={ROUTES.DOCS_COMPONENTS} transitionTypes={["nav-forward"]}>
      Browse Components
      <ArrowRight data-icon="inline-end" />
    </Link>
  </Button>
);
