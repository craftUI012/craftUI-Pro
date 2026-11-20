"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import {
  resetEmail,
  saveEmail,
  sendEmailTest,
} from "@/app/admin-panel-craft/emails/actions";
import { useAdminAction } from "@/components/admin-panel/use-admin-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EMAIL_FIELDS,
  emailProblems,
  renderEmail,
  sampleValues,
} from "@/lib/emails/compose";
import type { EmailContent, EmailField, EmailId } from "@/lib/emails/compose";
import { getEmailTemplate } from "@/lib/emails/templates";
import { cn } from "@/lib/utils";

// The admin panel's email editor (app/admin-panel-craft/emails/[id]): the
// email's words as fields on the left, the email as it'll arrive on the
// right, rendered by the same code that sends it (lib/emails/compose.ts)
// with the email's sample values. Values ({{email}}…) go in at the cursor
// from the chips. Save puts the words live; Send test emails them, saved or
// not, to the signed-in admin; Reset deletes the edited words so the
// defaults in code send again.

const FIELDS: {
  field: EmailField;
  hint?: string;
  label: string;
  multiline?: boolean;
}[] = [
  { field: "subject", label: "Subject" },
  {
    field: "preheader",
    hint: "The grey line after the subject in most inboxes.",
    label: "Inbox preview",
  },
  { field: "heading", label: "Heading" },
  { field: "intro", label: "Before the button", multiline: true },
  { field: "button", label: "Button" },
  { field: "outro", label: "After the button", multiline: true },
  {
    field: "footer",
    hint: "Small grey text under the line at the bottom.",
    label: "Small print",
    multiline: true,
  },
];

const sameWords = (a: EmailContent, b: EmailContent) =>
  EMAIL_FIELDS.every((field) => a[field] === b[field]);

const WIDTHS = { desktop: "100%", phone: "375px" } as const;
type PreviewWidth = keyof typeof WIDTHS;

// The rendered email in a frame that grows to its height. Same-origin (to
// measure it) but no scripts: the email has none, and none may run.
const EmailFrame = ({ html, width }: { html: string; width: PreviewWidth }) => {
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(640);

  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (doc) {
      setHeight(doc.documentElement.scrollHeight);
    }
  };

  return (
    <div className="bg-muted/40 flex justify-center rounded-md border p-2">
      <iframe
        ref={frame}
        title="Email preview"
        sandbox="allow-same-origin"
        srcDoc={html}
        onLoad={measure}
        style={{ height, width: WIDTHS[width] }}
        className="max-w-full rounded-sm bg-white transition-[width] duration-200"
      />
    </div>
  );
};

export const EmailEditor = ({
  adminEmail,
  id,
  saved,
}: {
  adminEmail: string;
  id: EmailId;
  // The edited words, or null when the email sends its defaults.
  saved: EmailContent | null;
}) => {
  const template = getEmailTemplate(id);
  const baseline = saved ?? template.defaults;
  const [content, setContent] = useState<EmailContent>(baseline);
  const [width, setWidth] = useState<PreviewWidth>("desktop");
  const [resetOpen, setResetOpen] = useState(false);
  const { pending, run } = useAdminAction();
  const fields = useRef<
    Partial<Record<EmailField, HTMLInputElement | HTMLTextAreaElement>>
  >({});
  const lastField = useRef<EmailField>("intro");

  const dirty = !sameWords(content, baseline);
  const problems = emailProblems(template, content);
  const deferred = useDeferredValue(content);
  const email = useMemo(
    () => renderEmail(template, deferred, sampleValues(template)),
    [template, deferred]
  );
  const buttonTarget = template.variables.find(
    (variable) => variable.key === template.buttonHref
  );

  // Unsaved words: ask before leaving the page.
  useEffect(() => {
    if (!dirty) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setField = (field: EmailField, value: string) =>
    setContent((current) => ({ ...current, [field]: value }));

  // Puts {{key}} at the cursor of the field last typed in (the intro if
  // none yet), then puts the cursor after it.
  const insertVariable = (key: string) => {
    const field = lastField.current;
    const element = fields.current[field];
    const value = content[field];
    const token = `{{${key}}}`;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    // Rendered at once, so the cursor is placed before the next keystroke.
    flushSync(() =>
      setField(field, value.slice(0, start) + token + value.slice(end))
    );
    const caret = start + token.length;
    element?.focus();
    element?.setSelectionRange(caret, caret);
  };

  const save = () => run(() => saveEmail({ content, id }));
  const sendTest = () => run(() => sendEmailTest({ content, id }));
  const reset = () =>
    run(
      () => resetEmail({ id }),
      () => setResetOpen(false)
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-background/90 z-30 -mx-1 flex flex-wrap items-center gap-2 px-1 py-2 backdrop-blur lg:sticky lg:top-14">
        <p
          className={cn(
            "mr-auto text-sm",
            problems.length > 0 ? "text-destructive" : "text-muted-foreground"
          )}
          aria-live="polite"
        >
          {problems[0] ??
            (dirty
              ? "Unsaved changes."
              : `Tests go to ${adminEmail}, with sample values.`)}
        </p>
        {saved && (
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" disabled={pending}>
                Reset to default
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reset to the default words?</DialogTitle>
                <DialogDescription>
                  Your edited words are deleted, and the next{" "}
                  {template.name.toLowerCase()} sent uses the default words from
                  code again.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={reset}
                >
                  Reset
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
        {dirty && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => setContent(baseline)}
          >
            Discard changes
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          disabled={pending || problems.length > 0}
          onClick={sendTest}
        >
          Send test
        </Button>
        <Button
          size="sm"
          disabled={pending || !dirty || problems.length > 0}
          onClick={save}
        >
          Save
        </Button>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Values</span>
            <div className="flex flex-wrap gap-1.5">
              {template.variables.map((variable) => (
                <Button
                  key={variable.key}
                  type="button"
                  size="sm"
                  variant="secondary"
                  title={`${variable.label}, e.g. ${variable.sample}`}
                  className="h-7 px-2 font-mono text-xs"
                  // Keep the cursor in the field being edited.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => insertVariable(variable.key)}
                >
                  {`{{${variable.key}}}`}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Click one to add it where the cursor is. A blank line starts a new
              paragraph · **bold** · [label](https://…)
            </p>
          </div>

          {FIELDS.map(({ field, hint, label, multiline }) => {
            const inputId = `email-${field}`;
            const common = {
              id: inputId,
              onChange: (
                event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
              ) => setField(field, event.target.value),
              onFocus: () => {
                lastField.current = field;
              },
              value: content[field],
            };
            const fieldHint =
              field === "button" && buttonTarget
                ? `Always links to {{${buttonTarget.key}}}, the ${buttonTarget.label.toLowerCase()}.`
                : hint;
            return (
              <div key={field} className="grid gap-2">
                <Label htmlFor={inputId}>{label}</Label>
                {multiline ? (
                  <Textarea
                    {...common}
                    ref={(element) => {
                      fields.current[field] = element ?? undefined;
                    }}
                    className="min-h-24"
                  />
                ) : (
                  <Input
                    {...common}
                    ref={(element) => {
                      fields.current[field] = element ?? undefined;
                    }}
                  />
                )}
                {fieldHint && (
                  <p className="text-muted-foreground text-xs">{fieldHint}</p>
                )}
              </div>
            );
          })}
        </div>

        <Tabs defaultValue="preview" className="gap-3 lg:sticky lg:top-28">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
              <TabsTrigger value="text">Plain text</TabsTrigger>
            </TabsList>
            <ToggleGroup
              size="sm"
              variant="outline"
              value={[width]}
              onValueChange={([value = ""]) => {
                if (value) {
                  setWidth(value as PreviewWidth);
                }
              }}
              aria-label="Preview width"
            >
              <ToggleGroupItem value="desktop">Desktop</ToggleGroupItem>
              <ToggleGroupItem value="phone">Phone</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Card className="gap-1 px-4 py-3 text-sm">
            <p className="truncate">
              <span className="text-muted-foreground">From </span>
              {template.from}
              {template.replyTo && (
                <span className="text-muted-foreground">
                  {" "}
                  · replies to {template.replyTo}
                </span>
              )}
            </p>
            <p className="truncate font-medium">{email.subject || "—"}</p>
            <p className="text-muted-foreground truncate">
              {email.preheader ||
                "No inbox preview: inboxes show the email's first words."}
            </p>
          </Card>

          <TabsContent value="preview">
            <EmailFrame html={email.html} width={width} />
          </TabsContent>
          <TabsContent value="html">
            <pre className="bg-muted/40 max-h-[70vh] overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
              {email.html}
            </pre>
          </TabsContent>
          <TabsContent value="text">
            <pre className="bg-muted/40 max-h-[70vh] overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {email.text}
            </pre>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};
