"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

// Client island, like the other section CTAs: a `Link` with `transitionTypes`
// rendered from a server component hydrates with a mismatch.
export const TemplatesCta = ({ className }: { className?: string }) => (
  <Button asChild className={className}>
    <Link href={ROUTES.PRICING} transitionTypes={["nav-forward"]}>
      Get craftUI Pro
      <ArrowRight data-icon="inline-end" />
    </Link>
  </Button>
);
