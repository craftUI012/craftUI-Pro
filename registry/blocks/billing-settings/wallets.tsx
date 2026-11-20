"use client";

import { AppleIcon, PaypalIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useBillingActions } from "./actions";
import type { WalletId } from "./actions";
import { MOTION } from "./billing-motion";
import { GoogleMark } from "./brand-marks";
import { EmptySlot } from "./card-slot";
import { StatusButton, useButtonState } from "./status-button";
import { LIFT } from "./surface";

/* ─────────────────────────────────────────────────────────
 * WALLET PANEL: one wallet, full width, under its tab.
 *
 *   not set up   the same dashed empty slot as a free card slot, with
 *                what it does and Connect (spinner → ✓ Connected)
 *   connected    a lifted row: logo, "Connected as …", Disconnect
 *   swap         the two cross-fade (exit 150ms, enter 200ms ease-out)
 * ───────────────────────────────────────────────────────── */

export type { WalletId } from "./actions";
export type WalletState = Record<WalletId, string | null>;

export const WALLETS: Record<
  WalletId,
  {
    label: string;
    icon: IconSvgElement | null;
    tint: string;
    pitch: string;
    note: string;
  }
> = {
  apple: {
    icon: AppleIcon,
    label: "Apple Pay",
    note: "Charges come from the card in your Apple Wallet. You confirm with Face ID or Touch ID.",
    pitch: "Pay with the cards in your Apple Wallet, on Safari and in the app.",
    tint: "text-foreground",
  },
  google: {
    icon: null,
    label: "Google Pay",
    note: "Charges come from the card saved in your Google account.",
    pitch: "Pay with the cards saved in your Google account, on any browser.",
    tint: "",
  },
  paypal: {
    icon: PaypalIcon,
    label: "PayPal",
    note: "PayPal charges your balance first, then your linked bank or card.",
    pitch: "Pay from your PayPal balance or the bank linked to it.",
    tint: "text-[#003087] dark:text-[#4BA3E3]",
  },
};

export const WalletLogo = ({
  id,
  className,
}: {
  id: WalletId;
  className?: string;
}) => {
  const wallet = WALLETS[id];
  return wallet.icon ? (
    <HugeiconsIcon
      icon={wallet.icon}
      strokeWidth={2}
      className={cn("size-4 shrink-0", wallet.tint, className)}
    />
  ) : (
    <GoogleMark />
  );
};

export const WalletPanel = ({
  id,
  account,
  onChange,
}: {
  id: WalletId;
  account: string | null;
  onChange: (account: string | null) => void;
}) => {
  const wallet = WALLETS[id];
  const [state, run] = useButtonState(900);
  const actions = useBillingActions();
  const connected = account !== null && state === "idle";

  return (
    <div className="relative">
      <AnimatePresence initial={false} mode="popLayout">
        {connected ? (
          <motion.div
            key="connected"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: MOTION.enter }}
            exit={{ opacity: 0, transition: MOTION.exit }}
            className="flex flex-col gap-3"
          >
            <div
              className={cn(
                LIFT,
                "bg-background dark:bg-muted flex items-center gap-3 rounded-xl p-4"
              )}
            >
              <span className="bg-muted dark:bg-background/50 flex size-10 items-center justify-center rounded-lg">
                <WalletLogo id={id} className="size-5" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm">{wallet.label}</span>
                <span className="text-muted-foreground truncate text-xs">
                  Connected as {account}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Optimistic: the row goes back at once; the call follows.
                  onChange(null);
                  actions.disconnectWallet(id);
                }}
                aria-label={`Disconnect ${wallet.label}`}
                className="text-muted-foreground hover:text-foreground"
              >
                Disconnect
              </Button>
            </div>
            <p className="text-muted-foreground px-1 text-xs text-pretty">
              {wallet.note}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: MOTION.enter }}
            exit={{ opacity: 0, transition: MOTION.exit }}
          >
            <EmptySlot className="sm:aspect-auto">
              <div className="flex max-w-xs flex-col items-center gap-3 p-6 text-center">
                <span className="bg-background dark:bg-muted flex size-10 items-center justify-center rounded-lg shadow-[0_1px_2px_0_oklch(0_0_0/0.08)]">
                  <WalletLogo id={id} className="size-5" />
                </span>
                <p className="text-muted-foreground text-sm text-pretty">
                  {wallet.pitch}
                </p>
                <StatusButton
                  type="button"
                  size="sm"
                  state={state}
                  labels={{
                    busy: "Connecting…",
                    done: "Connected",
                    idle: `Connect ${wallet.label}`,
                  }}
                  onClick={async () => {
                    let connectedAs = "";
                    if (
                      await run(async () => {
                        connectedAs = await actions.connectWallet(id);
                      })
                    ) {
                      onChange(connectedAs);
                    }
                  }}
                />
              </div>
            </EmptySlot>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
