"use client";

import { useCallback, useSyncExternalStore } from "react";

import type { PreviewMotion } from "@/lib/preview-motion";
import { isPreviewMotion } from "@/lib/preview-motion";

// The docs preview's reduced-motion switch (lib/preview-motion.ts). By
// default a preview follows the visitor's own setting; the switch overrides
// it, for every preview on the page at once, and is remembered in this
// browser so it stays on while they browse.
//
//   reduced: what the previews show now (the override, else the system)
//   motion:  the override to put in the iframe's address, or null to leave
//            the visitor's own setting in charge

const STORAGE_KEY = "craftui:preview-motion";
const QUERY = "(prefers-reduced-motion: reduce)";

const listeners = new Set<() => void>();
let override: PreviewMotion | null | undefined;

const readOverride = () => {
  if (override === undefined) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      override = isPreviewMotion(saved) ? saved : null;
    } catch {
      override = null;
    }
  }
  return override;
};

const writeOverride = (next: PreviewMotion | null) => {
  override = next;
  try {
    if (next) {
      localStorage.setItem(STORAGE_KEY, next);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
  for (const listener of listeners) {
    listener();
  }
};

const subscribeOverride = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const subscribeSystem = (listener: () => void) => {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};

export const usePreviewMotion = () => {
  const system = useSyncExternalStore(
    subscribeSystem,
    () => window.matchMedia(QUERY).matches,
    () => false
  );
  const motion = useSyncExternalStore(
    subscribeOverride,
    readOverride,
    () => null
  );
  const reduced = motion ? motion === "reduce" : system;

  // Flip what's shown. When that lands back on the visitor's own setting,
  // drop the override, so the preview follows their system again.
  const toggle = useCallback(() => {
    const wantReduced = !reduced;
    if (wantReduced === system) {
      writeOverride(null);
      return;
    }
    writeOverride(wantReduced ? "reduce" : "full");
  }, [reduced, system]);

  return { motion, reduced, toggle };
};
