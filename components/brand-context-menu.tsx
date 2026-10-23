"use client";

import { DownloadIcon } from "lucide-react";
import { useCallback } from "react";
import { toast } from "sonner";

import { LOGO_MARK_SVG, LogoMark } from "@/components/logo";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";

export const BrandContextMenu = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { copyToClipboard } = useCopyToClipboard();

  const handleCopy = useCallback(() => {
    copyToClipboard(LOGO_MARK_SVG);
    toast.success("Icon as SVG copied");
  }, [copyToClipboard]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([LOGO_MARK_SVG], {
      type: "image/svg+xml;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "craftui-pro-logo.svg";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Icon as SVG downloaded");
  }, []);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={handleCopy}>
          <LogoMark />
          Copy as SVG
        </ContextMenuItem>

        <ContextMenuItem onClick={handleDownload}>
          <DownloadIcon /> Download as SVG
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
