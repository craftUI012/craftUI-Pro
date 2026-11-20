"use client";

import { AnimatePresence } from "motion/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  StatusButton,
  useButtonState,
} from "@/registry/blocks/billing-settings/status-button";
import { RING_BUTTON } from "@/registry/blocks/billing-settings/surface";

import { Reveal } from "./motion";
import {
  Amount,
  HistoryCard,
  HistoryRow,
  LinkAction,
  Pill,
  SummaryCard,
  demoWait,
  usd,
  useAppear,
} from "./shared";

// V4 · PAYOUTS (Fiverr, Stripe, ElevenLabs)
//   Available [Withdraw]   Clearing (3 orders, dates)   Next payout   In transit
// Withdraw folds open a one-line confirmation (where, when it arrives);
// confirming rolls Available down to $0.00 while In transit rolls up by
// the same amount, so the money visibly moves between the two cards.
const CLEARING = [
  { amount: 120, on: "Dec 1" },
  { amount: 80, on: "Dec 2" },
  { amount: 120, on: "Dec 4" },
];

const PAYOUTS = [
  { amount: 860, label: "Nov 26", meta: "Automatic · Chase •••• 7411" },
  { amount: 1120, label: "Nov 19", meta: "Automatic · Chase •••• 7411" },
  { amount: 640, label: "Nov 12", meta: "Withdrawal · Chase •••• 7411" },
];

export const V4Payouts = () => {
  const [available, setAvailable] = useState(1240.5);
  const [transit, setTransit] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [sent, setSent] = useState<number[]>([]);
  const [state, run] = useButtonState();
  const clearing = CLEARING.reduce((sum, row) => sum + row.amount, 0);
  const { ref, shown } = useAppear(
    { available, clearing, transit },
    { available: 0, clearing: 0, transit: 0 }
  );

  const withdraw = async () => {
    const amount = available;
    if (await run(() => demoWait(1000))) {
      setAvailable(0);
      setTransit((value) => value + amount);
      setSent((list) => [amount, ...list]);
      setConfirming(false);
    }
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div ref={ref} className="grid w-full items-start gap-3 md:grid-cols-4">
        <SummaryCard label="Available to withdraw" className="md:col-span-2">
          <div className="flex items-end justify-between gap-4">
            <Amount text={usd(shown.available)} />
            {confirming ? null : (
              <Button
                type="button"
                size="sm"
                disabled={available === 0}
                onClick={() => setConfirming(true)}
              >
                Withdraw
              </Button>
            )}
          </div>
          <AnimatePresence initial={false}>
            {confirming ? (
              <Reveal key="confirm">
                <div className="bg-muted/50 dark:bg-muted/30 flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-pretty">
                    {usd(available)} to Chase •••• 7411
                    <span className="text-muted-foreground block text-xs">
                      Arrives in 1–2 business days
                    </span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={RING_BUTTON}
                      disabled={state !== "idle"}
                      onClick={() => setConfirming(false)}
                    >
                      Cancel
                    </Button>
                    <StatusButton
                      type="button"
                      size="sm"
                      state={state}
                      labels={{
                        busy: "Sending…",
                        done: "Sent",
                        idle: "Confirm",
                      }}
                      onClick={withdraw}
                    />
                  </div>
                </div>
              </Reveal>
            ) : null}
          </AnimatePresence>
          <LinkAction>Payout settings</LinkAction>
        </SummaryCard>

        <SummaryCard label="Clearing">
          <Amount text={usd(shown.clearing)} />
          <ul className="flex flex-col gap-1">
            {CLEARING.map((row) => (
              <li
                key={row.on}
                className="text-muted-foreground flex justify-between text-xs tabular-nums"
              >
                <span>{usd(row.amount, false)}</span>
                <span>clears {row.on}</span>
              </li>
            ))}
          </ul>
        </SummaryCard>

        <SummaryCard
          label="In transit"
          aside={transit > 0 ? <Pill tone="muted">On its way</Pill> : null}
        >
          <Amount text={usd(shown.transit)} />
          <p className="text-muted-foreground text-xs">
            Next automatic payout Dec 3
          </p>
          <p className="text-muted-foreground text-xs">
            Last: $860.00 · Nov 26
          </p>
        </SummaryCard>
      </div>
      <HistoryCard title="Payouts">
        {sent.map((amount, index) => (
          <HistoryRow
            key={`sent-${sent.length - index}`}
            fresh
            label="Today"
            meta="Withdrawal · Chase •••• 7411"
            amount={usd(amount)}
            middle={<Pill tone="muted">In transit</Pill>}
          />
        ))}
        {PAYOUTS.map((row) => (
          <HistoryRow
            key={row.label}
            label={row.label}
            meta={row.meta}
            amount={usd(row.amount)}
            middle={<Pill tone="ok">Paid</Pill>}
          />
        ))}
      </HistoryCard>
    </div>
  );
};
