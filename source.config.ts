import {
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from "fumadocs-mdx/config";
import { rehypePrettyCode } from "rehype-pretty-code";
import { z } from "zod";

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

// Extra frontmatter for /docs pages:
//   hideHeader  hide the page's title and description (the preview's own
//               heading leads instead). The title stays as a visually hidden
//               h1 for screen readers and search; the description still
//               feeds the meta tags.
const docsFrontmatter = frontmatterSchema.extend({
  hideHeader: z.boolean().optional(),
});

export const docs = defineDocs({
  dir: DOCS_DIR,
  docs: {
    files: ["**/*.mdx", ...HIDDEN_DOCS.map((path) => `!${path}`)],
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: docsFrontmatter,
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
