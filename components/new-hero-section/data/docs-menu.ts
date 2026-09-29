import type { Node as PageTreeNode } from "fumadocs-core/page-tree";

import { ROUTES } from "@/constants/routes";
import { EXCLUDED_SECTIONS, isComponentsFolder } from "@/lib/docs";
import { getAllPagesFromFolder, getPagesFromFolder } from "@/lib/page-tree";
import { source } from "@/lib/source";

// The /docs sidebar's menu, rebuilt for the /homepage-new shell: same
// sections and groups as components/docs-sidebar.tsx, with every docs link
// moved under ROUTES.HOME_NEW_DOCS so the reader stays in the shell. Server
// only (reads the fumadocs source); the result is plain JSON for the rail.

export type DocsSectionIcon =
  | "introduction"
  | "installation"
  | "components"
  | "llms";

export interface DocsMenuLink {
  href: string;
  name: string;
}

export interface DocsMenu {
  sections: (DocsMenuLink & {
    icon: DocsSectionIcon;
    // "exact" for the docs root, so it isn't active on every docs page.
    match: "exact" | "prefix";
  })[];
  groups: {
    id: string;
    label: string;
    // Components pages get the component icon; the rest a page icon.
    kind: "components" | "pages";
    pages: DocsMenuLink[];
  }[];
}

export const toShellDocsHref = (url: string) =>
  url.startsWith(ROUTES.DOCS)
    ? `${ROUTES.HOME_NEW_DOCS}${url.slice(ROUTES.DOCS.length)}`
    : url;

// Page-tree names can be React nodes; the rail only needs their text.
const nameOf = (name: PageTreeNode["name"]) =>
  typeof name === "string" ? name : String(name ?? "");

export const buildDocsMenu = (): DocsMenu => ({
  groups: source.pageTree.children.flatMap((item) => {
    if (item.type !== "folder" || EXCLUDED_SECTIONS.has(item.$id ?? "")) {
      return [];
    }
    const components = isComponentsFolder(item);
    const pages = components
      ? getAllPagesFromFolder(item).filter(
          (page) => page.url !== ROUTES.DOCS_COMPONENTS
        )
      : getPagesFromFolder(item);
    if (pages.length === 0) {
      return [];
    }
    return [
      {
        id: item.$id ?? nameOf(item.name),
        kind: components ? ("components" as const) : ("pages" as const),
        label: nameOf(item.name),
        pages: pages.map((page) => ({
          href: toShellDocsHref(page.url),
          name: nameOf(page.name),
        })),
      },
    ];
  }),
  // Mirrors TOP_LEVEL_SECTIONS in docs-sidebar.tsx. llms.txt is a file, so it
  // keeps its own URL.
  sections: [
    {
      href: ROUTES.HOME_NEW_DOCS,
      icon: "introduction",
      match: "exact",
      name: "Introduction",
    },
    {
      href: toShellDocsHref(ROUTES.DOCS_INSTALLATION),
      icon: "installation",
      match: "prefix",
      name: "Installation",
    },
    {
      href: toShellDocsHref(ROUTES.DOCS_COMPONENTS),
      icon: "components",
      match: "prefix",
      name: "Components",
    },
    { href: ROUTES.LLMS, icon: "llms", match: "prefix", name: "llms.txt" },
  ],
});
