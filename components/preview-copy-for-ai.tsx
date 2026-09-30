"use client";

import { ChevronDownIcon, Lock } from "lucide-react";
import { useCallback } from "react";

import { CopyButton } from "@/components/copy-button";
import { MENU_ITEMS } from "@/components/docs-copy-page";
import { commandFor } from "@/components/preview-install-command";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePackageManager } from "@/hooks/use-package-manager";

// The Open in v0 / Cursor / ChatGPT / … links from Copy Page. "View as
// Markdown" is left out: a card has no .md page of its own.
const AI_MENU_ITEMS = MENU_ITEMS.filter(([key]) => key !== "markdown");

// What "Copy for AI" puts on the clipboard: a Markdown brief an assistant can
// work from — the component's name, its install command and its full source.
const toAiBrief = ({
  code,
  install,
  title,
}: {
  code: string;
  install?: string;
  title: string;
}) =>
  [
    `# ${title}`,
    install && `Install:\n\n\`\`\`bash\n${install}\n\`\`\``,
    `Source:\n\n\`\`\`tsx\n${code.trimEnd()}\n\`\`\``,
  ]
    .filter(Boolean)
    .join("\n\n");

const BUTTON_CLS = "h-7 gap-2 px-2.5 text-xs";

// "Copy for AI" on a preview card's toolbar: Copy Page's split button
// (docs-copy-page.tsx) — copy on the left, the AI links in a dropdown on the
// right — in the install command's brand colour. Pro items (`locked`) keep
// both halves behind the paywall: each one opens the Code view instead,
// which shows the Paywall.
export const PreviewCopyForAi = ({
  code,
  installName,
  locked,
  onLocked,
  title,
  url,
}: {
  code?: string | null;
  installName?: string;
  locked: boolean;
  onLocked: () => void;
  title: string;
  url: string;
}) => {
  const [manager] = usePackageManager();
  const getBrief = useCallback(
    () =>
      toAiBrief({
        code: code ?? "",
        install: installName ? commandFor(manager, installName) : undefined,
        title,
      }),
    [code, installName, manager, title]
  );

  if (locked) {
    return (
      <div className="flex items-center gap-1.5">
        <Button
          className={BUTTON_CLS}
          onClick={onLocked}
          size="sm"
          type="button"
          variant="default"
        >
          <Lock className="size-3.5" />
          Copy for AI
        </Button>
        <Button
          className="size-7"
          onClick={onLocked}
          size="icon"
          type="button"
          variant="default"
        >
          <Lock className="size-3.5" />
          <span className="sr-only">Open in an AI tool (Pro)</span>
        </Button>
      </div>
    );
  }

  if (!code) {
    return null;
  }

  return (
    <div className="flex items-center gap-1.5">
      <CopyButton
        className={BUTTON_CLS}
        showTooltip={false}
        sound="copy"
        value={getBrief}
        variant="default"
      >
        Copy for AI
      </CopyButton>
      {url && (
        <DropdownMenu sounds>
          <DropdownMenuTrigger asChild>
            <Button className="size-7" size="icon" variant="default">
              <ChevronDownIcon className="size-3.5" />
              <span className="sr-only">Open in an AI tool</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-lg">
            {AI_MENU_ITEMS.map(([key, render]) => (
              <DropdownMenuItem asChild key={key} sound="click">
                {render(url)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};
