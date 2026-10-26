"use client";

import { CheckIcon, ChevronDownIcon, Lock } from "lucide-react";

import { CopyButton } from "@/components/copy-button";
import { getIconForPackageManager } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SITE } from "@/constants/site";
import type { PackageManager } from "@/hooks/use-package-manager";
import { usePackageManager } from "@/hooks/use-package-manager";
import { cn } from "@/lib/utils";

const PACKAGE_MANAGERS: PackageManager[] = ["npm", "pnpm", "yarn", "bun"];

// `token` is a paid item's install token for its owner (/api/access); the
// registry route refuses paid items without it.
export const commandFor = (
  manager: PackageManager,
  name: string,
  token?: string | null
) => {
  const url = `${SITE.URL}/r/${name}.json${token ? `?t=${token}` : ""}`;
  const args = `shadcn@latest add ${url}`;

  switch (manager) {
    case "yarn": {
      return `yarn dlx ${args}`;
    }
    case "pnpm": {
      return `pnpm dlx ${args}`;
    }
    case "bun": {
      return `bunx --bun ${args}`;
    }
    default: {
      return `npx ${args}`;
    }
  }
};

// The compact install command shown on the preview toolbar's right side:
// package-manager icon + truncated command + copy, and a dropdown to switch
// manager. Secondary (the same bg-secondary + shadow-button-secondary family
// as the Preview/Code switch), so the toolbar stays quiet beside the preview;
// each button its own pill with a real gap between them. A `locked` (paid,
// not owned) item shows the command with a lock: clicking it calls
// `onLocked`, which opens the Code view's plans, and nothing is copied.
export const PreviewInstallCommand = ({
  className,
  locked = false,
  name,
  onLocked,
  token,
}: {
  className?: string;
  locked?: boolean;
  name: string;
  onLocked?: () => void;
  token?: string | null;
}) => {
  const [manager, setManager] = usePackageManager();
  // The visible text never shows the token; only the copied command has it.
  const command = commandFor(manager, name);
  const commandToCopy = commandFor(manager, name, token);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {/* The page's main install action: copying it is the clearest sign
          someone is about to install this item. */}
      {locked ? (
        <Button
          className="h-7 max-w-56 justify-start gap-2 pr-2 pl-2.5 font-mono text-xs"
          onClick={onLocked}
          size="sm"
          type="button"
          variant="secondary"
        >
          <Lock className="size-3.5" />
          <span className="truncate">{command}</span>
          <span className="sr-only">(needs a plan)</span>
        </Button>
      ) : (
        <CopyButton
          className="h-7 max-w-56 justify-start gap-2 pr-2 pl-2.5 font-mono text-xs"
          event="copy_npm_command"
          eventProperties={{ item: name, manager }}
          showTooltip={false}
          sound="copy"
          value={commandToCopy}
          variant="secondary"
        >
          {getIconForPackageManager(manager)}
          <span className="truncate">{command}</span>
        </CopyButton>
      )}
      <DropdownMenu sounds>
        <DropdownMenuTrigger asChild>
          <Button className="size-7" size="icon" variant="secondary">
            <ChevronDownIcon className="size-3.5" />
            <span className="sr-only">Choose package manager</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {PACKAGE_MANAGERS.map((item) => (
            <DropdownMenuItem
              className="justify-between gap-4"
              key={item}
              onClick={() => setManager(item)}
              sound="click"
            >
              <span className="flex items-center gap-2">
                {getIconForPackageManager(item)}
                {item}
              </span>
              {item === manager && <CheckIcon className="size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
