import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from "fumadocs-mdx/config";
import { rehypePrettyCode } from "rehype-pretty-code";

import { DOCS_ADMIN_DIR, DOCS_DIR } from "@/lib/docs";
import { transformers } from "@/lib/highlight-code";

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (plugins) => {
      plugins.shift();
      plugins.push([
        rehypePrettyCode,
        {
          theme: {
            dark: "github-dark",
            light: "github-light-default",
          },
          transformers,
        },
      ]);

      return plugins;
    },
  },
});

// Docs pages kept in the repo but not published: no route, no sitemap entry,
// no menu item. Remove a line to bring its page back (and re-add it to its
// folder's meta.json).
const HIDDEN_DOCS = [
  // Placeholder from the registry template, not a real component.
  "components/your-component.mdx",
];

export const docs = defineDocs({
  dir: DOCS_DIR,
  docs: {
    files: ["**/*.mdx", ...HIDDEN_DOCS.map((path) => `!${path}`)],
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: frontmatterSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

// Internal, dev-only handbook served at /docs-admin (see lib/flags.ts).
export const docsAdmin = defineDocs({
  dir: DOCS_ADMIN_DIR,
  docs: {
    schema: frontmatterSchema,
  },
  meta: {
    schema: metaSchema,
  },
});
