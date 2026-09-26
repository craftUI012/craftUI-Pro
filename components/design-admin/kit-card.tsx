import type * as React from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Compact card shell matching the Paper kit: 1rem insets instead of the
// default 1.5rem, everything else straight from the shadcn Card tokens.
export const KitCard = ({
  action,
  children,
  className,
  contentClassName,
  description,
  footer,
  title,
}: {
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  title?: React.ReactNode;
}) => (
  <Card className={cn("gap-4 py-4", className)}>
    {(title || description || action) && (
      <CardHeader className="px-4">
        {title && (
          // Plain heading instead of CardTitle: its built-in `font-semibold`
          // would override the weight the card-header token defines.
          <h3
            data-slot="card-title"
            className={cn(TYPE.cardHeader, "text-balance")}
          >
            {title}
          </h3>
        )}
        {description && (
          <CardDescription className={cn(TYPE.cardDescription, "text-pretty")}>
            {description}
          </CardDescription>
        )}
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
    )}
    {children && (
      <CardContent className={cn("px-4", contentClassName)}>
        {children}
      </CardContent>
    )}
    {footer && <CardFooter className="gap-2 px-4">{footer}</CardFooter>}
  </Card>
);

// Centred empty-state layout used by several kit cards.
export const EmptyState = ({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="flex flex-col items-center gap-3 py-4 text-center">
    <div className="bg-muted text-muted-foreground flex size-8 items-center justify-center rounded-md shadow-border [&_svg]:size-4">
      {icon}
    </div>
    <div className="flex flex-col gap-1">
      <p className={TYPE.cardLabel}>{title}</p>
      <p
        className={cn(
          TYPE.cardBody,
          "text-muted-foreground max-w-64 text-pretty"
        )}
      >
        {description}
      </p>
    </div>
    {action}
  </div>
);

// Label/value row used in summaries and breakdowns.
export const StatRow = ({
  className,
  label,
  value,
}: {
  className?: string;
  label: React.ReactNode;
  value: React.ReactNode;
}) => (
  <div
    className={cn(
      TYPE.cardBody,
      "flex items-center justify-between gap-4",
      className
    )}
  >
    <span className="text-muted-foreground">{label}</span>
    <span className="font-medium tabular-nums">{value}</span>
  </div>
);
