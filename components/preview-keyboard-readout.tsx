"use client";

import { Button } from "@/components/ui/button";
import type { FocusReport, StopsReport } from "@/lib/preview-keyboard";

// Under a live preview while Keyboard mode is on (components/preview-frame.tsx):
// how many Tab stops the item has and how many need attention, then, as
// focus moves, the focused stop's number, role, accessible name and state,
// and any issue with the WCAG criterion it breaks.
//
// Not a live region: screen-reader users already hear each focus change
// from the item itself, and announcing this too would say everything twice.

const StopLine = ({ focus }: { focus: FocusReport }) => (
  <div className="flex min-w-0 flex-col gap-1.5">
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      <span className="text-muted-foreground tabular-nums">
        {focus.index > 0
          ? `Stop ${focus.index} of ${focus.total}`
          : "Focused by script, not a Tab stop"}
      </span>
      <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
        {focus.role}
      </span>
      {focus.name ? (
        <span className="font-medium">“{focus.name}”</span>
      ) : (
        <span className="text-destructive font-medium">no name</span>
      )}
      {focus.states.length > 0 ? (
        <span className="text-muted-foreground">
          {focus.states.join(" · ")}
        </span>
      ) : null}
    </p>
    {focus.issues.length > 0 ? (
      <ul className="flex flex-col gap-1">
        {focus.issues.map((issue) => (
          <li className="text-destructive text-xs" key={issue.text}>
            {issue.text}{" "}
            <span className="text-muted-foreground">
              (WCAG {issue.criterion})
            </span>
          </li>
        ))}
      </ul>
    ) : null}
  </div>
);

const summaryText = (stops: StopsReport | null) => {
  if (!stops) {
    return "Finding the Tab stops…";
  }
  if (stops.total === 0) {
    return "Nothing in this preview takes keyboard focus.";
  }
  const count = `${stops.total} Tab ${stops.total === 1 ? "stop" : "stops"}`;
  const flagged =
    stops.flagged > 0
      ? `, ${stops.flagged} ${stops.flagged === 1 ? "needs" : "need"} attention (in red)`
      : ", none flagged";
  return `${count}${flagged}. Click into the preview and press Tab, or start at the first stop.`;
};

export const PreviewKeyboardReadout = ({
  focus,
  left,
  onStart,
  stops,
}: {
  focus: FocusReport | null;
  // Focus went past the last stop, out of the preview.
  left: boolean;
  onStart: () => void;
  stops: StopsReport | null;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-t px-4 py-3 text-sm">
    {focus ? (
      <StopLine focus={focus} />
    ) : (
      <p className="text-muted-foreground">
        {left ? "Focus has left the preview. " : null}
        {summaryText(stops)}
      </p>
    )}
    {stops && stops.total > 0 ? (
      <Button onClick={onStart} size="sm" type="button" variant="outline">
        {focus ? "Back to the first stop" : "Start at the first stop"}
      </Button>
    ) : null}
  </div>
);
