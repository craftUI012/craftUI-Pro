import { SITE } from "@/constants/site";

// Pieces every email template shares (lib/emails/*.ts).

// Email clients fetch images from the open internet, so the logo must come
// from the live site even when the email is sent from localhost.
const LIVE_ORIGIN = "https://www.craftui.space";
export const assetOrigin = SITE.URL.startsWith("https://")
  ? SITE.URL
  : LIVE_ORIGIN;
export const LOGO_URL = `${assetOrigin}/logo/logo-mark-256.png`;

export const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen-Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif";

// Anything from outside (links, addresses, names) goes into HTML escaped (a
// link's `&` must be `&amp;` inside href).
export const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
