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

const CheckoutSuccessPage = () => (
  <div className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-16">
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Payment received</CardTitle>
        <CardDescription>
          One last step: sign in with the same email you paid with. We&apos;ll
          send you a magic link and unlock your access right away.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex gap-3">
        <Button asChild>
          <Link href={ROUTES.LOGIN}>Sign in to unlock</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={ROUTES.PRICING}>Back to pricing</Link>
        </Button>
      </CardContent>
    </Card>
  </div>
);

export default CheckoutSuccessPage;
