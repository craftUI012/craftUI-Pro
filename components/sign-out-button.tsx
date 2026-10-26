"use client";

import { useRouter } from "next/navigation";
import { posthog } from "posthog-js";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { authClient } from "@/lib/auth-client";

export const SignOutButton = () => {
  const router = useRouter();

  return (
    <Button
      onClick={async () => {
        await authClient.signOut();
        // The next visitor on this device starts anonymous.
        posthog.reset();
        router.push(ROUTES.LOGIN);
        router.refresh();
      }}
      variant="outline"
    >
      Sign out
    </Button>
  );
};
