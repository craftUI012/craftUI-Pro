import { LIVE_PREVIEWS } from "@/constants/live-previews";
import { LIBRARIES } from "@/constants/taxonomy";
import registry from "@/registry.json";

import type { StudioComponent } from "./reel-components";

// The live components a device's screen can show: every registry item with
// a live preview page (/preview/<name>), grouped by library. Built on the
// server so the Studio doesn't ship the whole registry to the browser.
export const studioComponents = (): StudioComponent[] =>
  LIVE_PREVIEWS.flatMap((name) => {
    const item = registry.items.find((entry) => entry.name === name);
    if (!item) {
      return [];
    }
    const library = item.meta?.library as keyof typeof LIBRARIES | undefined;
    return [
      {
        library: (library && LIBRARIES[library]?.label) || "Other",
        name,
        title: item.title,
      },
    ];
  }).toSorted(
    (a, b) =>
      a.library.localeCompare(b.library) || a.title.localeCompare(b.title)
  );
