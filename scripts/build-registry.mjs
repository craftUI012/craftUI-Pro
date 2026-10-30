// Builds public/r/*.json with `shadcn build`, taking the registry "homepage"
// from NEXT_PUBLIC_SITE_URL instead of the value hard-coded in registry.json.
//
// registry.json itself is modified in one case only: a new item without a
// product code (meta.id) gets one, on a local build (see assignProductIds).
// Everything else builds from a temporary copy, so local builds don't leave
// a diff behind.
//
// NEXT_PUBLIC_SITE_URL comes from the environment (Vercel dashboard) or, when
// running locally, from .env. A localhost value is ignored, so a local build
// never publishes "http://localhost:3000" as the homepage; the value in
// registry.json is kept instead.

import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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

const jiti = createJiti(import.meta.url, {
  alias: { "@": path.resolve(import.meta.dirname, "..") },
});
const { newProductId, validateRegistryTaxonomy } =
  await jiti.import("../lib/taxonomy.ts");
const { LIBRARIES } = await jiti.import("../constants/taxonomy.ts");

/** registry.json's text with `"id": code` added as the first key of the
 * named item's meta, keeping the file's own formatting; null if the item's
 * meta isn't laid out one key per line. */
const withProductId = (text, name, code) => {
  const at = text.indexOf(`"name": ${JSON.stringify(name)}`);
  const nextItem = text.indexOf('"name": ', at + 1);
  const meta = text.indexOf('"meta": {\n', at);
  if (at === -1 || meta === -1 || (nextItem !== -1 && meta > nextItem)) {
    return null;
  }
  const lineEnd = text.indexOf("\n", meta);
  const [indent] = /^[ \t]*/.exec(text.slice(lineEnd + 1));
  return `${text.slice(0, lineEnd + 1)}${indent}"id": ${JSON.stringify(code)},\n${text.slice(lineEnd + 1)}`;
};

// Product codes: a new item leaves meta.id out, and its first local build
// gives it a random one (lib/taxonomy.ts newProductId) and writes it into
// registry.json, to commit with the item. Random, not "the next number", so
// two people adding items on separate branches never take the same code. A
// deploy (CI, Vercel) never makes one up: an item's code must be the same in
// every build, so a missing one fails there, in the check below.
const assignProductIds = () => {
  const missing = registry.items.filter(
    (item) =>
      item.meta &&
      item.meta.id === undefined &&
      Object.hasOwn(LIBRARIES, item.meta.library ?? "")
  );
  if (missing.length === 0 || process.env.CI || process.env.VERCEL) {
    return;
  }
  const taken = new Set(
    registry.items.map((item) => item.meta?.id).filter(Boolean)
  );
  let text = readFileSync("registry.json", "utf-8");
  for (const item of missing) {
    const code = newProductId(LIBRARIES[item.meta.library].idPrefix, taken);
    const updated = withProductId(text, item.name, code);
    const written = updated
      ? JSON.parse(updated).items.find((entry) => entry.name === item.name)
      : null;
    if (written?.meta?.id !== code) {
      console.error(
        `Couldn't add a product code to "${item.name}" in registry.json. Add "id": "${code}" to its meta by hand.`
      );
      process.exit(1);
    }
    text = updated;
    taken.add(code);
    item.meta.id = code;
    console.log(
      `Gave "${item.name}" the product code ${code} in registry.json: commit it with the item.`
    );
  }
  writeFileSync("registry.json", text);
};
assignProductIds();

// Strict browse metadata: every category, type and style an item uses must be
// in constants/taxonomy.ts and listed by its library. Fails before building.
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

// Images a component loads by a root-relative path ("/images/…") live in this
// site's public folder. That path works in the site's own previews, but after
// `shadcn add` it would resolve against the user's site, where the file
// doesn't exist. So in the published files only, point it at this site: the
// image is then served from here (the deploy's CDN), with no upload step.
const ROOT_ASSET = /(["'`(])\/images\//g;

if (result.status === 0) {
  for (const file of readdirSync(OUTPUT_DIR)) {
    if (!file.endsWith(".json") || file === "registry.json") {
      continue;
    }
    const target = path.join(OUTPUT_DIR, file);
    const item = JSON.parse(readFileSync(target, "utf-8"));
    let rewritten = 0;
    for (const entry of item.files ?? []) {
      if (typeof entry.content === "string") {
        rewritten += entry.content.match(ROOT_ASSET)?.length ?? 0;
        entry.content = entry.content.replace(
          ROOT_ASSET,
          `$1${registry.homepage}/images/`
        );
      }
    }
    if (rewritten > 0) {
      writeFileSync(target, `${JSON.stringify(item, null, 2)}\n`);
      console.log(
        `Pointed ${rewritten} image path(s) in ${file} at ${registry.homepage}`
      );
    }
  }
}

// Paid items (every library item without `meta.free`) must not be public
// files: anyone could install them. Move them to PAID_DIR, outside public/,
// where app/r/[file]/route.ts serves them only to buyers. Rebuilt from
// scratch each time, so an item that turns free leaves no stale copy.
const PAID_DIR = "./registry-paid";

if (result.status === 0) {
  rmSync(PAID_DIR, { force: true, recursive: true });
  mkdirSync(PAID_DIR, { recursive: true });
  const paid = registry.items.filter(
    (item) => item.meta?.library !== undefined && item.meta.free !== true
  );
  for (const item of paid) {
    const file = `${item.name}.json`;
    renameSync(path.join(OUTPUT_DIR, file), path.join(PAID_DIR, file));
  }
  console.log(`Moved ${paid.length} paid item(s) to ${PAID_DIR}`);
}

// What AI agents read about each item (install, usage, props), from the
// registry and the components' own types: see scripts/agent-reference.mjs.
if (result.status === 0) {
  const { writeAgentReference } = await import("./agent-reference.mjs");
  writeAgentReference(registry);
}
