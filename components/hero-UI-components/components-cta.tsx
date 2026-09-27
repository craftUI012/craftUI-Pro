"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

// Client island: a `Link` with `transitionTypes` rendered from a server
// component hydrates with a mismatch.
export const ComponentsCta = ({ className }: { className?: string }) => (
  <Button asChild variant="outline" className={className}>
    <Link href={ROUTES.DOCS_COMPONENTS} transitionTypes={["nav-forward"]}>
      See All Components
      <ArrowRight />
    </Link>
  </Button>
);
