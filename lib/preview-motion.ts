// Reduced motion in the docs preview: the toolbar's switch
// (components/preview-toolbar.tsx) reloads a live item's iframe with
// ?motion=reduce (or ?motion=full), and the preview page
// (app/preview/[name]/page.tsx) runs PREVIEW_MOTION_SCRIPT before the item's
// own code. Inside that iframe only, the script makes the reduced-motion
// setting read as asked:
//
//   - window.matchMedia: a query with prefers-reduced-motion is answered as
//     if the setting were on (or off). Motion's useReducedMotion and the
//     items' own matchMedia checks go through it.
//   - CSS: @media rules on prefers-reduced-motion (plain CSS and Tailwind's
//     motion-reduce: / motion-safe:, nested ones too) are rewritten to always
//     or never apply, in every same-origin stylesheet, now and as more load.
//
// So the item runs its real reduced-motion code, the same a visitor with
// the setting on gets. Nothing an item ships changes: this lives only in
// the preview route.

export const MOTION_PARAM = "motion";
export type PreviewMotion = "full" | "reduce";

export const isPreviewMotion = (value: unknown): value is PreviewMotion =>
  value === "reduce" || value === "full";

// Runs in the iframe, serialised into an inline script, so it must stand
// alone: no imports, no closures over this module.
const previewMotionShim = () => {
  const mode = new URLSearchParams(window.location.search).get("motion");
  if (mode !== "reduce" && mode !== "full") {
    return;
  }
  const reduce = mode === "reduce";
  document.documentElement.dataset.previewMotion = mode;

  // A condition that's always true, and one that's never true.
  const ALWAYS = "(min-width: 0px)";
  const NEVER = "(min-width: 999999px)";
  const HAS = /prefers-reduced-motion/i;
  // "(prefers-reduced-motion)" on its own means reduce.
  const FEATURE =
    /\(\s*prefers-reduced-motion\s*(?::\s*(reduce|no-preference)\s*)?\)/gi;
  const rewrite = (query: string) =>
    query.replace(FEATURE, (_match, value?: string) =>
      (value?.toLowerCase() !== "no-preference") === reduce ? ALWAYS : NEVER
    );

  const nativeMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (query: string) =>
    nativeMatchMedia(HAS.test(query) ? rewrite(query) : query);

  const fixRules = (rules: CSSRuleList) => {
    for (const rule of rules) {
      const { media } = rule as CSSRule & { media?: MediaList };
      if (media && HAS.test(media.mediaText)) {
        media.mediaText = rewrite(media.mediaText);
      }
      const nested = (rule as CSSRule & { cssRules?: CSSRuleList }).cssRules;
      if (nested) {
        fixRules(nested);
      }
      const imported = (rule as CSSRule & { styleSheet?: CSSStyleSheet })
        .styleSheet;
      if (imported) {
        try {
          fixRules(imported.cssRules);
        } catch {
          // Another origin's sheet: its rules can't be read.
        }
      }
    }
  };
  const sweep = () => {
    for (const sheet of document.styleSheets) {
      try {
        fixRules(sheet.cssRules);
      } catch {
        // Another origin's sheet (a web font's CSS): nothing to change.
      }
    }
  };

  // Stylesheets before this script have loaded (scripts wait for them).
  // Later ones: <link>s on load, and <style> tags (and changes to their
  // text) as they come. Other DOM changes, which an animated item makes
  // constantly, are ignored.
  sweep();
  new MutationObserver((mutations) => {
    let changed = false;
    for (const mutation of mutations) {
      if (mutation.target instanceof HTMLStyleElement) {
        changed = true;
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLLinkElement && node.rel === "stylesheet") {
          node.addEventListener("load", sweep);
        } else if (node instanceof HTMLStyleElement) {
          changed = true;
        }
      }
    }
    if (changed) {
      sweep();
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", sweep);
  window.addEventListener("load", sweep);
};

export const PREVIEW_MOTION_SCRIPT = `(${previewMotionShim.toString()})();`;

// The address of a live item's preview with the motion setting asked for,
// or as it is (the visitor's own setting) without one.
export const previewSrcWithMotion = (
  src: string,
  motion: PreviewMotion | null
) => (motion ? `${src}?${MOTION_PARAM}=${motion}` : src);
