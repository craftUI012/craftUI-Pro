import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { auth } from "@/lib/auth";
import {
  backfillPurchasesToUser,
  getEntitlements,
} from "@/lib/billing/entitlements";
import { TEMPLATES } from "@/lib/billing/plans";

const DashboardPage = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect(ROUTES.LOGIN);
  }

  // Link any guest-checkout purchases (paid before sign-in) to this user.
  await backfillPurchasesToUser(session.user.id);
  const entitlements = await getEntitlements(session.user.id);
  const ownedTemplates = TEMPLATES.filter((template) =>
    entitlements.templates.includes(template.slug)
  );

  let accessMessage: string;
  if (entitlements.hasAllAccess) {
    accessMessage = entitlements.hasLifetime
      ? "Lifetime all-access is active. Every component and template is unlocked."
      : "Yearly all-access is active. Every component and template is unlocked.";
  } else if (ownedTemplates.length > 0) {
    accessMessage = `You own ${ownedTemplates.map((t) => t.name).join(", ")}. Upgrade for everything.`;
  } else {
    accessMessage =
      "No plan yet. Get lifetime or yearly all-access, or buy a single template.";
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>You&apos;re signed in</CardTitle>
          <CardDescription>{session.user.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">{accessMessage}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href={ROUTES.PRICING}>View pricing</Link>
            </Button>
            <SignOutButton />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;
