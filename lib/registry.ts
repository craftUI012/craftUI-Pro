import path from "node:path";

import { readFileFromRoot } from "@/lib/read-file";
import registry from "@/registry.json";

// registry.json's own `meta`, e.g. `meta.pro` to gate an item behind a paid
// plan (see ComponentPreview: a pro item shows the Paywall instead of its
// source, regardless of whether the source file exists).
export const getRegistryItemMeta = (
  name: string
): { pro?: boolean } | undefined =>
  registry.items.find((item) => item.name === name)?.meta;

export const getRegistryItemTitle = (name: string): string | undefined =>
  registry.items.find((item) => item.name === name)?.title;

export const readOptionalFromRoot = async (
  relativePath: string
): Promise<string | null> => {
  try {
    return await readFileFromRoot(relativePath);
  } catch {
    return null;
  }
};

export const getRegistryUiSourceCandidates = ({ name }: { name: string }) => [
  path.join("registry", "new-york", `${name}.tsx`),
];

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
