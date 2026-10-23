// Browse-card screenshots on Cloudflare R2. Shared by lib/media.ts (the site)
// and scripts/media.mjs (`pnpm media`), so both always agree on the files.

// The widths each screenshot is resized to. The card's image is 300–535 CSS
// px wide across every layout (browse-card-parts.tsx PREVIEW_SIZES); at 1–3× pixel
// density nothing needs more than ~1000px (a phone at 430px, 3×, asks for
// ~1050 and gets 1000, which is indistinguishable).
export const MEDIA_WIDTHS = [480, 640, 800, 1000] as const;

// Every card image is cropped to the card's 16:10 frame, keeping the top.
export const MEDIA_ASPECT = { height: 10, width: 16 } as const;
