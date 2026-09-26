"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { authClient } from "@/lib/auth-client";

export const SignOutButton = () => {
  const router = useRouter();

  return (
    <Button
      onClick={async () => {
        await authClient.signOut();
        router.push(ROUTES.LOGIN);
        router.refresh();
      }}
      variant="outline"
    >
      Sign out
    </Button>
  );
};
