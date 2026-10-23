// Builds public/r/*.json with `shadcn build`, taking the registry "homepage"
// from NEXT_PUBLIC_SITE_URL instead of the value hard-coded in registry.json.
//
// registry.json itself is never modified: the script builds from a temporary
// copy, so local builds don't leave a diff behind.
//
// NEXT_PUBLIC_SITE_URL comes from the environment (Vercel dashboard) or, when
// running locally, from .env. A localhost value is ignored, so a local build
// never publishes "http://localhost:3000" as the homepage; the value in
// registry.json is kept instead.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { createJiti } from "jiti";

const OUTPUT_DIR = "./public/r";
const TEMP_DIR = "node_modules/.cache/registry";

try {
  process.loadEnvFile(".env");
} catch {
  // No .env file (CI, Vercel): use the environment as-is.
}

const isLocalhost = (url) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(url);

const registry = JSON.parse(readFileSync("registry.json", "utf-8"));

// Strict browse metadata: every category, type and style an item uses must be
// in constants/taxonomy.ts and listed by its library. Fails before building.
const jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(import.meta.dirname, "..") },
});
const { validateRegistryTaxonomy } = await jiti.import("../lib/taxonomy.ts");
const taxonomyErrors = validateRegistryTaxonomy(registry.items);
if (taxonomyErrors.length > 0) {
  console.error(
    "registry.json browse metadata doesn't match constants/taxonomy.ts:"
  );
  for (const line of taxonomyErrors) {
    console.error(`  - ${line}`);
  }
  process.exit(1);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

if (siteUrl && !isLocalhost(siteUrl)) {
  registry.homepage = siteUrl;
}

console.log(`Registry homepage: ${registry.homepage}`);

mkdirSync(TEMP_DIR, { recursive: true });
const tempRegistry = path.join(TEMP_DIR, "registry.json");
writeFileSync(tempRegistry, `${JSON.stringify(registry, null, 2)}\n`);

const result = spawnSync(
  "shadcn",
  ["build", tempRegistry, "--output", OUTPUT_DIR],
  { shell: process.platform === "win32", stdio: "inherit" }
);

process.exitCode = result.status ?? 1;
