import type { Metadata } from "next";
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
import { createPageMetadata } from "@/seo/metadata";

// Reached only after paying, so never in search results.
export const metadata: Metadata = createPageMetadata({
  noIndex: true,
  path: ROUTES.CHECKOUT_SUCCESS,
  title: "Payment received",
});

// Dodo redirects here with ?status=…&email=… (plus payment_id or
// subscription_id). The page only tells the buyer what's next: the purchase
// itself is recorded by the webhook (app/api/webhooks/dodo), not here.
const NOT_PAID = new Set(["cancelled", "failed"]);

const CheckoutSuccessPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; status?: string }>;
}) => {
  const { email, status } = await searchParams;

  if (status && NOT_PAID.has(status)) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-16">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Payment didn&apos;t go through</CardTitle>
            <CardDescription>
              You haven&apos;t been charged. Pick a plan to try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={ROUTES.PRICING}>Back to pricing</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // The magic link must go to the email the purchase is stored under.
  const loginHref = email
    ? `${ROUTES.LOGIN}?email=${encodeURIComponent(email)}`
    : ROUTES.LOGIN;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Payment received</CardTitle>
          <CardDescription>
            One last step: sign in with the same email you paid with
            {email ? (
              <>
                {" "}
                (<span className="text-foreground font-medium">{email}</span>)
              </>
            ) : null}
            . We&apos;ll send you a magic link and unlock your access right
            away.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3">
          <Button asChild>
            <Link href={loginHref}>Sign in to unlock</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={ROUTES.PRICING}>Back to pricing</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutSuccessPage;
