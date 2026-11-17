"use client";

import * as React from "react";

import type { FocusReport, StopsReport } from "@/lib/preview-keyboard";
import {
  KEYBOARD_MESSAGE,
  describeStop,
  findTabStops,
} from "@/lib/preview-keyboard";

// Inside a live item's preview iframe (app/preview/[name]/page.tsx): with
// Keyboard mode on, a number on each Tab stop in Tab order, and a report to
// the docs page each time focus moves (lib/preview-keyboard.ts). The layer
// takes no pointer events and is hidden from screen readers. It adds no
// focus ring of its own: the item's own focus indicator is what's being
// checked.

interface Badge {
  flagged: boolean;
  index: number;
  x: number;
  y: number;
}

// Items animate and reflow, so the numbers follow them on a short beat.
const REFRESH_MS = 200;
const BADGE = 20;

const post = (message: object) => {
  if (window.parent !== window) {
    window.parent.postMessage(message, window.location.origin);
  }
};

export const PreviewKeyboardInspector = () => {
  const [on, setOn] = React.useState(false);
  const [badges, setBadges] = React.useState<Badge[]>([]);
  const [focused, setFocused] = React.useState(0);
  const stopsRef = React.useRef<HTMLElement[]>([]);
  const lastSummary = React.useRef("");

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== window.parent
      ) {
        return;
      }
      if (event.data?.type === KEYBOARD_MESSAGE.mode) {
        setOn(Boolean(event.data.on));
      }
      if (event.data?.type === KEYBOARD_MESSAGE.start) {
        stopsRef.current[0]?.focus({ focusVisible: true } as FocusOptions);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  React.useEffect(() => {
    if (!on) {
      setBadges([]);
      lastSummary.current = "";
      return;
    }

    const refresh = () => {
      const stops = findTabStops();
      stopsRef.current = stops;
      const infos = stops.map(describeStop);
      setBadges(
        stops.map((element, index) => {
          const rect = element.getBoundingClientRect();
          return {
            flagged: infos[index].issues.length > 0,
            index: index + 1,
            x: rect.left + window.scrollX,
            y: rect.top + window.scrollY,
          };
        })
      );
      const summary: StopsReport = {
        flagged: infos.filter((info) => info.issues.length > 0).length,
        total: stops.length,
      };
      const key = `${summary.total}:${summary.flagged}`;
      if (key !== lastSummary.current) {
        lastSummary.current = key;
        post({ ...summary, type: KEYBOARD_MESSAGE.stops });
      }
    };

    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }
      refresh();
      const index = stopsRef.current.indexOf(event.target) + 1;
      setFocused(index);
      const report: FocusReport = {
        ...describeStop(event.target),
        index,
        total: stopsRef.current.length,
      };
      post({ ...report, type: KEYBOARD_MESSAGE.focus });
    };

    // Tab past the last stop moves focus out to the docs page.
    const onLeave = () => {
      setFocused(0);
      post({ type: KEYBOARD_MESSAGE.left });
    };

    refresh();
    const timer = window.setInterval(refresh, REFRESH_MS);
    document.addEventListener("focusin", onFocus);
    window.addEventListener("blur", onLeave);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("focusin", onFocus);
      window.removeEventListener("blur", onLeave);
    };
  }, [on]);

  if (!on) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      style={{
        inset: 0,
        pointerEvents: "none",
        position: "absolute",
        zIndex: 2_147_483_647,
      }}
    >
      {badges.map((badge) => {
        const current = badge.index === focused;
        let background = "#111111";
        if (current) {
          background = "#2563eb";
        } else if (badge.flagged) {
          background = "#dc2626";
        }
        return (
          <span
            key={badge.index}
            style={{
              alignItems: "center",
              background,
              borderRadius: BADGE,
              boxShadow: "0 0 0 2px #ffffff",
              color: "#ffffff",
              display: "flex",
              font: `600 11px/1 ui-sans-serif, system-ui, sans-serif`,
              height: BADGE,
              justifyContent: "center",
              left: Math.max(0, badge.x - BADGE / 2),
              minWidth: BADGE,
              padding: "0 5px",
              position: "absolute",
              top: Math.max(0, badge.y - BADGE / 2),
            }}
          >
            {badge.index}
          </span>
        );
      })}
    </div>
  );
};
