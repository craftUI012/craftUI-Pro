"use client";

import { Download04Icon, Video01Icon } from "@hugeicons/core-free-icons";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  renderStatus,
  renderVideo,
} from "@/app/admin-panel-craft/studio/actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import type { RenderJob } from "@/lib/studio/render-jobs";
import type { VideoSpec } from "@/reels/spec";

// Render a planned storyboard to MP4 on this machine, watch it here and
// download it. Dev only: the render films this dev server's live preview.

const POLL_MS = 1500;

const seconds = (job: RenderJob, now: number) =>
  Math.round(((job.finishedAt ?? now) - job.startedAt) / 1000);

export const StudioRender = ({ spec }: { spec: VideoSpec }) => {
  const name = `${spec.item}-${spec.type}`;
  const [job, setJob] = useState<RenderJob | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [starting, startStarting] = useTransition();

  const running = job?.status === "running";

  // Poll while the render runs; the clock ticks the elapsed time between polls.
  useEffect(() => {
    if (!running) {
      return;
    }
    const timer = setInterval(async () => {
      setNow(Date.now());
      const answer = await renderStatus(name);
      if ("job" in answer && answer.job) {
        setJob(answer.job);
        if (answer.job.status === "done") {
          toast.success("Video rendered.");
        }
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [name, running]);

  const render = () => {
    startStarting(async () => {
      const answer = await renderVideo(spec);
      if ("error" in answer) {
        toast.error(answer.error);
        return;
      }
      setNow(Date.now());
      setJob(answer.job);
    });
  };

  const src =
    job?.status === "done"
      ? `/admin-panel-craft/studio/video/${name}?v=${job.finishedAt}`
      : null;
  let label = "Render video";
  if (starting) {
    label = "Starting…";
  } else if (running) {
    label = "Rendering…";
  } else if (job) {
    label = "Render again";
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Video</span>
          <span className="text-muted-foreground text-xs">
            Saves the storyboard to <code>reels/specs/{name}.json</code>, films
            the live shots on this machine and renders a 1080×1920 MP4. A render
            takes a few minutes.
          </span>
        </div>
        <Button onClick={render} disabled={starting || running}>
          <Icon icon={Video01Icon} />
          {label}
        </Button>
      </div>

      {job && running && (
        <p className="text-muted-foreground text-sm">
          <span className="tabular-nums">{seconds(job, now)}s</span> ·{" "}
          {((job.current ?? "").trim() || job.log.at(-1))?.replace(
            /^video: /,
            ""
          ) ?? "Starting the recorder…"}
        </p>
      )}

      {job?.status === "failed" && (
        <div className="flex flex-col gap-2">
          <p className="text-destructive text-sm">{job.error}</p>
          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 text-xs leading-relaxed">
            {job.log.join("\n")}
          </pre>
        </div>
      )}

      {src && job && (
        <div className="flex flex-wrap items-end gap-4">
          {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- silent preview of our own render */}
          <video
            src={src}
            controls
            playsInline
            className="bg-muted aspect-[9/16] h-[28rem] rounded-md"
          />
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-xs">
              Rendered in{" "}
              <span className="tabular-nums">{seconds(job, now)}s</span> ·
              reels/out/{name}.mp4
            </span>
            <Button asChild variant="outline">
              <a href={`${src}&download=1`} download={`craftui-${name}.mp4`}>
                <Icon icon={Download04Icon} />
                Download MP4
              </a>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
