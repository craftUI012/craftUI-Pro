"use client";

import { posthog } from "posthog-js";
import { useEffect, useRef } from "react";

import { useSession } from "@/lib/auth-client";

// Ties PostHog's anonymous visitor to the signed-in user, so a purchase and
// the browsing that led to it land on one person. The session comes from
// the same useSession the navbar reads, so it adds no request on browse
// pages. Signing out (here, or in another tab) resets PostHog, so the next
// person on this device starts as a new anonymous visitor.
export const PostHogIdentify = () => {
  const { data } = useSession();
  const user = data?.user;
  const identified = useRef<string | null>(null);

  useEffect(() => {
    if (user && identified.current !== user.id) {
      posthog.identify(user.id, { email: user.email, name: user.name });
      identified.current = user.id;
    } else if (!user && identified.current) {
      posthog.reset();
      identified.current = null;
    }
  }, [user]);

  return null;
};
