import path from "node:path";

import { readFileFromRoot } from "@/lib/read-file";
import registry from "@/registry.json";

// Reading registry sources from disk. The registry.json lookups live in
// lib/registry-items.ts (no file reads, safe for proxy.ts) and are
// re-exported here.
export {
  getRegistryItem,
  getRegistryItemMeta,
  getRegistryItemTitle,
  isIndexableDocsPage,
  isPaidItem,
} from "@/lib/registry-items";

export const readOptionalFromRoot = async (
  relativePath: string
): Promise<string | null> => {
  try {
    return await readFileFromRoot(relativePath);
  } catch {
    return null;
  }
};

// An item's main file is the first in its registry.json `files`, wherever
// its library folder is (registry/sections, registry/blocks, …).
export const getRegistryUiSourceCandidates = ({ name }: { name: string }) => {
  const main = registry.items.find((item) => item.name === name)?.files[0];
  return main ? [main.path] : [];
};

export const getDemoSource = (name: string): Promise<string | null> =>
  readOptionalFromRoot(path.join("examples", `${name}.tsx`));

export const getRegistrySource = async (
  name: string
): Promise<string | null> => {
  const candidates = getRegistryUiSourceCandidates({ name });

  for (const candidate of candidates) {
    const code = await readOptionalFromRoot(candidate);
    if (code) {
      return code;
    }
  }

  return null;
};
