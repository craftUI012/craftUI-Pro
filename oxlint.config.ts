import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, next, vitest],
  ignorePatterns: [
    "public/r/**",
    ".agents/**",
    ".cursor/**",
    ".changeset/**",
    ".claude/**",
    ".web-kits/**",
    "audio/**",
  ],
  rules: {
    // Base UI composes by `render`: <Button render={<a href="…" />}>Label</Button>.
    // The <a> gets the button's children at runtime, so the rule sees an
    // empty link that isn't one. Accessible names are still checked on the
    // rendered page (Accessibility view, axe).
    "jsx-a11y/anchor-has-content": "off",
  },
});
