"use client";

import { useEffect, useState } from "react";

import BloomMenu from "@/registry/components/bloom-menu";

// The menu where it lives: the top bar of a quiet app window, on a muted
// canvas. It opens once by itself shortly after load, so the bloom plays
// without a click; after that it's yours to open and close.
const OPEN_AFTER_MS = 900;

const Bar = ({ className }: { className?: string }) => (
  <span className={`block h-2 rounded-full bg-muted ${className ?? ""}`} />
);

const BloomMenuPreview = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setOpen(true), OPEN_AFTER_MS);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="bg-muted px-4 py-10 sm:px-10 sm:py-14">
      <div className="mx-auto max-w-3xl rounded-xl border bg-background shadow-sm">
        <header className="flex h-14 items-center gap-6 border-b px-4 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="size-5 rounded-md bg-foreground" />
            <span className="text-sm font-semibold">Acme</span>
          </div>
          <nav className="hidden items-center gap-1 text-sm text-muted-foreground sm:flex">
            <span className="rounded-md bg-accent px-2.5 py-1 font-medium text-foreground">
              Overview
            </span>
            <span className="px-2.5 py-1">Projects</span>
            <span className="px-2.5 py-1">Reports</span>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden h-8 w-48 items-center rounded-lg border px-3 text-xs text-muted-foreground md:flex">
              Search…
            </span>
            <BloomMenu onOpenChange={setOpen} open={open} />
          </div>
        </header>

        <div aria-hidden="true" className="space-y-6 p-5 sm:p-6">
          <div className="space-y-2">
            <span className="block text-lg font-semibold">Overview</span>
            <Bar className="w-48" />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {["Revenue", "Customers", "Churn"].map((title) => (
              <div className="space-y-3 rounded-lg border p-4" key={title}>
                <span className="block text-xs text-muted-foreground">
                  {title}
                </span>
                <Bar className="h-3 w-16 bg-foreground/15" />
              </div>
            ))}
          </div>
          <div className="flex h-40 items-end gap-2 rounded-lg border p-4">
            {[40, 55, 35, 70, 60, 85, 50, 75, 65, 90, 80, 95].map((h, i) => (
              <span
                className="flex-1 rounded-sm bg-muted"
                // oxlint-disable-next-line react/no-array-index-key -- static decorative bars
                key={i}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BloomMenuPreview;
