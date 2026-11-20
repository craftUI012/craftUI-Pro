"use client";

import { Download04Icon } from "@hugeicons/core-free-icons";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

import { Switch } from "@/components/ui/switch";
import {
  StatusButton,
  useButtonState,
} from "@/registry/blocks/billing-settings/status-button";
import { RING_BUTTON } from "@/registry/blocks/billing-settings/surface";

import { EASE_OUT } from "./motion";
import {
  Amount,
  HistoryCard,
  HistoryRow,
  LinkAction,
  Pill,
  RowDownload,
  SWITCH_MOTION,
  SummaryCard,
  demoWait,
  usd,
  useAppear,
} from "./shared";

// V3 · BILLS (utilities, telecom, insurance; Rocket Money)
//   Amount due [Pay now]   Autopay (switch)   Last bill (+6%) [↓ Bill]
// Pay now: spinner → ✓ Paid; then the amount rolls to $0.00, the pill
// rolls Due → Paid, and the due line becomes a thank-you (each 200ms).
// Autopay says exactly what will happen, in a line that swaps with it.

// A line of text that rolls when its words change (200ms ease-out).
const Rolling = ({
  children,
  className,
}: {
  children: string;
  className?: string;
}) => {
  const reduce = useReducedMotion();
  return (
    <span className="relative block overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={children}
          initial={{ opacity: 0, y: reduce ? 0 : "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : "-100%" }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
          className={className ?? "block"}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

const BILLS = [
  { amount: 79.1, label: "October", meta: "Paid Nov 4 · Visa 4242" },
  { amount: 74.62, label: "September", meta: "Paid Oct 3 · Visa 4242" },
  { amount: 81.2, label: "August", meta: "Paid Sep 4 · Visa 4242" },
];

export const V3Bills = () => {
  const id = useId();
  const [paid, setPaid] = useState(false);
  const [autopay, setAutopay] = useState(true);
  const [pay, runPay] = useButtonState();
  const [bill, runBill] = useButtonState();
  const due = paid ? 0 : 84.2;
  const { ref, shown } = useAppear({ due, last: 79.1 }, { due: 0, last: 0 });

  return (
    <div className="flex w-full flex-col gap-3">
      <div ref={ref} className="grid w-full gap-3 md:grid-cols-4">
        <SummaryCard
          label="Amount due"
          className="md:col-span-2"
          aside={
            <span className="relative inline-flex overflow-hidden">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.span
                  key={paid ? "paid" : "due"}
                  initial={{ opacity: 0, y: "100%" }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: "-100%" }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  {paid ? (
                    <Pill tone="ok">Paid</Pill>
                  ) : (
                    <Pill tone="warn">Due in 6 days</Pill>
                  )}
                </motion.span>
              </AnimatePresence>
            </span>
          }
        >
          <div className="flex items-end justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <Amount text={usd(shown.due)} />
              <Rolling className="text-muted-foreground block text-xs">
                {paid
                  ? "Thanks, paid Nov 29 with Visa 4242"
                  : "Due Dec 5 · November bill"}
              </Rolling>
            </div>
            <StatusButton
              type="button"
              size="sm"
              disabled={paid && pay === "idle"}
              state={pay}
              labels={{
                busy: "Paying…",
                done: "Paid",
                idle: paid ? "Paid" : "Pay now",
              }}
              reserve={["Pay now", "Paid"]}
              onClick={async () => {
                if (await runPay(() => demoWait(1000))) {
                  setPaid(true);
                }
              }}
            />
          </div>
        </SummaryCard>

        <SummaryCard label="Autopay">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`${id}-autopay`} className="text-sm font-medium">
              {autopay ? "On" : "Off"}
            </label>
            <Switch
              id={`${id}-autopay`}
              checked={autopay}
              onCheckedChange={setAutopay}
              className={SWITCH_MOTION}
            />
          </div>
          <Rolling className="text-muted-foreground block text-xs text-pretty">
            {autopay
              ? "We'll charge Visa 4242 on each due date."
              : "You'll pay each bill yourself."}
          </Rolling>
          <LinkAction>Change card</LinkAction>
        </SummaryCard>

        <SummaryCard
          label="Last bill"
          aside={
            <span className="text-xs text-amber-700 dark:text-amber-400">
              +6% on Sep
            </span>
          }
        >
          <Amount text={usd(shown.last)} />
          <p className="text-muted-foreground text-xs">October · paid Nov 4</p>
          <StatusButton
            type="button"
            variant="outline"
            size="sm"
            className={`${RING_BUTTON} self-start`}
            icon={Download04Icon}
            state={bill}
            labels={{ busy: "Preparing bill…", done: "Saved", idle: "Bill" }}
            onClick={() => runBill(() => demoWait(1100))}
          />
        </SummaryCard>
      </div>
      <HistoryCard title="Bill history">
        {paid ? (
          <HistoryRow
            key="November"
            fresh
            label="November"
            meta="Paid Nov 29 · Visa 4242"
            amount={usd(84.2)}
            middle={<Pill tone="ok">Paid</Pill>}
            action={<RowDownload what="November bill" />}
          />
        ) : null}
        {BILLS.map((row) => (
          <HistoryRow
            key={row.label}
            label={row.label}
            meta={row.meta}
            amount={usd(row.amount)}
            middle={<Pill tone="ok">Paid</Pill>}
            action={<RowDownload what={`${row.label} bill`} />}
          />
        ))}
      </HistoryCard>
    </div>
  );
};
