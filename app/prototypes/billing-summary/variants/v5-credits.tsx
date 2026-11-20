"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";

import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Odometer } from "@/registry/blocks/billing-settings/odometer";
import {
  StatusButton,
  useButtonState,
} from "@/registry/blocks/billing-settings/status-button";
import { LIFT } from "@/registry/blocks/billing-settings/surface";

import { EASE_OUT_QUAD, SLIDE } from "./motion";
import {
  HistoryCard,
  HistoryRow,
  LinkAction,
  Pill,
  SWITCH_MOTION,
  SummaryCard,
  demoWait,
  group,
  useAppear,
} from "./shared";

// V5 · CREDITS (Vapi, Lovable, Manus)
//   Balance (ring + days left)   Buy credits ($10 / $25 / $50)   Auto top-up
// The ring fills when seen (600ms EASE_OUT_QUAD); buying rolls the balance
// up and the ring follows. The pack picker is the same sliding lifted
// pill as the period toggle; the button names what you get.
const CAP = 10_000;
const PER_DAY = 740;
const PACKS = [
  { credits: 1000, price: 10 },
  { credits: 2500, price: 25 },
  { credits: 5000, price: 50 },
];

const Ring = ({ share }: { share: number }) => {
  const reduce = useReducedMotion();
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className="size-16 shrink-0 -rotate-90"
    >
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="6"
        className="stroke-muted"
      />
      <motion.circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c * (1 - share) }}
        transition={
          reduce ? { duration: 0 } : { duration: 0.6, ease: EASE_OUT_QUAD }
        }
        className="stroke-foreground/80"
      />
    </svg>
  );
};

const ACTIVITY = [
  { credits: -740, label: "Calls", meta: "Today · 96 calls" },
  { credits: -812, label: "Calls", meta: "Nov 18 · 104 calls" },
  { credits: -695, label: "Calls", meta: "Nov 17 · 88 calls" },
  {
    credits: 5000,
    label: "Bought 5,000 credits",
    meta: "Nov 14 · $50 · Visa 4242",
  },
];

const signed = (credits: number) =>
  `${credits > 0 ? "+" : "−"}${group(Math.abs(credits))}`;

export const V5Credits = () => {
  const id = useId();
  const reduce = useReducedMotion();
  const [balance, setBalance] = useState(6680);
  const [pack, setPack] = useState(1);
  const [auto, setAuto] = useState(false);
  const [state, run] = useButtonState();
  const [bought, setBought] = useState<{ credits: number; price: number }[]>(
    []
  );
  const { ref, shown } = useAppear({ balance }, { balance: 0 });
  const chosen = PACKS[pack] ?? PACKS[0];
  const days = Math.floor(balance / PER_DAY);

  return (
    <div className="flex w-full flex-col gap-3">
      <div ref={ref} className="grid w-full items-start gap-3 md:grid-cols-4">
        <SummaryCard label="Credit balance" className="md:col-span-2">
          <div className="flex items-center gap-4">
            <Ring share={Math.min(1, shown.balance / CAP)} />
            <div className="flex flex-col gap-0.5">
              <p className="flex items-baseline gap-1">
                <Odometer
                  text={group(Math.round(shown.balance))}
                  className="text-lg font-medium"
                />
                <span className="text-muted-foreground text-xs">credits</span>
              </p>
              <p className="text-muted-foreground text-xs">
                About {days} days left at this pace ({group(PER_DAY)} a day)
              </p>
            </div>
          </div>
          <LinkAction>See usage</LinkAction>
        </SummaryCard>

        <SummaryCard label="Buy credits">
          <div
            role="radiogroup"
            aria-label="Credit pack"
            className="bg-muted/70 dark:bg-muted/50 grid grid-cols-3 gap-0 rounded-lg p-0.5"
          >
            {PACKS.map((each, index) => (
              <button
                key={each.price}
                type="button"
                role="radio"
                aria-checked={pack === index}
                onClick={() => setPack(index)}
                className="focus-visible:ring-ring/50 relative h-7 rounded-md text-sm font-medium outline-none focus-visible:ring-[3px]"
              >
                {pack === index ? (
                  <motion.span
                    layoutId={`${id}-pack`}
                    transition={reduce ? { duration: 0 } : SLIDE}
                    className={cn(
                      LIFT,
                      "bg-background dark:bg-muted absolute inset-0 rounded-md"
                    )}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative",
                    pack !== index && "text-muted-foreground"
                  )}
                >
                  ${each.price}
                </span>
              </button>
            ))}
          </div>
          <StatusButton
            type="button"
            size="sm"
            className="w-full"
            state={state}
            labels={{
              busy: "Buying…",
              done: "Added",
              idle: `Buy ${group(chosen.credits)} credits`,
            }}
            reserve={PACKS.map((each) => `Buy ${group(each.credits)} credits`)}
            onClick={async () => {
              if (await run(() => demoWait(900))) {
                setBalance((value) => value + chosen.credits);
                setBought((list) => [chosen, ...list]);
              }
            }}
          />
        </SummaryCard>

        <SummaryCard label="Auto top-up">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor={`${id}-auto`} className="text-sm font-medium">
              {auto ? "On" : "Off"}
            </label>
            <Switch
              id={`${id}-auto`}
              checked={auto}
              onCheckedChange={setAuto}
              className={SWITCH_MOTION}
            />
          </div>
          <p className="text-muted-foreground text-xs text-pretty">
            When you drop below 1,000 credits, add {group(chosen.credits)} for $
            {chosen.price}.
          </p>
        </SummaryCard>
      </div>
      <HistoryCard title="Credit activity">
        {bought.map((each, index) => (
          <HistoryRow
            key={`bought-${bought.length - index}`}
            fresh
            label={`Bought ${group(each.credits)} credits`}
            meta={`Today · $${each.price} · Visa 4242`}
            amount={signed(each.credits)}
            middle={<Pill tone="ok">Added</Pill>}
          />
        ))}
        {ACTIVITY.map((row) => (
          <HistoryRow
            key={row.meta}
            label={row.label}
            meta={row.meta}
            amount={signed(row.credits)}
            middle={
              row.credits > 0 ? (
                <Pill tone="ok">Added</Pill>
              ) : (
                <Pill tone="muted">Used</Pill>
              )
            }
          />
        ))}
      </HistoryCard>
    </div>
  );
};
