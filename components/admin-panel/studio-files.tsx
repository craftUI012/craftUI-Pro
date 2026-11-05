"use client";

import {
  Delete02Icon,
  Download04Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { clearMediaFolder } from "@/app/admin-panel-craft/studio/actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { MediaFolderInfo } from "@/lib/studio/local-media";

// Local video files (dev only): benchmark downloads and renders pile up in
// git-ignored folders, so each can be emptied here once it's been used.

const formatBytes = (bytes: number) => {
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const CONFIRM_MS = 4000;

const FolderRow = ({
  folder,
  onCleared,
}: {
  folder: MediaFolderInfo;
  onCleared: (folders: MediaFolderInfo[]) => void;
}) => {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  // The confirm step times out, so a stray second click later never deletes.
  useEffect(() => {
    if (!confirming) {
      return;
    }
    const timer = setTimeout(() => setConfirming(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [confirming]);

  const clear = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setConfirming(false);
    startTransition(async () => {
      const answer = await clearMediaFolder(folder.id);
      if ("error" in answer) {
        toast.error(answer.error);
        return;
      }
      onCleared(answer.folders);
      toast.success(`Deleted ${folder.label.toLowerCase()}.`);
    });
  };

  const empty = folder.files === 0;
  let buttonLabel = "Delete";
  if (pending) {
    buttonLabel = "Deleting…";
  } else if (confirming) {
    buttonLabel = "Click again to delete";
  }

  return (
    <div className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-sm font-medium">{folder.label}</span>
          <span className="text-muted-foreground truncate text-xs">
            <code>{folder.dir}</code> ·{" "}
            <span className="tabular-nums">
              {empty
                ? "empty"
                : `${folder.files} ${folder.files === 1 ? "file" : "files"}, ${formatBytes(folder.bytes)}`}
            </span>
          </span>
        </div>
        <Button
          size="sm"
          variant={confirming ? "destructive" : "outline"}
          onClick={clear}
          disabled={empty || pending}
        >
          <Icon icon={Delete02Icon} />
          {buttonLabel}
        </Button>
      </div>
      {folder.videos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {folder.videos.map((video) => (
            <li
              key={video.name}
              className="bg-muted/40 flex items-center justify-between gap-3 rounded-md px-3 py-2"
            >
              <span className="min-w-0 truncate text-sm">
                {video.name}.mp4{" "}
                <span className="text-muted-foreground tabular-nums text-xs">
                  {formatBytes(video.bytes)}
                </span>
              </span>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm" variant="ghost">
                  <a
                    href={`/admin-panel-craft/studio/video/${video.name}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Icon icon={PlayIcon} />
                    Watch
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a
                    href={`/admin-panel-craft/studio/video/${video.name}?download=1`}
                    download={`craftui-${video.name}.mp4`}
                  >
                    <Icon icon={Download04Icon} />
                    Download
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export const StudioFiles = ({
  folders: initial,
}: {
  folders: MediaFolderInfo[];
}) => {
  const [folders, setFolders] = useState(initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Local video files</CardTitle>
        <CardDescription>
          Benchmark downloads and renders stay on this machine until you delete
          them. Benchmark notes and scores live in the video-director skill and
          are kept.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-border flex flex-col divide-y">
        {folders.map((folder) => (
          <FolderRow key={folder.id} folder={folder} onCleared={setFolders} />
        ))}
      </CardContent>
    </Card>
  );
};
