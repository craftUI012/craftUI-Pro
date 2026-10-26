"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/app/admin-panel-craft/actions";

// Runs one of the panel's server actions: pending state while it runs, a
// toast with its answer, and onDone after a success (close a dialog,
// navigate away). The action revalidates the panel, so the page refreshes.
export const useAdminAction = () => {
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>, onDone?: () => void) => {
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Done.");
      onDone?.();
    });
  };

  return { pending, run };
};
