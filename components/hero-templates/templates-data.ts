// Template options in the showcase, in picker order; the first is shown by
// default. Each renders on
// /template-preview/<slug> (see app/template-preview) from the component in
// sections/index.ts, and is shown inside the device mockups through an
// iframe so its own breakpoints apply.
export const TEMPLATES = [
  { label: "Features section", slug: "features" },
  { label: "Hero section", slug: "hero" },
  { label: "My team section", slug: "team" },
] as const;

export type TemplateSlug = (typeof TEMPLATES)[number]["slug"];

// Devices to preview on. `viewport` is the CSS size of the device's screen
// (the real device's), scaled to fit the stage; `statusBar` is the part of it
// the system status bar takes (the page starts below it, as on the device).
// `bezel`, `radius` and `screenRadius` are drawn sizes on the stage (px).
export const DEVICES = [
  {
    bezel: 12,
    id: "desktop",
    label: "Desktop",
    radius: 20,
    screenRadius: 8,
    statusBar: 0,
    viewport: { height: 900, width: 1440 },
  },
  {
    bezel: 16,
    id: "tablet",
    label: "Tablet",
    radius: 38,
    screenRadius: 22,
    statusBar: 24,
    viewport: { height: 1194, width: 834 },
  },
  {
    bezel: 11,
    id: "mobile",
    label: "Mobile",
    radius: 52,
    screenRadius: 42,
    statusBar: 47,
    viewport: { height: 844, width: 390 },
  },
] as const;

export type DeviceId = (typeof DEVICES)[number]["id"];

// The monitor's stand under the desktop (px on the stage).
export const STAND = { baseHeight: 10, height: 84, neckWidth: 0.14 } as const;

/* ─────────────────────────────────────────────────────────
 * DEVICE SWITCH STORYBOARD
 *
 *    0ms   screen fades out                        screenOut, ease-out
 *  150ms   device reshapes to the new one          morph spring
 *          (size, corners, bezel; stand, notch and camera fade in/out)
 *          page reflows at the new width, unseen
 *  ~650ms  screen fades back in                    screenIn, ease-out
 *
 * With reduced motion the device swaps at once and only the screen fades.
 * ───────────────────────────────────────────────────────── */
export const DEVICE_MOTION = {
  // Device details (stand, notch, camera) coming and going.
  detail: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
  morph: { bounce: 0.08, duration: 0.55, type: "spring" },
  screenIn: { duration: 0.25, ease: [0.23, 1, 0.32, 1] },
  screenOut: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
} as const;
