import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KitSection } from "@/components/design-admin/kit-section";
import { TokenPanel } from "@/components/design-admin/token-panel";
import { PageTransition } from "@/components/page-transition";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { showDesignAdmin } from "@/lib/flags";
import { cn } from "@/lib/utils";
import { createPageMetadata } from "@/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  description:
    "Internal showcase of craftUI Pro design tokens and the component kit.",
  noIndex: true,
  path: ROUTES.DESIGN_ADMIN,
  title: "Design Admin",
});

const DesignAdminPage = () => {
  if (!showDesignAdmin) {
    notFound();
  }

  return (
    <PageTransition>
      <div className="container-wrapper px-4 lg:px-6">
        <div className="3xl:fixed:container flex flex-col gap-12 py-8 lg:py-12">
          <header className="flex flex-col gap-2">
            <Badge variant="secondary" className="w-fit">
              Development only
            </Badge>
            <h1 className={cn(TYPE.headingDisplay, "text-balance")}>
              Design Admin
            </h1>
            <p
              className={cn(
                TYPE.pageLead,
                "text-muted-foreground max-w-2xl text-pretty"
              )}
            >
              Every token and component from the Paper frames, rebuilt on shadcn
              and wired to styles/globals.css. Toggle light and dark from the
              header to check both themes.
            </p>
          </header>
          <TokenPanel />
          <KitSection kit="finance" />
          <KitSection kit="app" />
        </div>
      </div>
    </PageTransition>
  );
};

export default DesignAdminPage;
