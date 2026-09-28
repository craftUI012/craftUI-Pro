// "Why craftUI Pro": what separates these components from a plain kit,
// grouped by the qualities in the make-interfaces-feel-better principles
// (keyboard access, interaction, theming, screen sizes, surface detail).
// `title` states the business outcome; `points` are the concrete details
// behind it. Every point is checked against the components in
// components/ui and the tokens in globals.css; don't add one that isn't.
export const FEATURES = [
  {
    description:
      "Every control works by keyboard, touch and screen reader, so fewer people get stuck and your accessibility review starts from a solid base.",
    id: "accessibility",
    label: "Accessibility",
    points: [
      "A visible focus ring, and arrow keys and Escape that work as expected",
      "Buttons that shrink slightly on press, with padding balanced around icons",
      "Small buttons still get a 40px tap target",
    ],
    title: "Works by keyboard, touch and screen reader",
    // Shown together as a bento inside the visual (see AccessibilityVisual).
    visuals: [
      { id: "tab", label: "Tab order" },
      { id: "press", label: "Press" },
      { id: "hit", label: "Hit area" },
      { id: "optical", label: "Optical padding" },
    ],
  },
  {
    description:
      "Hover, press and open states ease in instead of snapping, so the product feels considered from the first click.",
    id: "interaction",
    label: "Interaction",
    points: [
      "One tuned easing curve across menus, dialogs, switches and presses",
      "Menus that grow out of the control that opened them",
      "Hover shadows that ease between matched layers",
    ],
    title: "Motion tuned on one curve",
    // Default ease-out against craftUI's curve, side by side (see
    // InteractionVisual).
    visuals: [
      { id: "menu", label: "Menu opening" },
      { id: "switch", label: "Switch" },
      { id: "toast", label: "Toast" },
      { id: "curves", label: "The two curves" },
    ],
  },
  {
    description:
      "Every color is a token with its own light and dark value. Change your brand color once and every component follows.",
    id: "theme",
    label: "Themes",
    points: [
      "Brand color set in one place",
      "Shadows retuned for dark backgrounds, not inverted",
      "Follows each person's system theme",
    ],
    title: "Light and dark from one set of tokens",
  },
  {
    description:
      "Type and spacing adapt from phone to desktop through tokens, so nothing needs fixing screen by screen.",
    id: "device",
    label: "Screens",
    points: [
      "Type sizes set for small, medium and large screens",
      "Spacing on one rhythm at every width",
      "Layouts that step from three columns down to one",
    ],
    title: "Type and spacing sized for each screen",
  },
  {
    description:
      "The small details that make an interface look expensive come built in, so you don't need a designer checking every screen.",
    id: "detail",
    label: "Details",
    points: [
      "Soft layered shadows instead of hard borders",
      "Numbers that hold their place as they update",
      "One type scale with a named role for every text",
    ],
    title: "Shadows, numbers and type, already tuned",
  },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];

/* ─────────────────────────────────────────────────────────
 * VISUAL SWITCH STORYBOARD
 *
 *   select   old visual fades out, 4px down      exit, 0.15s ease-out
 *            new visual fades in from 0.98,       spring 0.35s, no bounce
 *            blur 4px → 0
 *   loop     each visual's own motion runs while it's shown (see
 *            feature-visuals.tsx); still frames with reduced motion
 * ───────────────────────────────────────────────────────── */
export const FEATURE_MOTION = {
  enter: { bounce: 0, duration: 0.35, type: "spring" },
  exit: { duration: 0.15, ease: [0.23, 1, 0.32, 1] },
} as const;
