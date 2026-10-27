"use client";

import * as React from "react";

import { PREVIEW_SIZE_MESSAGE } from "@/constants/live-previews";

// Inside a preview iframe: posts the content's height to the docs page
// whenever it changes, so the box around the iframe fits it exactly. It
// measures this wrapper, not the document: a document is never shorter
// than its iframe, so it could grow but never shrink back. flow-root keeps
// the first and last children's margins inside the measurement.
export const PreviewSizeReporter = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const node = ref.current;

    if (!node || window.parent === window) {
      return;
    }

    const report = () =>
      window.parent.postMessage(
        {
          height: Math.ceil(node.getBoundingClientRect().height),
          type: PREVIEW_SIZE_MESSAGE,
        },
        window.location.origin
      );
    const observer = new ResizeObserver(report);
    observer.observe(node);
    report();

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flow-root" ref={ref}>
      {children}
    </div>
  );
};
