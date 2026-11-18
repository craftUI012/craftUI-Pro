"use client";

import { useState } from "react";

import { Switch } from "@/components/ui/switch";
import { ArchiveBox } from "@/registry/isometric/archive-box";

// The bento's "motion you control" toggle on /skills/isometrics, with a
// real library object.

const ART_ONLY = { actionLabel: "", description: "", heading: "" } as const;

/** The bento's big tile: a switch that sets `active`, and the code it sets. */
export const MotionDemo = () => {
  const [active, setActive] = useState(false);
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <ArchiveBox
        {...ART_ONLY}
        active={active}
        artClassName="w-56 md:w-64"
        title="An archive box whose pages pop out when active turns on"
      />
      <div className="bg-surface dark:bg-background flex w-full max-w-md items-center justify-between gap-4 rounded-xl px-4 py-3">
        <code className="font-mono text-sm">
          {"<ArchiveBox active={"}
          <span className="text-brand-text font-semibold">
            {String(active)}
          </span>
          {"} />"}
        </code>
        <Switch
          aria-label="Set active"
          checked={active}
          onCheckedChange={setActive}
        />
      </div>
    </div>
  );
};
