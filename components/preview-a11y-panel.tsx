"use client";

import { Keyboard, Turtle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Kbd } from "@/components/ui/kbd";
import { TYPE } from "@/constants/typography";
import type { ItemA11y } from "@/lib/item-a11y";
import { cn } from "@/lib/utils";

// The preview box's Accessibility view (components/preview-frame.tsx): an
// item's meta.a11y (lib/item-a11y.ts) as a card over the preview, like the
// Code view. What reduced motion changes, the keys it answers to, how it
// names and announces itself, and what's still missing. Each claim can be
// checked right there: the buttons switch the preview to reduced motion or
// to Keyboard mode and go back to it.

const Section = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) => (
  <section className="flex flex-col gap-2">
    <h3 className={cn(TYPE.cardCaption, "text-muted-foreground font-medium")}>
      {title}
    </h3>
    {children}
  </section>
);

// The notes mark code with backticks (`headingLevel`): shown as code.
const Prose = ({ text }: { text: string }) => (
  <>
    {text.split("`").map((part, index) =>
      index % 2 === 1 ? (
        <code
          className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]"
          // The text is fixed per item, so its position is a stable key.
          // oxlint-disable-next-line react/no-array-index-key
          key={index}
        >
          {part}
        </code>
      ) : (
        part
      )
    )}
  </>
);

const List = ({ items }: { items: string[] }) => (
  <ul className={cn(TYPE.cardBody, "flex list-disc flex-col gap-1.5 pl-5")}>
    {items.map((item) => (
      <li key={item}>
        <Prose text={item} />
      </li>
    ))}
  </ul>
);

export const PreviewA11yPanel = ({
  a11y,
  onKeyboard,
  onReducedMotion,
  reduced,
  title,
}: {
  a11y: ItemA11y;
  // Show the preview in Keyboard mode.
  onKeyboard: () => void;
  // Show the preview with reduced motion on (or off again).
  onReducedMotion: () => void;
  reduced: boolean;
  title?: string;
}) => (
  <div className="flex min-h-full items-start justify-center p-4 sm:p-6">
    <Card className="shadow-elevated w-full max-w-2xl gap-6 border-0 py-6">
      <CardHeader className="gap-1.5">
        <h2 className={cn(TYPE.headingPanel, "text-foreground")}>
          Accessibility{title ? ` · ${title}` : ""}
        </h2>
        <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
          How it behaves for people using reduced motion, a keyboard or a screen
          reader. Check each point in the preview.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Section title="Reduced motion">
          <p className={TYPE.cardBody}>
            <Prose text={a11y.reducedMotion} />
          </p>
          <Button
            className="w-fit"
            onClick={onReducedMotion}
            size="sm"
            type="button"
            variant="outline"
          >
            <Turtle />
            {reduced ? "Back to full motion" : "See it with reduced motion"}
          </Button>
        </Section>

        <Section title="Keyboard">
          {a11y.keyboard.length > 0 ? (
            <table className={cn(TYPE.cardBody, "w-full border-collapse")}>
              <thead className="sr-only">
                <tr>
                  <th scope="col">Keys</th>
                  <th scope="col">What they do</th>
                </tr>
              </thead>
              <tbody>
                {a11y.keyboard.map(({ action, keys }) => (
                  <tr className="border-b last:border-b-0" key={keys + action}>
                    <td className="py-2 pr-4 align-top whitespace-nowrap">
                      {/* "Enter / Space": either key; "Shift+Tab": one
                          combination, on one key cap. */}
                      <span className="flex items-center gap-1">
                        {keys.split(" / ").map((key, index) => (
                          <span className="flex items-center gap-1" key={key}>
                            {index > 0 ? (
                              <span className="text-muted-foreground text-xs">
                                or
                              </span>
                            ) : null}
                            <Kbd>{key}</Kbd>
                          </span>
                        ))}
                      </span>
                    </td>
                    <td className="py-2 align-top">
                      <Prose text={action} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
              Nothing in it takes keyboard focus.
            </p>
          )}
          <Button
            className="w-fit"
            onClick={onKeyboard}
            size="sm"
            type="button"
            variant="outline"
          >
            <Keyboard />
            Try it in Keyboard mode
          </Button>
        </Section>

        {a11y.notes.length > 0 ? (
          <Section title="Screen readers">
            <List items={a11y.notes} />
          </Section>
        ) : null}

        <Section title="Known gaps">
          {a11y.gaps.length > 0 ? (
            <List items={a11y.gaps} />
          ) : (
            <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
              None we know of.
            </p>
          )}
        </Section>
      </CardContent>
    </Card>
  </div>
);
