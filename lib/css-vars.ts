// Shared by the server reader (lib/css-tokens.ts) and client views of its
// output, so it must stay free of server-only imports.

export interface CssTokenSource {
  // Values from the top-level `:root` blocks (light theme and shared tokens).
  root: Record<string, string>;
  // Values the top-level `.dark` block overrides.
  dark: Record<string, string>;
}

// Names a value points at through var(--name).
export const varReferences = (value: string) =>
  [...value.matchAll(/var\(--([\w-]+)/g)].flatMap(([, name]) =>
    name ? [name] : []
  );
