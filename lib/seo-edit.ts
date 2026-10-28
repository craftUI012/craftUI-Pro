import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { ROUTES } from "@/constants/routes";
import { source } from "@/lib/source";

// Editing a docs page's SEO text from /seo-admin (dev only). Two places,
// written straight to the files in this repo so the change shows in git:
//
//   search   title + description in the page's MDX front matter: the
//            browser tab, Google's result and the social share card
//   card     the matching registry.json item's description: the line under
//            its card on the browse page, and its install data (shadcn CLI,
//            AI tools). After a change the registry is rebuilt.
//
// Only the `title:` and `description:` lines of the front matter are
// replaced; the rest of the file is left byte for byte. MDX is never run
// through the formatter (it escapes {/* */} comments and breaks pages).

const ROOT = process.cwd();
const DOCS_DIR = path.join(ROOT, "content", "docs");
const REGISTRY = path.join(ROOT, "registry.json");

export interface EditableSeo {
  /** The page's URL path, e.g. /docs/templates/statement-section. */
  path: string;
  /** The MDX file, relative to the repo root. */
  file: string;
  title: string;
  description: string;
  /** The registry item behind the page, if it has one. */
  card?: { name: string; description: string };
}

interface RegistryItem {
  name: string;
  description?: string;
  meta?: { library?: string; docs?: string };
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

/** A YAML scalar for one line: plain when safe, double-quoted otherwise. */
const yamlScalar = (value: string) => {
  const plain =
    value.length > 0 &&
    !/^[\s\-?:,[\]{}#&*!|>'"%@`]/.test(value) &&
    !/(:\s|\s#|:$)/.test(value) &&
    !/\s$/.test(value) &&
    !/^(true|false|null|yes|no|on|off|~|[\d.+-]+)$/i.test(value);
  return plain ? value : JSON.stringify(value);
};

/** A front-matter key's value, unquoted, if it's set on one line. */
const readKey = (block: string, key: string) => {
  const line = new RegExp(`^${key}:[ \\t]*(.*)$`, "m").exec(block);
  if (!line) {
    return "";
  }
  const raw = line[1].trim();
  if (raw.startsWith('"')) {
    try {
      return JSON.parse(raw) as string;
    } catch {
      return raw.slice(1, -1);
    }
  }
  if (raw.startsWith("'")) {
    return raw.slice(1, -1).replaceAll("''", "'");
  }
  return raw;
};

/**
 * Sets a front-matter key to a one-line value: replaces its line (and any
 * indented continuation lines), or adds it at the end.
 */
const writeKey = (block: string, key: string, value: string) => {
  const line = `${key}: ${yamlScalar(value)}`;
  const existing = new RegExp(`^${key}:.*(?:\\r?\\n[ \\t]+.*)*`, "m");
  return existing.test(block)
    ? block.replace(existing, () => line)
    : `${block}\n${line}`;
};

const readRegistry = async () =>
  JSON.parse(await readFile(REGISTRY, "utf-8")) as { items: RegistryItem[] };

/** The registry item whose docs page is at `url`. */
const cardFor = (items: RegistryItem[], url: string) =>
  items.find(
    (item) =>
      item.meta?.library !== undefined &&
      `${ROUTES.DOCS}/${item.meta.library}/${item.meta.docs ?? item.name}` ===
        url
  );

const fileFor = (url: string) => {
  const page = source.getPages().find((p) => p.url === url);
  if (!page) {
    return null;
  }
  return page.absolutePath ?? path.join(DOCS_DIR, page.path);
};

/** Every docs page's editable SEO text, read fresh from the files. */
export const readEditableSeo = async (): Promise<Map<string, EditableSeo>> => {
  const { items } = await readRegistry();
  const entries = await Promise.all(
    source.getPages().map(async (page) => {
      const file = page.absolutePath ?? path.join(DOCS_DIR, page.path);
      const text = await readFile(file, "utf-8");
      const block = FRONT_MATTER.exec(text)?.[1] ?? "";
      const item = cardFor(items, page.url);
      const entry: EditableSeo = {
        card: item
          ? { description: item.description ?? "", name: item.name }
          : undefined,
        description: readKey(block, "description"),
        file: path.relative(ROOT, file),
        path: page.url,
        title: readKey(block, "title"),
      };
      return [page.url, entry] as const;
    })
  );
  return new Map(entries);
};

/** Writes a page's search title and description into its MDX front matter. */
export const writeSearchText = async (
  url: string,
  title: string,
  description: string
) => {
  const file = fileFor(url);
  if (!file) {
    throw new Error(`No docs page at ${url}.`);
  }
  const text = await readFile(file, "utf-8");
  const match = FRONT_MATTER.exec(text);
  if (!match) {
    throw new Error(`${path.relative(ROOT, file)} has no front matter.`);
  }
  let block = writeKey(match[1], "title", title);
  block = writeKey(block, "description", description);
  const next = text.replace(match[1], () => block);
  if (next !== text) {
    await writeFile(file, next);
  }
  return next !== text;
};

/**
 * Writes the card description of the registry item behind `url`, then
 * rebuilds the registry and formats its output, so the install data (and
 * nothing else) changes with it.
 */
export const writeCardText = async (url: string, description: string) => {
  const registry = await readRegistry();
  const item = cardFor(registry.items, url);
  if (!item) {
    throw new Error(`No registry item has its docs at ${url}.`);
  }
  if (item.description === description) {
    return false;
  }
  item.description = description;
  await writeFile(REGISTRY, `${JSON.stringify(registry, null, 2)}\n`);

  const run = (command: string, args: string[]) => {
    const result = spawnSync(command, args, {
      cwd: ROOT,
      encoding: "utf-8",
      shell: process.platform === "win32",
    });
    if (result.status !== 0) {
      throw new Error(
        `${command} ${args.join(" ")} failed: ${(result.stderr || result.stdout).trim().slice(-400)}`
      );
    }
  };
  run("pnpm", ["exec", "oxfmt", "registry.json"]);
  run("node", ["scripts/build-registry.mjs"]);
  run("pnpm", ["exec", "oxfmt", "registry-paid", "public/r"]);
  return true;
};
