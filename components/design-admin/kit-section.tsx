"use client";

import { APP_CARDS } from "@/components/design-admin/app-cards";
import { FINANCE_CARDS } from "@/components/design-admin/finance-cards";
import { Badge } from "@/components/ui/badge";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

const KITS = {
  app: {
    cards: APP_CARDS,
    description: "Developer tools, forms, analytics and empty states.",
    index: "Frame 02",
    title: "App kit",
  },
  finance: {
    cards: FINANCE_CARDS,
    description: "Payouts, investing, budgeting and smart-home controls.",
    index: "Frame 01",
    title: "Finance kit",
  },
};

export const KitSection = ({ kit }: { kit: keyof typeof KITS }) => {
  const { cards, description, index, title } = KITS[kit];

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span
            className={cn(
              TYPE.cardCaption,
              "text-muted-foreground font-mono tabular-nums"
            )}
          >
            {index}
          </span>
          <h2 className={cn(TYPE.headingSection, "text-balance")}>{title}</h2>
          <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
            {description}
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums">
          {cards.length} components
        </Badge>
      </div>
      {/* Masonry via CSS columns — cards keep their natural height like the Paper frames. */}
      <div className="columns-1 gap-4 md:columns-2 xl:columns-3 2xl:columns-4 [&>*]:mb-4 [&>*]:break-inside-avoid">
        {cards.map(({ Component, id }) => (
          <div key={id} id={id}>
            <Component />
          </div>
        ))}
      </div>
    </section>
  );
};
