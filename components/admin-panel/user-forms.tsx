"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  createUser,
  deleteUserEverywhere,
  revokeSessions,
  updateUser,
} from "@/app/admin-panel-craft/actions";
import { GrantFields } from "@/components/admin-panel/purchase-forms";
import type {
  GrantValue,
  ItemOption,
} from "@/components/admin-panel/purchase-forms";
import { useAdminAction } from "@/components/admin-panel/use-admin-action";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { ROUTES } from "@/constants/routes";
import type { AdminUser } from "@/lib/admin/data";

// A user is a better-auth user document. Adding one by hand only matters
// with access: sign-in is for buyers, so "Add user" can grant a plan or an
// item at the same time (a manual purchase).
export const AddUserDialog = ({ items }: { items: ItemOption[] }) => {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [withAccess, setWithAccess] = useState(true);
  const [grant, setGrant] = useState<GrantValue>({
    itemId: "",
    kind: "lifetime",
    periodEnd: "",
  });
  const { pending, run } = useAdminAction();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    run(
      () =>
        createUser({
          email,
          grant: withAccess ? grant.kind : "none",
          itemId: grant.itemId || undefined,
          name,
          periodEnd: grant.periodEnd || undefined,
        }),
      () => {
        setOpen(false);
        setEmail("");
        setName("");
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add user</Button>
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>
              They sign in with a magic link sent to this email. Without access,
              the sign-in page turns them away.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-name">Name</Label>
            <Input
              id="new-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <Label className="flex items-center gap-2">
            <Checkbox
              checked={withAccess}
              onCheckedChange={(checked) => setWithAccess(checked === true)}
            />
            Grant access now
          </Label>
          {withAccess && (
            <GrantFields items={items} value={grant} onChange={setGrant} />
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Adding…" : "Add user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Name, email and verified flag. Changing the email moves their purchases to
// the new address too, so their access follows.
export const EditUserForm = ({ user }: { user: AdminUser }) => {
  const [email, setEmail] = useState(user.email);
  const [name, setName] = useState(user.name);
  const [verified, setVerified] = useState(user.emailVerified);
  const { pending, run } = useAdminAction();

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        run(() =>
          updateUser({ email, emailVerified: verified, id: user.id, name })
        );
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="edit-email">Email</Label>
          <Input
            id="edit-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="edit-name">Name</Label>
          <Input
            id="edit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </div>
      <Label className="flex items-center gap-2">
        <Checkbox
          checked={verified}
          onCheckedChange={(checked) => setVerified(checked === true)}
        />
        Email verified
      </Label>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
};

// Signs the user out: of one browser (sessionId), or everywhere.
export const RevokeSessionsButton = ({
  label,
  sessionId,
  userId,
}: {
  label: string;
  sessionId?: string;
  userId: string;
}) => {
  const { pending, run } = useAdminAction();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => run(() => revokeSessions({ sessionId, userId }))}
    >
      {pending ? "Signing out…" : label}
    </Button>
  );
};

// Deletes the user and every record about them. The admin types the email
// to confirm, since it can't be undone.
export const DeleteUserDialog = ({ user }: { user: AdminUser }) => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { pending, run } = useAdminAction();
  const matches = typed.trim().toLowerCase() === user.email.toLowerCase();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete user and all records
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {user.email}?</DialogTitle>
          <DialogDescription>
            This permanently removes the user, all their purchases (by user ID
            and by email), their sessions, linked accounts and pending sign-in
            links. Their access ends at once. Nothing is refunded in Dodo, and
            it can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="confirm-email">Type the email to confirm</Label>
          <Input
            id="confirm-email"
            autoComplete="off"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!matches || pending}
            onClick={() =>
              run(
                () =>
                  deleteUserEverywhere({ confirmEmail: typed, id: user.id }),
                () => router.push(`${ROUTES.ADMIN_PANEL}/users`)
              )
            }
          >
            {pending ? "Deleting…" : "Delete everything"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
