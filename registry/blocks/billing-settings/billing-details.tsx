"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import useMeasure from "react-use-measure";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { useBillingActions } from "./actions";
import type { BillingInfo } from "./actions";
import { MOTION, stepVariants } from "./billing-motion";
import { StatusButton, useButtonState } from "./status-button";
import { LinkAction, SummaryCard } from "./ui";

export type { BillingInfo } from "./actions";

/* ─────────────────────────────────────────────────────────
 * BILLING DETAILS (on the page): what prints on every invoice and
 * where receipts go.
 *
 *   summary   four label-over-value columns
 *   edit      Edit turns the card into the form in place: the card's
 *             height follows its content (react-use-measure +
 *             MOTION.morph, spring 0.23s b0) while the summary and the
 *             form swap with a blur cross-fade (stepVariants).
 *             Save → spinner → ✓ → back to summary.
 * ───────────────────────────────────────────────────────── */

export const DEMO_BILLING: BillingInfo = {
  city: "San Francisco, CA 94105",
  company: "Acme Inc.",
  country: "United States",
  email: "billing@acme.co",
  street: "500 Howard Street",
  taxId: "",
};

const RING =
  "border border-transparent shadow-[0_0_0_1px_oklch(0_0_0/0.08),0_1px_2px_-1px_oklch(0_0_0/0.06),0_2px_4px_0_oklch(0_0_0/0.04)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1)]";
const FIELD = cn(RING, "bg-background dark:bg-muted h-9");

const Item = ({ label, children }: { label: string; children: string }) => (
  <div className="flex min-w-0 flex-col gap-0.5">
    <dt className="text-muted-foreground text-xs">{label}</dt>
    <dd className="text-sm text-pretty break-words">{children}</dd>
  </div>
);

const Summary = ({ info }: { info: BillingInfo }) => (
  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
    <Item label="Receipts go to">{info.email}</Item>
    <Item label="Company">{info.company}</Item>
    <Item label="Address">
      {`${info.street}, ${info.city}, ${info.country}`}
    </Item>
    <Item label="Tax ID">{info.taxId || "None added"}</Item>
  </dl>
);

const FIELDS: {
  key: keyof BillingInfo;
  label: string;
  type?: string;
  autoComplete: string;
  optional?: boolean;
}[] = [
  {
    autoComplete: "email",
    key: "email",
    label: "Billing email",
    type: "email",
  },
  { autoComplete: "organization", key: "company", label: "Company" },
  { autoComplete: "address-line1", key: "street", label: "Street" },
  { autoComplete: "address-level2", key: "city", label: "City and postcode" },
  { autoComplete: "country-name", key: "country", label: "Country" },
  { autoComplete: "off", key: "taxId", label: "Tax ID", optional: true },
];

const BillingForm = ({
  info,
  onCancel,
  onSave,
}: {
  info: BillingInfo;
  onCancel: () => void;
  onSave: (next: BillingInfo) => void;
}) => {
  const id = useId();
  const [draft, setDraft] = useState(info);
  const [error, setError] = useState<string | null>(null);
  const [state, run] = useButtonState(700);
  const actions = useBillingActions();

  return (
    <form
      noValidate
      aria-label="Edit billing details"
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (state !== "idle") {
          return;
        }
        if (!/^\S+@\S+\.\S+$/.test(draft.email)) {
          setError("Enter an email address, like billing@acme.co.");
          return;
        }
        setError(null);
        if (await run(() => actions.saveBilling(draft))) {
          onSave(draft);
        }
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label
              htmlFor={`${id}-${field.key}`}
              className="px-1 text-xs font-normal"
            >
              {field.label}
              {field.optional ? (
                <span className="text-muted-foreground"> (optional)</span>
              ) : null}
            </Label>
            <Input
              id={`${id}-${field.key}`}
              type={field.type ?? "text"}
              autoComplete={field.autoComplete}
              autoFocus={field.key === "email"}
              value={draft[field.key]}
              aria-invalid={field.key === "email" && error ? true : undefined}
              aria-describedby={
                field.key === "email" && error ? `${id}-email-error` : undefined
              }
              onChange={(event) =>
                setDraft((value) => ({
                  ...value,
                  [field.key]: event.target.value,
                }))
              }
              className={FIELD}
            />
            {field.key === "email" && error ? (
              <p
                id={`${id}-email-error`}
                className="text-destructive px-1 text-xs text-pretty"
              >
                {error}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <StatusButton
          type="submit"
          size="sm"
          state={state}
          labels={{ busy: "Saving…", done: "Saved", idle: "Save" }}
        />
      </div>
    </form>
  );
};

export const BillingDetailsCard = ({
  initial = DEMO_BILLING,
}: {
  /** The details on file when the page loads. */
  initial?: BillingInfo;
}) => {
  const reduce = useReducedMotion();
  const [info, setInfo] = useState(initial);
  const [editing, setEditing] = useState(false);
  // Measure the inner div; animate the outer one to that height.
  const [ref, bounds] = useMeasure({ offsetSize: true });

  return (
    <SummaryCard
      label="Billing details"
      aside={
        editing ? null : (
          <LinkAction
            label="Edit billing details"
            onClick={() => setEditing(true)}
          >
            Edit
          </LinkAction>
        )
      }
    >
      <motion.div
        // auto before the first measure, and always under reduced motion.
        animate={{
          height: reduce || bounds.height === 0 ? "auto" : bounds.height,
        }}
        transition={MOTION.morph}
        className="-m-1 overflow-hidden"
      >
        <div ref={ref} className="relative p-1">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={editing ? "form" : "summary"}
              {...stepVariants(Boolean(reduce))}
            >
              {editing ? (
                <BillingForm
                  info={info}
                  onCancel={() => setEditing(false)}
                  onSave={(next) => {
                    setInfo(next);
                    setEditing(false);
                  }}
                />
              ) : (
                <Summary info={info} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </SummaryCard>
  );
};
