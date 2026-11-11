"use client";

import { Cancel01Icon, RecordIcon, StopIcon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

import type { ComponentTheme } from "./reel-components";
import { useFrameSetup } from "./reel-components";

// Recording a live component into a clip, in the Studio itself.
//
// The component is shown flat and upright at its real size (the phone's
// 390x844 viewport, scaled down only if the window is short), so the
// recording is sharp and independent of the phone's tilt: the Studio maps
// it into the phone afterwards, like any clip.
//
// Chrome's tab capture (getDisplayMedia, "this tab") is narrowed to just
// that element: Element Capture (restrictTo) where the browser has it,
// Region Capture (cropTo) otherwise. The timer and buttons sit outside the
// element, so they're never recorded. Tab capture has no cursor, so taps
// show as soft dots inside the recorded element.

const VIEWPORT = { height: 844, width: 390 };

const wait = (ms: number) =>
  // oxlint-disable-next-line promise/avoid-new -- timers have no promise API here
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
const COUNTDOWN = 3;
/** ms between clearing the countdown and starting the recorder. */
const START_DELAY = 200;
/** Room kept around the element for the title and controls, px. */
const CHROME = 160;
const TAP = { duration: 650, size: 46 };

// Element and Region Capture aren't in TypeScript's DOM types yet.
interface CaptureTargetStatic {
  fromElement: (element: Element) => Promise<unknown>;
}
type CapturableTrack = MediaStreamTrack & {
  cropTo?: (target: unknown) => Promise<void>;
  restrictTo?: (target: unknown) => Promise<void>;
};
const captureTargets = () => {
  const scope = globalThis as unknown as {
    CropTarget?: CaptureTargetStatic;
    RestrictionTarget?: CaptureTargetStatic;
  };
  return { crop: scope.CropTarget, restrict: scope.RestrictionTarget };
};

export const canRecordElements = () => {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) {
    return false;
  }
  const { crop, restrict } = captureTargets();
  return (
    "getDisplayMedia" in navigator.mediaDevices &&
    Boolean(crop || restrict) &&
    typeof MediaRecorder !== "undefined"
  );
};

// MP4 (H.264) where MediaRecorder can write it, WebM otherwise; both read
// back in the Studio.
const pickFormat = () =>
  [
    { ext: "mp4", type: "video/mp4;codecs=avc1.640033" },
    { ext: "mp4", type: "video/mp4" },
    { ext: "webm", type: "video/webm;codecs=vp9" },
    { ext: "webm", type: "video/webm" },
  ].find((format) => MediaRecorder.isTypeSupported(format.type)) ?? {
    ext: "webm",
    type: "",
  };

/** A tab capture narrowed to `element`, recording until `stop()`. */
const startCapture = async (element: HTMLElement) => {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    audio: false,
    // Chrome-only options: offer this tab first, and allow capturing it.
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    // The tab at its own resolution (no upscaling), as smooth as it goes.
    video: { frameRate: { ideal: 60 } },
  } as DisplayMediaStreamOptions);
  const [track] = stream.getVideoTracks() as CapturableTrack[];
  const { crop, restrict } = captureTargets();
  try {
    if (restrict && track.restrictTo) {
      await track.restrictTo(await restrict.fromElement(element));
    } else if (crop && track.cropTo) {
      await track.cropTo(await crop.fromElement(element));
    } else {
      throw new Error("This browser can't record a single element.");
    }
  } catch (error) {
    for (const each of stream.getTracks()) {
      each.stop();
    }
    throw error;
  }
  return { stream, track };
};

const record = (stream: MediaStream) => {
  const format = pickFormat();
  const recorder = new MediaRecorder(stream, {
    mimeType: format.type || undefined,
    videoBitsPerSecond: 12_000_000,
  });
  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  });
  recorder.start(250);
  const stop = () =>
    // oxlint-disable-next-line promise/avoid-new -- MediaRecorder signals the end with an event
    new Promise<Blob>((resolve) => {
      recorder.addEventListener(
        "stop",
        () => resolve(new Blob(chunks, { type: recorder.mimeType })),
        { once: true }
      );
      recorder.stop();
      for (const track of stream.getTracks()) {
        track.stop();
      }
    });
  return { ext: format.ext, stop };
};

/**
 * Soft dots where the pointer goes down inside the component's frame.
 * `enabled` is read on every tap, so the switch works mid-recording.
 */
const useTapDots = (
  frame: React.RefObject<HTMLIFrameElement | null>,
  layer: React.RefObject<HTMLDivElement | null>,
  enabled: boolean
) => {
  const on = useRef(enabled);
  on.current = enabled;
  return useCallback(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) {
      return;
    }
    doc.addEventListener("pointerdown", (event) => {
      const host = layer.current;
      if (!(host && on.current)) {
        return;
      }
      const dot = document.createElement("span");
      Object.assign(dot.style, {
        // A dark disc with a light ring and a hairline outline: reads on
        // light and dark components alike.
        background: "rgba(20, 20, 20, 0.28)",
        border: "2px solid rgba(255, 255, 255, 0.9)",
        borderRadius: "9999px",
        boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.18)",
        height: `${TAP.size}px`,
        left: `${event.clientX - TAP.size / 2}px`,
        pointerEvents: "none",
        position: "absolute",
        top: `${event.clientY - TAP.size / 2}px`,
        width: `${TAP.size}px`,
      });
      host.append(dot);
      dot
        .animate(
          // Grow in, hold a moment at full strength, then fade.
          [
            { opacity: 1, transform: "scale(0.6)" },
            { offset: 0.35, opacity: 1, transform: "scale(1)" },
            { opacity: 0, transform: "scale(1.12)" },
          ],
          { duration: TAP.duration, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }
        )
        .addEventListener("finish", () => dot.remove());
    });
  }, [frame, layer]);
};

type Phase =
  | { kind: "ready" }
  | { kind: "counting"; left: number }
  | { kind: "starting" }
  | { kind: "recording"; since: number }
  | { kind: "saving" };

const useFitScale = () => {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () =>
      setScale(Math.min(1, (window.innerHeight - CHROME) / VIEWPORT.height));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return scale;
};

const useElapsed = (phase: Phase) => {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (phase.kind !== "recording") {
      return;
    }
    const timer = setInterval(() => setNow(performance.now()), 250);
    return () => clearInterval(timer);
  }, [phase]);
  if (phase.kind !== "recording") {
    return "0:00";
  }
  const seconds = Math.max(0, Math.floor((now - phase.since) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * The record view: the component flat at its real size, Start (Chrome asks
 * to share the tab), a countdown, then recording until Stop or Esc.
 * `onDone` gets the recording as a file; `onClose` leaves without one.
 */
export const RecordView = ({
  name,
  onClose,
  onDone,
  theme,
  title,
}: {
  name: string;
  onClose: () => void;
  onDone: (file: File) => void;
  theme: ComponentTheme;
  title: string;
}) => {
  const target = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const dots = useRef<HTMLDivElement>(null);
  const session = useRef<{ stop: () => Promise<Blob>; ext: string } | null>(
    null
  );
  const [phase, setPhase] = useState<Phase>({ kind: "ready" });
  const [problem, setProblem] = useState<string | null>(null);
  const [taps, setTaps] = useState(true);
  const scale = useFitScale();
  const elapsed = useElapsed(phase);
  const setupFrame = useFrameSetup(iframe, theme);
  const listenTaps = useTapDots(iframe, dots, taps);

  const stop = async () => {
    const { current } = session;
    if (!current) {
      return;
    }
    session.current = null;
    setPhase({ kind: "saving" });
    const blob = await current.stop();
    const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "");
    onDone(
      new File([blob], `${name}-${stamp}.${current.ext}`, { type: blob.type })
    );
  };

  const start = async () => {
    const element = target.current;
    if (!element) {
      return;
    }
    setProblem(null);
    try {
      const { stream, track } = await startCapture(element);
      track.addEventListener("ended", () => session.current && stop());
      for (let left = COUNTDOWN; left > 0; left -= 1) {
        setPhase({ kind: "counting", left });
        // oxlint-disable-next-line no-await-in-loop -- a countdown waits on purpose
        await wait(1000);
      }
      // Clear the countdown, let the page paint without it, then record:
      // starting in the same instant left its last number in frame one.
      setPhase({ kind: "starting" });
      await wait(START_DELAY);
      session.current = record(stream);
      setPhase({ kind: "recording", since: performance.now() });
    } catch (error) {
      setPhase({ kind: "ready" });
      if (
        !(error instanceof DOMException && error.name === "NotAllowedError")
      ) {
        setProblem(error instanceof Error ? error.message : String(error));
      }
    }
  };

  // Esc stops a recording, or closes the view when nothing's running.
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (session.current) {
        stopRef.current();
      } else if (phase.kind === "ready") {
        onClose();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose, phase.kind]);

  const counting = phase.kind === "counting";
  const recording = phase.kind === "recording";

  return createPortal(
    <div
      aria-label={`Record ${title}`}
      aria-modal="true"
      className="bg-background/95 fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 p-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn(
            "size-2.5 rounded-full",
            recording ? "animate-pulse bg-red-500" : "bg-muted-foreground/40"
          )}
        />
        <p className="text-sm font-medium">
          {recording ? `Recording ${title}` : `Record ${title}`}
        </p>
        <span className="text-muted-foreground text-sm tabular-nums">
          {elapsed}
        </span>
      </div>

      {/* The recorded element: exactly the component, nothing else. */}
      {/* The border is on this wrapper, outside the recorded element, so it
          never shows as a hairline in the recording. */}
      <div className="rounded-[3px] border">
        <div
          className="relative overflow-hidden"
          ref={target}
          style={{
            height: VIEWPORT.height * scale,
            isolation: "isolate",
            width: VIEWPORT.width * scale,
          }}
        >
          <div
            className="absolute top-0 left-0 origin-top-left"
            style={{
              height: VIEWPORT.height,
              transform: `scale(${scale})`,
              width: VIEWPORT.width,
            }}
          >
            <iframe
              className="bg-background size-full border-0"
              onLoad={() => {
                setupFrame();
                listenTaps();
              }}
              ref={iframe}
              src={`/preview/${name}`}
              title={`${title}, live`}
            />
            <div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              ref={dots}
            />
          </div>
          {counting ? (
            <div className="bg-background/40 absolute inset-0 flex items-center justify-center backdrop-blur-[2px]">
              <span className="text-7xl font-semibold tabular-nums">
                {phase.left}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex min-h-9 items-center gap-3">
        {phase.kind === "ready" ? (
          <>
            <Button onClick={start} type="button">
              <Icon icon={RecordIcon} />
              Start recording
            </Button>
            <div className="flex items-center gap-2">
              <Switch
                checked={taps}
                id="record-taps"
                onCheckedChange={setTaps}
              />
              <label className="text-xs" htmlFor="record-taps">
                Show taps
              </label>
            </div>
            <Button onClick={onClose} type="button" variant="ghost">
              <Icon icon={Cancel01Icon} />
              Close
            </Button>
          </>
        ) : null}
        {recording ? (
          <Button onClick={stop} type="button" variant="destructive">
            <Icon icon={StopIcon} />
            Stop
          </Button>
        ) : null}
        {counting ? (
          <p className="text-muted-foreground text-sm">Get ready…</p>
        ) : null}
        {phase.kind === "saving" ? (
          <p className="text-muted-foreground text-sm">Saving…</p>
        ) : null}
      </div>
      <p className="text-muted-foreground max-w-sm text-center text-xs">
        {problem ??
          "Chrome asks to share this tab: only the component is recorded. Stop or Esc ends it, and the recording goes into the phone."}
      </p>
    </div>,
    document.body
  );
};
