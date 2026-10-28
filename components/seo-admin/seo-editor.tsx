"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { ReactNode } from "react";

import { saveSeoText } from "@/app/(app)/seo-admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// The edit form in a /seo-admin audit row, for docs pages. Two numbered
// groups, each saying where its text appears and which file it's saved to:
// 1 is what search engines and share cards show (the MDX front matter), 2 is
// what this site shows on the item's card (registry.json).

export interface SeoEditorValues {
  path: string;
  file: string;
  title: string;
  description: string;
  card?: { name: string; description: string };
}

const Counter = ({ max, value }: { max: number; value: number }) => (
  <span
    className={cn(
      "font-mono text-xs tabular-nums",
      value > max ? "text-destructive" : "text-muted-foreground"
    )}
  >
    {value}/{max}
  </span>
);

const Field = ({
  children,
  count,
  hint,
  id,
  label,
}: {
  children: ReactNode;
  count: ReactNode;
  hint: string;
  id: string;
  label: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <div className="flex items-baseline justify-between gap-3">
      <Label htmlFor={id}>{label}</Label>
      {count}
    </div>
    {children}
    <p className="text-muted-foreground text-xs text-pretty" id={`${id}-hint`}>
      {hint}
    </p>
  </div>
);

const Group = ({
  children,
  number,
  saveTo,
  title,
  where,
}: {
  children: ReactNode;
  number: number;
  saveTo: string;
  title: string;
  where: string;
}) => (
  <fieldset className="flex flex-col gap-3 rounded-md border p-3">
    <legend className="px-1 text-sm font-medium">
      {number}. {title}
    </legend>
    <p className="text-muted-foreground -mt-1 text-xs text-pretty">
      {where} Saved to <code className="font-mono">{saveTo}</code>.
    </p>
    {children}
  </fieldset>
);

export const SeoEditor = ({
  limits,
  siteName,
  values,
}: {
  /** The audit's own limits, so its counters and these agree. */
  limits: { description: number; title: number };
  siteName: string;
  values: SeoEditorValues;
}) => {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(values.title);
  const [description, setDescription] = useState(values.description);
  const [card, setCard] = useState(values.card?.description ?? "");
  const [status, setStatus] = useState<{
    kind: "error" | "ok";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  // What the browser tab and Google show: the site name is added after it.
  const fullTitle = `${title.trim()} | ${siteName}`;

  const reset = () => {
    setTitle(values.title);
    setDescription(values.description);
    setCard(values.card?.description ?? "");
    setStatus(null);
  };

  const save = () => {
    setStatus(null);
    startTransition(async () => {
      const result = await saveSeoText({
        card: values.card ? card : undefined,
        description,
        path: values.path,
        title,
      });
      if ("error" in result) {
        setStatus({ kind: "error", text: result.error });
        return;
      }
      setStatus({ kind: "ok", text: result.message });
      router.refresh();
    });
  };

  if (!open) {
    return (
      <div className="mt-2 flex items-center gap-3">
        <Button onClick={() => setOpen(true)} size="sm" variant="outline">
          Edit SEO text
        </Button>
        {status?.kind === "ok" ? (
          <span className="text-xs text-emerald-600" role="status">
            {status.text}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <form
      className="mt-3 flex min-w-[22rem] flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <Group
        number={1}
        saveTo={values.file}
        title="SEO & search"
        where="What Google, the browser tab and social share cards show for this page."
      >
        <Field
          count={<Counter max={limits.title} value={fullTitle.length} />}
          hint={`Shown as “${fullTitle}”: the site name is added for you.`}
          id={`${id}-title`}
          label="Page title"
        >
          <Input
            aria-describedby={`${id}-title-hint`}
            id={`${id}-title`}
            onChange={(event) => setTitle(event.target.value)}
            value={title}
          />
        </Field>
        <Field
          count={
            <Counter
              max={limits.description}
              value={description.trim().length}
            />
          }
          hint="The grey text under the title in search results, and the text on the share image. Search results cut it off when it runs long."
          id={`${id}-description`}
          label="Search description"
        >
          <Textarea
            aria-describedby={`${id}-description-hint`}
            id={`${id}-description`}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            value={description}
          />
        </Field>
      </Group>

      {values.card ? (
        <Group
          number={2}
          saveTo="registry.json"
          title="Component description for the website"
          where={`What this site shows for “${values.card.name}”: the line under its card on the browse page, and its install data (shadcn CLI, AI tools). The registry is rebuilt when it changes.`}
        >
          <Field
            count={
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {card.trim().length}
              </span>
            }
            hint="Written for people browsing the library: no need to start with “A shadcn/ui …”."
            id={`${id}-card`}
            label="Card description"
          >
            <Textarea
              aria-describedby={`${id}-card-hint`}
              id={`${id}-card`}
              onChange={(event) => setCard(event.target.value)}
              rows={3}
              value={card}
            />
          </Field>
        </Group>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pending} size="sm" type="submit">
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button
          disabled={pending}
          onClick={() => {
            reset();
            setOpen(false);
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Close
        </Button>
        <span
          className={cn(
            "text-xs",
            status?.kind === "error" ? "text-destructive" : "text-emerald-600"
          )}
          role="status"
        >
          {status?.text}
        </span>
      </div>
      {values.card && pending ? (
        <p className="text-muted-foreground text-xs">
          Rebuilding the registry takes a few seconds.
        </p>
      ) : null}
    </form>
  );
};
