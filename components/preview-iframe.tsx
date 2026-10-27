"use client";

import * as React from "react";

import { DEVICES } from "@/components/hero-templates/templates-data";
import type { PreviewWidth } from "@/components/preview-toolbar";
import { Skeleton } from "@/components/ui/skeleton";
import { PREVIEW_SIZE_MESSAGE } from "@/constants/live-previews";

// A live item in an iframe at a real device width: the item's own window is
// that wide, so its breakpoints switch exactly as on the device. The widths
// are the landing page's devices (templates-data.ts): 390 phone, 834 tablet,
// 1440 desktop (or the whole box, if wider). When the box is narrower than
// the device, the page is scaled down to fit rather than reflowed: a desktop
// preview always shows the desktop layout, just smaller. The page reports
// its height (components/preview-size-reporter.tsx), so the box fits it.

const DEVICE_WIDTH = Object.fromEntries(
  DEVICES.map((device) => [device.id, device.viewport.width])
) as Record<PreviewWidth, number>;

// Until the page has reported its height.
const FALLBACK_HEIGHT = 640;

// The width the item lays out at. Tablet and desktop keep their real width
// and scale down to fit; a phone narrower than its box (a visitor on a
// phone) lays out at the box's width instead, which is still the phone
// layout, at a size that can be read.
const deviceWidth = (width: PreviewWidth, available: number) => {
  if (width === "desktop") {
    return Math.max(DEVICE_WIDTH.desktop, available);
  }
  if (width === "mobile" && available > 0) {
    return Math.min(DEVICE_WIDTH.mobile, available);
  }
  return DEVICE_WIDTH[width];
};

export const PreviewIframe = ({
  src,
  title,
  width,
}: {
  src: string;
  title?: string;
  width: PreviewWidth;
}) => {
  const outer = React.useRef<HTMLDivElement>(null);
  const frame = React.useRef<HTMLIFrameElement>(null);
  // The box's inner width; 0 until measured, and the iframe waits for it so
  // it never loads at the wrong size.
  const [available, setAvailable] = React.useState(0);
  const [height, setHeight] = React.useState<number | null>(null);

  React.useLayoutEffect(() => {
    const node = outer.current;

    if (!node) {
      return;
    }

    const measure = () => setAvailable(node.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin === window.location.origin &&
        event.source === frame.current?.contentWindow &&
        event.data?.type === PREVIEW_SIZE_MESSAGE &&
        typeof event.data.height === "number"
      ) {
        setHeight(event.data.height);
      }
    };
    window.addEventListener("message", onMessage);

    return () => window.removeEventListener("message", onMessage);
  }, []);

  const device = deviceWidth(width, available);
  const scale = available > 0 ? Math.min(1, available / device) : 1;
  const shown = height ?? FALLBACK_HEIGHT;
  const label = `${title ?? "Component"} preview`;

  return (
    <div className="w-full" ref={outer}>
      <div
        className="relative mx-auto overflow-hidden transition-[width,height] duration-300 ease-out"
        style={
          available > 0
            ? { height: shown * scale, width: device * scale }
            : { height: FALLBACK_HEIGHT, width: "100%" }
        }
      >
        {available > 0 ? (
          <iframe
            className="absolute top-0 left-0 origin-top-left border-0"
            loading="lazy"
            ref={frame}
            src={src}
            style={{
              height: shown,
              transform: `scale(${scale})`,
              width: device,
            }}
            title={label}
          />
        ) : null}
        {height === null ? (
          <Skeleton className="absolute inset-0 rounded-none" />
        ) : null}
      </div>
    </div>
  );
};
