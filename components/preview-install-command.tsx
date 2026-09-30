"use client";

import { CheckIcon, ChevronDownIcon } from "lucide-react";

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

export const commandFor = (manager: PackageManager, name: string) => {
  const args = `shadcn@latest add ${SITE.URL}/r/${name}.json`;

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
// manager. Brand-coloured (variant="default", same fill as the header's "Get
// started" button) so it reads as the primary action on the toolbar, each
// button its own shadowed pill with a real gap between them.
export const PreviewInstallCommand = ({
  className,
  name,
}: {
  className?: string;
  name: string;
}) => {
  const [manager, setManager] = usePackageManager();
  const command = commandFor(manager, name);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <CopyButton
        className="h-7 max-w-56 justify-start gap-2 pr-2 pl-2.5 font-mono text-xs"
        showTooltip={false}
        sound="copy"
        value={command}
        variant="default"
      >
        {getIconForPackageManager(manager)}
        <span className="truncate">{command}</span>
      </CopyButton>
      <DropdownMenu sounds>
        <DropdownMenuTrigger asChild>
          <Button className="size-7" size="icon" variant="default">
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
