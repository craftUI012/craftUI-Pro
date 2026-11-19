"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

import { StatusButton } from "./status-button";
import { FLOAT, RING_BUTTON } from "./surface";

/* ─────────────────────────────────────────────────────────
 * CONFIRM DIALOG: for actions that weaken security or can't be undone
 * (turning off two-factor, signing out every other session).
 *
 * The title names the action and the object ("Sign out of 3 other
 * sessions?"), the body says what happens, and the button repeats the
 * action ("Sign out 3 sessions"), never "Yes" / "OK". While it runs, the
 * button says so and the dialog can't be closed half-way.
 * ───────────────────────────────────────────────────────── */

export const ConfirmDialog = ({
  body,
  confirmLabel,
  busyLabel,
  destructive = true,
  onConfirm,
  onOpenChange,
  open,
  title,
}: {
  body: string;
  confirmLabel: string;
  busyLabel: string;
  destructive?: boolean;
  onConfirm: () => Promise<void>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) => {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const confirm = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await onConfirm();
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    setBusy(false);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) {
          setFailed(false);
          onOpenChange(value);
        }
      }}
    >
      <DialogContent className={cn(FLOAT, "gap-5 sm:max-w-md")}>
        <DialogHeader>
          <DialogTitle className="text-lg font-medium tracking-tight">
            {title}
          </DialogTitle>
          <DialogDescription className="text-pretty">{body}</DialogDescription>
        </DialogHeader>
        {failed ? (
          <p aria-live="polite" className="text-destructive text-xs">
            That didn't work. Check your connection and try again.
          </p>
        ) : null}
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={RING_BUTTON}
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <StatusButton
            type="button"
            size="sm"
            variant={destructive ? "destructive" : "default"}
            state={busy ? "busy" : "idle"}
            labels={{ busy: busyLabel, idle: confirmLabel }}
            onClick={confirm}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
