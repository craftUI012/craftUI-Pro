"use client";

import { useState } from "react";

import {
  createPurchase,
  deletePurchase,
  updatePurchase,
} from "@/app/admin-panel-craft/actions";
import { useAdminAction } from "@/components/admin-panel/use-admin-action";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { PURCHASE_STATUSES } from "@/lib/admin/constants";
import type { PURCHASE_KINDS } from "@/lib/admin/constants";
import { toDateInput } from "@/lib/admin/format";
import type { PurchaseDoc } from "@/lib/db/schema";

export interface ItemOption {
  id: string;
  title: string;
}

type Kind = (typeof PURCHASE_KINDS)[number];

export interface GrantValue {
  itemId: string;
  kind: Kind;
  periodEnd: string;
}

// What a purchase unlocks: its kind, the item for an item purchase, and the
// end date for a yearly plan. Shared by the purchase form and "Add user".
export const GrantFields = ({
  items,
  onChange,
  value,
}: {
  items: ItemOption[];
  onChange: (value: GrantValue) => void;
  value: GrantValue;
}) => (
  <>
    <div className="grid gap-2">
      <Label htmlFor="grant-kind">Access</Label>
      <NativeSelect
        id="grant-kind"
        value={value.kind}
        onChange={(event) =>
          onChange({ ...value, kind: event.target.value as Kind })
        }
      >
        <NativeSelectOption value="lifetime">
          Lifetime (everything, forever)
        </NativeSelectOption>
        <NativeSelectOption value="yearly">
          Yearly (everything, until the end date)
        </NativeSelectOption>
        <NativeSelectOption value="item">One item</NativeSelectOption>
      </NativeSelect>
    </div>
    {value.kind === "item" && (
      <div className="grid gap-2">
        <Label htmlFor="grant-item">Item</Label>
        <NativeSelect
          id="grant-item"
          value={value.itemId}
          onChange={(event) =>
            onChange({ ...value, itemId: event.target.value })
          }
        >
          <NativeSelectOption value="">Pick an item…</NativeSelectOption>
          {items.map((item) => (
            <NativeSelectOption key={item.id} value={item.id}>
              {item.id} · {item.title}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    )}
    {value.kind === "yearly" && (
      <div className="grid gap-2">
        <Label htmlFor="grant-end">Access ends</Label>
        <Input
          id="grant-end"
          type="date"
          value={value.periodEnd}
          onChange={(event) =>
            onChange({ ...value, periodEnd: event.target.value })
          }
        />
        <p className="text-muted-foreground text-xs">
          Empty means a year from today.
        </p>
      </div>
    )}
  </>
);

// Add a purchase by hand (no purchase given), or edit one. Edits change our
// database only: nothing is refunded or cancelled in Dodo.
export const PurchaseDialog = ({
  defaultEmail = "",
  items,
  purchase,
  trigger = "add",
}: {
  defaultEmail?: string;
  items: ItemOption[];
  purchase?: PurchaseDoc;
  // The button that opens it: "Add purchase" (filled) or "Edit" (ghost,
  // in a table row). Built here, not passed in: a server page can't hand an
  // element to the trigger's asChild without breaking hydration.
  trigger?: "add" | "edit";
}) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(purchase?.email ?? defaultEmail);
  const [status, setStatus] = useState(purchase?.status ?? "active");
  const [grant, setGrant] = useState<GrantValue>({
    itemId: purchase?.itemId ?? "",
    kind: purchase?.kind ?? "lifetime",
    periodEnd: toDateInput(purchase?.currentPeriodEnd),
  });
  const { pending, run } = useAdminAction();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = {
      email,
      itemId: grant.itemId || undefined,
      kind: grant.kind,
      periodEnd: grant.periodEnd || undefined,
      status,
    };
    run(
      () =>
        purchase
          ? updatePurchase({ ...input, id: purchase._id })
          : createPurchase(input),
      () => setOpen(false)
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger === "edit" ? (
          <Button size="sm" variant="ghost">
            Edit
          </Button>
        ) : (
          <Button size="sm">Add purchase</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {purchase ? "Edit purchase" : "Add purchase"}
            </DialogTitle>
            <DialogDescription>
              {purchase
                ? `${purchase._id} · ${purchase.provider}. Changes apply to access here only; nothing changes in Dodo.`
                : 'Grants access by hand (provider "manual"). The person signs in with this email.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="purchase-email">Email</Label>
            <Input
              id="purchase-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <GrantFields items={items} value={grant} onChange={setGrant} />
          <div className="grid gap-2">
            <Label htmlFor="purchase-status">Status</Label>
            <NativeSelect
              id="purchase-status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {PURCHASE_STATUSES.map((value) => (
                <NativeSelectOption key={value} value={value}>
                  {value.replaceAll("_", " ")}
                  {value === "active" ? " (grants access)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export const DeletePurchaseButton = ({
  purchase,
}: {
  purchase: PurchaseDoc;
}) => {
  const [open, setOpen] = useState(false);
  const { pending, run } = useAdminAction();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="text-destructive">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this purchase?</DialogTitle>
          <DialogDescription>
            {purchase._id} ({purchase.kind}, {purchase.email}). Its access ends
            now. This removes our record only: no refund is made in Dodo, and
            the purchase can&apos;t be restored. To end access but keep the
            record, edit it and set the status to refunded instead.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={() =>
              run(
                () => deletePurchase({ id: purchase._id }),
                () => setOpen(false)
              )
            }
          >
            {pending ? "Deleting…" : "Delete purchase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
