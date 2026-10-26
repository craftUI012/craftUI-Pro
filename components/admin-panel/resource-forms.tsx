"use client";

import { useState } from "react";

import {
  createResource,
  deleteResource,
  updateResource,
} from "@/app/admin-panel-craft/actions";
import { useAdminAction } from "@/components/admin-panel/use-admin-action";
import { Badge } from "@/components/ui/badge";
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
import {
  MAX_RESOURCE_TAGS,
  RESOURCE_CATEGORIES,
  normalizeTags,
} from "@/lib/admin/constants";
import type { ResourceCategory } from "@/lib/admin/constants";
import type { ResourceDoc } from "@/lib/db/schema";

// Add a resource (no resource given), or edit one. Tags are typed comma-
// separated; the line under the field shows them as they'll be saved, and
// tags already in use can be clicked to add them, so one idea doesn't end
// up as "design-system" and "design-systems".
export const ResourceDialog = ({
  defaultCategory = "website",
  knownTags,
  resource,
  trigger = "add",
}: {
  defaultCategory?: ResourceCategory;
  // Tags already used by other resources, for the quick-add chips.
  knownTags: string[];
  resource?: ResourceDoc;
  // "Add resource" (filled) or "Edit" (ghost, in a table row). Built here:
  // a server page can't hand an element to the trigger's asChild without
  // breaking hydration.
  trigger?: "add" | "edit";
}) => {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<ResourceCategory>(
    resource?.category ?? defaultCategory
  );
  const [name, setName] = useState(resource?.name ?? "");
  const [url, setUrl] = useState(resource?.url ?? "");
  const [tags, setTags] = useState(resource?.tags.join(", ") ?? "");
  const { pending, run } = useAdminAction();
  const saved = normalizeTags(tags);
  const suggestions = knownTags.filter((tag) => !saved.includes(tag));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = { category, name, tags, url };
    run(
      () =>
        resource
          ? updateResource({ ...input, id: resource._id })
          : createResource(input),
      () => {
        setOpen(false);
        if (!resource) {
          setName("");
          setUrl("");
          setTags("");
        }
      }
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
          <Button size="sm">Add resource</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form className="grid gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>
              {resource ? "Edit resource" : "Add resource"}
            </DialogTitle>
            <DialogDescription>
              A website, a designer on X, an X post or a tool worth keeping,
              with tags to filter by later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="resource-category">Category</Label>
            <NativeSelect
              id="resource-category"
              value={category}
              onChange={(event) =>
                setCategory(event.target.value as ResourceCategory)
              }
            >
              {RESOURCE_CATEGORIES.map((option) => (
                <NativeSelectOption key={option.id} value={option.id}>
                  {option.one}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resource-name">Name</Label>
            <Input
              id="resource-name"
              required
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resource-url">Link</Label>
            <Input
              id="resource-url"
              type="url"
              required
              placeholder="https://"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="resource-tags">Tags</Label>
            <Input
              id="resource-tags"
              placeholder="design, motion, landing-pages"
              value={tags}
              onChange={(event) => setTags(event.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Comma-separated, up to {MAX_RESOURCE_TAGS}.
              {saved.length > 0 && <> Saved as: {saved.join(", ")}</>}
            </p>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {suggestions.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setTags([...saved, tag].join(", "))}
                  >
                    <Badge variant="outline">+ {tag}</Badge>
                  </button>
                ))}
              </div>
            )}
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

export const DeleteResourceButton = ({
  resource,
}: {
  resource: ResourceDoc;
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
          <DialogTitle>Delete &ldquo;{resource.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            {resource.url}. This can&apos;t be undone.
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
                () => deleteResource({ id: resource._id }),
                () => setOpen(false)
              )
            }
          >
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
