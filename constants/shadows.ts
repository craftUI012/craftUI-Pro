// Shadow tokens registered in globals.css `@theme inline` as `--shadow-*`.
// Listed here so tailwind-merge treats `shadow-<token>` as a box shadow.
export const SHADOW_TOKENS = [
  "border",
  "border-hover",
  "elevated",
  "floating",
  "card",
  "card-hover",
  "button-primary",
  "button-primary-hover",
  "button-secondary",
  "button-secondary-hover",
] as const;
