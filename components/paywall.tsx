import { ArrowRight, Lock } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

export const Paywall = ({
  className,
  title = "Payment required",
  description = "This content needs an active plan. Get lifetime or yearly all-access, or buy just the template you want.",
}: {
  className?: string;
  title?: string;
  description?: string;
}) => (
  <Card className={cn("shadow-elevated gap-5 border-0 py-6", className)}>
    <CardHeader className="items-start gap-3">
      <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-lg">
        <Lock className="size-5" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className={cn(TYPE.headingPanel, "text-foreground")}>{title}</p>
        <p
          className={cn(
            TYPE.cardDescription,
            "text-muted-foreground text-pretty"
          )}
        >
          {description}
        </p>
      </div>
    </CardHeader>
    <CardContent className="flex flex-col items-center gap-3">
      <Button asChild className="w-full">
        <Link href={ROUTES.PRICING}>
          View pricing
          <ArrowRight data-icon="inline-end" />
        </Link>
      </Button>
      <Link
        className={cn(
          TYPE.cardCaption,
          "text-muted-foreground hover:text-foreground underline underline-offset-4"
        )}
        href={ROUTES.LOGIN}
      >
        Already have craftUI Pro? Sign in
      </Link>
    </CardContent>
  </Card>
);
