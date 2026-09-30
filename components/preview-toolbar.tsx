"use client";

import {
  Code2,
  Eye,
  Maximize,
  Monitor,
  RotateCw,
  Smartphone,
  Tablet,
} from "lucide-react";
import type { ComponentType } from "react";
import { useEffect, useState } from "react";

import { DocsShareMenu } from "@/components/docs-share-menu";
import { PreviewCopyForAi } from "@/components/preview-copy-for-ai";
import { PreviewInstallCommand } from "@/components/preview-install-command";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type PreviewWidth = "desktop" | "mobile" | "tablet";
export type PreviewView = "code" | "preview";

// One toolbar icon button: same shape as ModeSwitcher's "Toggle mode" button
// (ghost, size-8, group/toggle) and the exact same tooltip (bg-primary pill +
// Kbd shortcut) — except the Kbd letter is forced white here instead of
// following the tooltip's usual `text-background`.
const ToolbarButton = ({
  label,
  shortcut,
  active,
  onClick,
  children,
}: {
  label: string;
  shortcut: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        aria-pressed={active}
        className={cn(
          "group/toggle extend-touch-target size-8",
          active && "bg-accent text-accent-foreground"
        )}
        onClick={onClick}
        size="icon"
        type="button"
        variant="ghost"
      >
        {children}
        <span className="sr-only">{label}</span>
      </Button>
    </TooltipTrigger>
    <TooltipContent className="pr-2 pl-3">
      <div className="flex items-center gap-3">
        {label}
        <Kbd className="!text-white">{shortcut}</Kbd>
      </div>
    </TooltipContent>
  </Tooltip>
);

const WIDTH_BUTTONS: {
  Icon: ComponentType<{ className?: string; strokeWidth?: string }>;
  id: PreviewWidth;
  label: string;
  shortcut: string;
}[] = [
  {
    Icon: Smartphone,
    id: "mobile",
    label: "Preview at mobile width",
    shortcut: "M",
  },
  {
    Icon: Tablet,
    id: "tablet",
    label: "Preview at tablet width",
    shortcut: "T",
  },
  {
    Icon: Monitor,
    id: "desktop",
    label: "Preview at desktop width",
    shortcut: "D",
  },
];

const VIEW_BUTTONS: {
  Icon: ComponentType<{ className?: string }>;
  id: PreviewView;
  label: string;
}[] = [
  { Icon: Eye, id: "preview", label: "Preview" },
  { Icon: Code2, id: "code", label: "Code" },
];

// The Preview/Code segmented switch: one bg-secondary + shadow-button-secondary
// pill (same family as PreviewInstallCommand next to it), with the active
// side lifted on a bg-background chip.
const ViewToggle = ({
  onViewChange,
  view,
}: {
  onViewChange: (view: PreviewView) => void;
  view: PreviewView;
}) => (
  <div className="bg-secondary shadow-button-secondary flex items-center gap-0.5 rounded-lg p-0.5">
    {VIEW_BUTTONS.map(({ id, label, Icon }) => (
      <Button
        className={cn(
          "h-6 gap-1.5 px-2 text-xs",
          view === id
            ? "bg-background text-foreground shadow-xs"
            : "text-muted-foreground bg-transparent shadow-none hover:bg-transparent"
        )}
        key={id}
        onClick={() => onViewChange(id)}
        size="sm"
        type="button"
        variant="ghost"
      >
        <Icon className="size-3.5" />
        {label}
      </Button>
    ))}
  </div>
);

// This card's own link: the page URL plus #<installName> (the box's id, see
// preview-frame.tsx). Read after mount, since the server doesn't know the
// page's URL; empty until then.
const useCardUrl = (id?: string) => {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const { origin, pathname } = window.location;
    setUrl(`${origin}${pathname}${id ? `#${id}` : ""}`);
  }, [id]);
  return url;
};

// The strip pinned to the top of a preview box (see preview-frame.tsx): the
// Preview/Code toggle and the install command on the left; device width,
// reload, full screen, share and "Copy for AI" on the right.
export const PreviewToolbar = ({
  className,
  copyValue,
  installName,
  locked = false,
  onFullscreen,
  onLockedCopy,
  onReload,
  onViewChange,
  onWidthChange,
  showViewToggle,
  title,
  view,
  width,
}: {
  className?: string;
  copyValue?: string | null;
  installName?: string;
  locked?: boolean;
  onFullscreen: () => void;
  onLockedCopy: () => void;
  onReload: () => void;
  onViewChange: (view: PreviewView) => void;
  onWidthChange: (width: PreviewWidth) => void;
  showViewToggle: boolean;
  title?: string;
  view: PreviewView;
  width: PreviewWidth;
}) => {
  const cardUrl = useCardUrl(installName);
  const hasCopy = locked || Boolean(copyValue);

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 border-b px-2 py-1.5",
        className
      )}
    >
      <div className="flex items-center gap-1.5">
        {showViewToggle && (
          <ViewToggle onViewChange={onViewChange} view={view} />
        )}
        {installName && <PreviewInstallCommand name={installName} />}
      </div>

      <div className="flex items-center gap-0.5">
        {WIDTH_BUTTONS.map(({ id, label, Icon, shortcut }) => (
          <ToolbarButton
            active={width === id}
            key={id}
            label={label}
            onClick={() => onWidthChange(id)}
            shortcut={shortcut}
          >
            <Icon className="size-4.5" strokeWidth="2" />
          </ToolbarButton>
        ))}
        <Separator className="mx-1 h-4!" orientation="vertical" />
        <ToolbarButton label="Reload preview" onClick={onReload} shortcut="R">
          <RotateCw className="size-4.5" strokeWidth="2" />
        </ToolbarButton>
        <ToolbarButton label="Full screen" onClick={onFullscreen} shortcut="F">
          <Maximize className="size-4.5" strokeWidth="2" />
        </ToolbarButton>
        {(cardUrl || hasCopy) && (
          <Separator className="mx-1 h-4!" orientation="vertical" />
        )}
        <div className="flex items-center gap-1.5">
          {cardUrl && (
            <DocsShareMenu title={title ?? "Component"} url={cardUrl} />
          )}
          <PreviewCopyForAi
            code={copyValue}
            installName={installName}
            locked={locked}
            onLocked={onLockedCopy}
            title={title ?? "Component"}
            url={cardUrl}
          />
        </div>
      </div>
    </div>
  );
};
