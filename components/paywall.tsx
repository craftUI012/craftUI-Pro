import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";

export const Paywall = ({
  title = "Payment required",
  description = "This content needs an active plan. Get lifetime or yearly all-access, or buy just the template you want.",
}: {
  title?: string;
  description?: string;
}) => (
  <Card className="w-full">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </CardHeader>
    <CardContent>
      <Button asChild>
        <Link href={ROUTES.PRICING}>View pricing</Link>
      </Button>
    </CardContent>
  </Card>
);
