import { ROUTES } from "@/constants/routes";
import { getCardScreenshot } from "@/lib/media";

// An item's browse-card screenshot as a JPEG, for AI agents: the cards use
// AVIF from R2, which models can't read as an image input. Served by
// app/llms.md/preview/[file]/route.ts; the fingerprint in the name changes
// with every new screenshot, so a file can be cached for good.

export const PREVIEW_IMAGE_FILE = /^([a-z0-9-]+)\.([0-9a-f]{8})\.jpg$/;

/** The JPEG's path for a registry item, when it has a screenshot. */
export const previewImagePath = (item: string) => {
  const shot = getCardScreenshot(item);
  return shot
    ? `${ROUTES.LLMS_MD}/preview/${item}.${shot.fingerprint}.jpg`
    : undefined;
};
