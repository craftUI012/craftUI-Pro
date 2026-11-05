import { readFile } from "node:fs/promises";

import { isLivePreview, LIVE_PREVIEWS } from "@/constants/live-previews";
import type { StudioComponentOption } from "@/lib/studio/options";
import { repoPath } from "@/lib/studio/paths";

// What the director knows about a component, all read from the repo:
// registry.json (title, description, use cases, styles), the agent
// reference (import path, props, files), the source itself, and the
// interactive elements found in it. Only items with a live preview can be
// filmed, so only those are offered.

interface RegistryItem {
  name: string;
  title?: string;
  description?: string;
  dependencies?: string[];
  meta?: {
    id?: string;
    library?: string;
    types?: string[];
    styles?: string[];
    useCases?: string[];
    free?: boolean;
  };
  files?: { path: string; target?: string }[];
}

interface AgentProp {
  name: string;
  type: string;
  optional: boolean;
  description?: string;
  default?: string | null;
}

interface AgentItem {
  component: string;
  import: string;
  files: string[];
  paid: boolean;
  props: AgentProp[];
}

const readJson = async <T>(file: string): Promise<T> =>
  JSON.parse(await readFile(repoPath(file), "utf-8")) as T;

const registryItems = async () => {
  const registry = await readJson<{ items: RegistryItem[] }>("registry.json");
  return registry.items;
};

export const listStudioComponents = async (): Promise<
  StudioComponentOption[]
> => {
  const [items, agent] = await Promise.all([
    registryItems(),
    readJson<Record<string, AgentItem>>("content/agent-reference.json"),
  ]);
  return items
    .filter((item) => isLivePreview(item.name))
    .map((item) => ({
      library: item.meta?.library ?? "",
      name: item.name,
      paid: agent[item.name]?.paid ?? !item.meta?.free,
      title: item.title ?? item.name,
    }))
    .toSorted((a, b) => a.title.localeCompare(b.title));
};

/** Elements a beat can target, found in the source. Only literal values:
 *  a computed aria-label can't be checked before filming. */
export interface Interactions {
  ariaLabels: string[];
  keys: string[];
  hasForm: boolean;
}

const KEY_NAMES = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Enter",
  "Escape",
];

export const findInteractions = (source: string): Interactions => {
  const ariaLabels = [
    ...new Set([...source.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1])),
  ];
  const keys = KEY_NAMES.filter((key) =>
    new RegExp(`["'\`]${key}["'\`]`).test(source)
  );
  return { ariaLabels, hasForm: /<input|<textarea|<form/.test(source), keys };
};

export interface ComponentContext {
  name: string;
  title: string;
  description: string;
  useCases: string[];
  styles: string[];
  types: string[];
  paid: boolean;
  importPath: string;
  componentName: string;
  props: AgentProp[];
  /** Install targets, e.g. components/blocks/x.tsx */
  files: string[];
  source: string;
  interactions: Interactions;
}

export const readComponentContext = async (
  name: string
): Promise<ComponentContext> => {
  if (!(LIVE_PREVIEWS as readonly string[]).includes(name)) {
    throw new Error(`"${name}" has no live preview, so it can't be filmed.`);
  }
  const [items, agent] = await Promise.all([
    registryItems(),
    readJson<Record<string, AgentItem>>("content/agent-reference.json"),
  ]);
  const item = items.find((i) => i.name === name);
  const ref = agent[name];
  if (!item || !ref) {
    throw new Error(
      `"${name}" is missing from registry.json or the agent reference. Run pnpm registry:build.`
    );
  }
  // The whole entry file, never truncated: the director needs its real
  // labels, keys and defaults.
  const entry = item.files?.[0]?.path;
  if (!entry) {
    throw new Error(`"${name}" lists no source file.`);
  }
  const source = await readFile(repoPath(entry), "utf-8");
  return {
    componentName: ref.component,
    description: item.description ?? "",
    files: ref.files,
    importPath: ref.import,
    interactions: findInteractions(source),
    name,
    paid: ref.paid,
    props: ref.props,
    source,
    styles: item.meta?.styles ?? [],
    title: item.title ?? name,
    types: item.meta?.types ?? [],
    useCases: item.meta?.useCases ?? [],
  };
};
