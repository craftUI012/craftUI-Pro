"use client";

import { useRouter } from "next/navigation";
import { addTransitionType, startTransition } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { useFeedback } from "@/hooks/use-feedback";
import { trackEvent } from "@/lib/events";

// Something on the page already used this key (an illustration being
// turned, a tab list, a slider) and said so by preventing its default.
// Then the arrow is not a request to change page.
const HOTKEY_OPTIONS = {
  ignoreEventWhen: (event: KeyboardEvent) => event.defaultPrevented,
  preventDefault: true,
};

export const DocsKeyboardShortcuts = ({
  previous,
  next,
}: {
  previous: string | null;
  next: string | null;
}) => {
  const router = useRouter();
  const playClick = useFeedback({ sound: "click" });

  const navigate = (
    href: string | null,
    direction: "previous" | "next",
    keys: string
  ) => {
    if (href) {
      playClick();
      trackEvent({
        name: "keyboard_shortcut_navigate",
        properties: { direction, keys, path: href },
      });
      startTransition(() => {
        addTransitionType(direction === "next" ? "nav-forward" : "nav-back");
        router.push(href);
      });
    }
  };

  useHotkeys(
    "ArrowRight",
    () => {
      navigate(next, "next", "ArrowRight");
    },
    HOTKEY_OPTIONS
  );

  useHotkeys(
    "ArrowLeft",
    () => {
      navigate(previous, "previous", "ArrowLeft");
    },
    HOTKEY_OPTIONS
  );

  return null;
};
