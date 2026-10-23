// Browse-card media: screenshots and videos, from a file you saved to
// Cloudflare R2, and back.
//
//   pnpm media                  add or replace a screenshot or video (`add`)
//   pnpm media add [file]       pick a file in public/content, confirm its
//                               component and name, then upload it:
//                               - a screenshot (png, jpg, webp) is resized to
//                                 4 AVIF widths, which you check first
//                               - a video (mp4, webm) is uploaded as-is
//                               then the manifest is updated and the local
//                               file (and any sizes) deleted
//   pnpm media delete <name> [--video]
//                               take a card's screenshot (or video) off it
//   pnpm media rollback <name> [--video]
//                               go back to the previous one
//   pnpm media prune [--live <url>]
//                               after a deploy: delete R2 files nothing uses
//   pnpm media check            everything loads and is cached; what's
//                               waiting to be pruned; cards without media
//
// The manifests are the source of truth: the site reads them (lib/media.ts),
// R2 only stores files.
//
//   content/media-manifest.json  screenshots → R2_IMAGES_FOLDER
//   content/video-manifest.json  videos      → R2_VIDEOS_FOLDER
//
// The order of every step keeps the live site working:
//
// - Files are uploaded and checked before the manifest changes, so a failed
//   run leaves the card as it was. Running again finishes the job.
// - File names carry a fingerprint of the file, so an uploaded file is never
//   overwritten, and caches can keep it for a year.
// - Replace and delete never remove files from R2: the live site still uses
//   them until the change is deployed. `prune` deletes them later, and only
//   after checking the live site no longer references them.
// - Only files named by this script, in those two folders, are ever touched.
//   Everything else in the bucket is left alone.
//
// Needs in .env: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
// R2_BUCKET, R2_IMAGES_FOLDER, R2_VIDEOS_FOLDER, R2_PUBLIC_BASE_URL. Optional:
// MEDIA_LIVE_URL, the production address `prune` checks.

import { createHash, createHmac } from "node:crypto";
import { readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { createJiti } from "jiti";
import sharp from "sharp";

const jiti = createJiti(import.meta.url);
const { MEDIA_ASPECT, MEDIA_WIDTHS } = await jiti.import(
  "../constants/media.ts"
);
const { FALLBACK_SITE_ORIGIN } = await jiti.import("../constants/site.ts");

const CONTENT_DIR = "public/content";
const MIN_WIDTH = Math.max(...MEDIA_WIDTHS);
// UI screenshots are mostly small text and thin lines: high quality, and
// full-resolution colour (4:4:4) so coloured text and edges stay sharp.
const AVIF = { chromaSubsampling: "4:4:4", quality: 80 };
const BLUR = { quality: 40, width: 16 };
const CACHE_CONTROL = "public, max-age=31536000, immutable";
// Mixed into every screenshot's fingerprint. Give it a new value when the
// output changes (quality, crop, widths), so every screenshot gets new file
// names instead of reusing ones browsers and Cloudflare have cached for a year.
const PIPELINE = "q80-444";
// Card videos loop silently in a small frame; past this they're slow to start.
const VIDEO_WARN_BYTES = 8 * 1024 * 1024;

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const CONTENT_TYPES = {
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// What differs between screenshots and videos. A manifest entry's files are
// worked out from its name and version (fingerprint, plus ext for videos).
const KINDS = {
  image: {
    folderEnv: "R2_IMAGES_FOLDER",
    label: "screenshot",
    manifest: "content/media-manifest.json",
    ours: /^[a-z0-9-]+-\d+\.[0-9a-f]{8}\.avif$/,
    sources: new Set([".jpeg", ".jpg", ".png", ".webp"]),
    versionFiles: (name, version) =>
      MEDIA_WIDTHS.map(
        (width) => `${name}-${width}.${version.fingerprint}.avif`
      ),
  },
  video: {
    folderEnv: "R2_VIDEOS_FOLDER",
    label: "video",
    manifest: "content/video-manifest.json",
    ours: /^[a-z0-9-]+\.[0-9a-f]{8}\.(?:mp4|webm)$/,
    sources: new Set([".mp4", ".webm"]),
    versionFiles: (name, version) => [
      `${name}.${version.fingerprint}${version.ext}`,
    ],
  },
};
const KIND_IDS = Object.keys(KINDS);

try {
  process.loadEnvFile(".env");
} catch {
  // No .env: use the environment as-is.
}

// ─── Small helpers ───────────────────────────────────────────────────────────

const today = () => new Date().toISOString().slice(0, 10);
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const slug = (text) =>
  text
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

const env = (name) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is missing from .env`);
  }
  return value;
};

const config = () => ({
  account: env("CLOUDFLARE_ACCOUNT_ID"),
  bucket: env("R2_BUCKET"),
  id: env("R2_ACCESS_KEY_ID"),
  publicBase: env("R2_PUBLIC_BASE_URL").replace(/\/$/, ""),
  secret: env("R2_SECRET_ACCESS_KEY"),
});

const folderOf = (kind) =>
  env(KINDS[kind].folderEnv).replaceAll(/^\/|\/$/g, "");

const kindOfFile = (file) =>
  KIND_IDS.find((kind) =>
    KINDS[kind].sources.has(path.extname(file).toLowerCase())
  );

const publicUrl = (kind, file) =>
  `${config().publicBase}/${folderOf(kind)}/${file}`;

// An entry's current version, or a retired one, without its bookkeeping.
const versionOf = (entry) => {
  const {
    item: _item,
    retired: _retired,
    retiredAt: _retiredAt,
    updatedAt: _updatedAt,
    ...version
  } = entry;
  return version;
};

const filesOf = (kind, name, entry) =>
  KINDS[kind].versionFiles(name, versionOf(entry));

const readJson = async (file) => JSON.parse(await readFile(file, "utf-8"));

const readManifest = (kind) => readJson(KINDS[kind].manifest);

const writeManifest = (kind, manifest) =>
  writeFile(KINDS[kind].manifest, `${JSON.stringify(manifest, null, 2)}\n`);

const libraryItems = async () => {
  const registry = await readJson("registry.json");
  return registry.items.filter((item) => item.meta?.library);
};

// ─── Prompts ─────────────────────────────────────────────────────────────────

const rl = createInterface({ input: stdin, output: stdout });
// Read answers line by line rather than with rl.question, so answers piped
// in ahead of time aren't dropped.
const lines = rl[Symbol.asyncIterator]();

const ask = async (question) => {
  stdout.write(question);
  const { done, value } = await lines.next();
  if (done) {
    throw new Error("No answer (input closed)");
  }
  return value.trim();
};

const confirm = async (question) =>
  /^y(es)?$/i.test(await ask(`${question} (y/n) `));

const choose = async (label, options) => {
  for (const [index, option] of options.entries()) {
    console.log(`  ${index + 1}. ${option.label}`);
  }
  const answer = Number(await ask(`${label} (1-${options.length}): `));
  const picked = options[answer - 1];
  if (!picked) {
    throw new Error(`No option ${answer}`);
  }
  return picked.value;
};

// ─── R2 (S3 API, signed with AWS Signature V4) ───────────────────────────────

const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const hmac = (key, data) => createHmac("sha256", key).update(data).digest();
const encode = (text) =>
  encodeURIComponent(text).replaceAll(
    /[!'()*]/g,
    (char) => `%${char.codePointAt(0).toString(16).toUpperCase()}`
  );

const signingKey = (secret, date) => {
  let key = hmac(`AWS4${secret}`, date);
  for (const part of ["auto", "s3", "aws4_request"]) {
    key = hmac(key, part);
  }
  return key;
};

const r2 = ({ body = "", headers = {}, key = "", method, query = {} }) => {
  const { account, bucket, id, secret } = config();
  const host = `${account}.r2.cloudflarestorage.com`;
  const pathname = ["", bucket, ...(key ? key.split("/") : [])]
    .map(encode)
    .join("/");
  const search = Object.entries(query)
    .toSorted(([a], [b]) => (a < b ? -1 : 1))
    .map(([name, value]) => `${encode(name)}=${encode(value)}`)
    .join("&");
  const amzDate = new Date().toISOString().replaceAll(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payload = sha256(body);
  const signed = {
    ...headers,
    host,
    "x-amz-content-sha256": payload,
    "x-amz-date": amzDate,
  };
  const names = Object.keys(signed).toSorted();
  const canonical = [
    method,
    pathname,
    search,
    ...names.map((name) => `${name}:${signed[name]}`),
    "",
    names.join(";"),
    payload,
  ].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const signature = createHmac("sha256", signingKey(secret, date))
    .update(["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n"))
    .digest("hex");
  const { host: _host, ...sent } = signed;

  const init = {
    headers: {
      ...sent,
      authorization: `AWS4-HMAC-SHA256 Credential=${id}/${scope}, SignedHeaders=${names.join(";")}, Signature=${signature}`,
    },
    method,
  };
  if (body.length > 0) {
    init.body = body;
  }
  return fetch(`https://${host}${pathname}${search ? `?${search}` : ""}`, init);
};

const failed = async (response, what) => {
  const text = await response.text();
  const code = text.match(/<Code>([^<]*)<\/Code>/)?.[1] ?? "";
  const hint =
    response.status === 403
      ? " (check the R2 API token has Object Read & Write on this bucket)"
      : "";
  return new Error(`${what}: HTTP ${response.status} ${code}${hint}`);
};

const objectKey = (kind, file) => `${folderOf(kind)}/${file}`;

const exists = async (kind, file) => {
  const response = await r2({ key: objectKey(kind, file), method: "HEAD" });
  return response.ok;
};

const upload = async (kind, file, body) => {
  const response = await r2({
    body,
    headers: {
      "cache-control": CACHE_CONTROL,
      "content-type": CONTENT_TYPES[path.extname(file)],
    },
    key: objectKey(kind, file),
    method: "PUT",
  });
  if (!response.ok) {
    throw await failed(response, `Upload ${file}`);
  }
};

const remove = async (kind, file) => {
  const response = await r2({ key: objectKey(kind, file), method: "DELETE" });
  if (!response.ok) {
    throw await failed(response, `Delete ${file}`);
  }
};

// Every file name in a kind's folder (just the name, without the folder).
const listFiles = async (kind) => {
  const prefix = `${folderOf(kind)}/`;
  const files = [];
  let token;
  do {
    const response = await r2({
      method: "GET",
      query: {
        "list-type": "2",
        prefix,
        ...(token ? { "continuation-token": token } : {}),
      },
    });
    if (!response.ok) {
      throw await failed(response, "List bucket");
    }
    const xml = await response.text();
    for (const [, key] of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) {
      files.push(key.replaceAll("&amp;", "&").slice(prefix.length));
    }
    token = xml.includes("<IsTruncated>true</IsTruncated>")
      ? xml.match(/<NextContinuationToken>([^<]*)</)?.[1]
      : undefined;
  } while (token);
  return files.filter(Boolean);
};

// What a visitor's browser gets for one file: a problem, or undefined.
const publicProblem = async (kind, file) => {
  try {
    const response = await fetch(publicUrl(kind, file), { method: "HEAD" });
    if (!response.ok) {
      return `HTTP ${response.status}`;
    }
    const type = response.headers.get("content-type");
    if (type !== CONTENT_TYPES[path.extname(file)]) {
      return `served as ${type}`;
    }
    if (!response.headers.get("cache-control")?.includes("immutable")) {
      return `cache header is "${response.headers.get("cache-control")}"`;
    }
  } catch (error) {
    return error.message;
  }
};

const uploadFiles = async (kind, files) => {
  for (const { body, file } of files) {
    if (await exists(kind, file)) {
      console.log(`  ${file}  already in R2, skipped`);
    } else {
      await upload(kind, file, body);
      console.log(`  ${file}  uploaded`);
    }
  }
  console.log("\nChecking the public addresses…");
  for (const { file } of files) {
    const problem = await publicProblem(kind, file);
    if (problem) {
      throw new Error(
        `${publicUrl(kind, file)}: ${problem}. The manifest wasn't changed; run again to retry.`
      );
    }
    console.log(`  ✓ ${publicUrl(kind, file)}`);
  }
};

// ─── add: picking the file, component and name ───────────────────────────────

const pickSource = async (fileArg) => {
  if (fileArg) {
    return path.basename(fileArg);
  }
  const all = await readdir(CONTENT_DIR);
  const files = all.filter((file) => kindOfFile(file));
  if (files.length === 0) {
    throw new Error(
      `Nothing to add in ${CONTENT_DIR} (screenshots: png, jpg, webp; videos: mp4, webm)`
    );
  }
  console.log(`\nFiles in ${CONTENT_DIR}:`);
  return choose(
    "Which file",
    files.map((file) => ({
      label: `${file}  (${KINDS[kindOfFile(file)].label})`,
      value: file,
    }))
  );
};

// <section>-<component name>: the item's first type, then its card title.
const proposedName = (item) => `${item.meta.types[0]}-${slug(item.title)}`;

// The component this file is for: guessed from the file name when it matches
// one, confirmed either way.
const pickItem = async (kind, base, items, manifest) => {
  const guess =
    items.find((item) => manifest[base]?.item === item.name) ??
    items.find((item) => proposedName(item) === base);
  if (
    guess &&
    (await confirm(`\nComponent: ${guess.title} (${guess.name})?`))
  ) {
    return guess;
  }
  console.log("\nComponents:");
  const used = new Set(Object.values(manifest).map((entry) => entry.item));
  return choose(
    "Which component",
    items.map((item) => ({
      label: `${item.title} (${item.name})${used.has(item.name) ? ` · has a ${KINDS[kind].label}` : ""}`,
      value: item,
    }))
  );
};

const pickName = async (kind, item, manifest, ext) => {
  const current = Object.entries(manifest).find(
    ([, entry]) => entry.item === item.name
  )?.[0];
  const proposed = current ?? proposedName(item);
  if (await confirm(`\nRename to "${proposed}${ext}"?`)) {
    return proposed;
  }
  const name = await ask("Name (lowercase-with-dashes, no extension): ");
  if (!NAME.test(name)) {
    throw new Error(`"${name}" isn't lowercase-with-dashes`);
  }
  if (manifest[name] && manifest[name].item !== item.name) {
    throw new Error(
      `"${name}" is already ${manifest[name].item}'s ${KINDS[kind].label}`
    );
  }
  return name;
};

const renameSource = async (source, target) => {
  if (source === target) {
    return;
  }
  const existing = await readdir(CONTENT_DIR);
  if (existing.includes(target)) {
    throw new Error(`${CONTENT_DIR}/${target} already exists`);
  }
  await rename(path.join(CONTENT_DIR, source), path.join(CONTENT_DIR, target));
  console.log(`Renamed ${source} → ${target}`);
};

// The new entry, with the version it replaces kept for rollback. Another
// entry for the same component (under an older name) is dropped; its files
// are pruned later.
const updateManifest = (manifest, { item, name, version }) => {
  const previous = manifest[name];
  const retired = previous
    ? [{ ...versionOf(previous), retiredAt: today() }, ...previous.retired]
    : [];
  const dropped = Object.entries(manifest)
    .filter(([other, entry]) => entry.item === item && other !== name)
    .map(([other]) => other);
  for (const other of dropped) {
    console.log(`Replaced "${other}" (its files go at the next prune)`);
  }
  const next = Object.fromEntries(
    Object.entries(manifest).filter(([other]) => !dropped.includes(other))
  );
  next[name] = { ...version, item, retired, updatedAt: today() };
  return { manifest: next, replaced: Boolean(previous) || dropped.length > 0 };
};

// ─── add: screenshots ────────────────────────────────────────────────────────

// The 4 widths (and the blur), cropped to the card's frame from the top.
const makeVariants = async (input, name, fingerprint) => {
  const variants = [];
  for (const width of MEDIA_WIDTHS) {
    const height = Math.round(
      (width * MEDIA_ASPECT.height) / MEDIA_ASPECT.width
    );
    const body = await sharp(input)
      .resize({ fit: "cover", height, position: "top", width })
      .avif(AVIF)
      .toBuffer();
    const file = KINDS.image.versionFiles(name, { fingerprint })[
      variants.length
    ];
    await writeFile(path.join(CONTENT_DIR, file), body);
    variants.push({ body, file, height, width });
  }
  const blur = await sharp(input)
    .resize({
      fit: "cover",
      height: Math.round(
        (BLUR.width * MEDIA_ASPECT.height) / MEDIA_ASPECT.width
      ),
      position: "top",
      width: BLUR.width,
    })
    .avif({ quality: BLUR.quality })
    .toBuffer();
  return {
    blurDataURL: `data:image/avif;base64,${blur.toString("base64")}`,
    variants,
  };
};

// Checked before anything else is asked, so a too-small file stops early.
const checkScreenshot = async (input) => {
  const { height, width } = await sharp(input).metadata();
  console.log(`${width} × ${height}`);
  if (width < MIN_WIDTH) {
    throw new Error(`It's ${width}px wide; it needs at least ${MIN_WIDTH}px`);
  }
};

// Make the sizes, show them, and ask. The files to upload and the manifest
// version, or undefined when you say no.
const prepareScreenshot = async (input, name, fingerprint) => {
  console.log(
    `\nMaking ${MEDIA_WIDTHS.length} sizes (fingerprint ${fingerprint})…`
  );
  const { blurDataURL, variants } = await makeVariants(
    input,
    name,
    fingerprint
  );
  for (const variant of variants) {
    console.log(
      `  ${variant.file}  ${variant.width} × ${variant.height}  ${kb(variant.body.length)}`
    );
    console.log(`    http://localhost:3000/content/${variant.file}`);
  }
  return {
    files: variants,
    question: "\nCheck them above. Upload to R2?",
    version: { blurDataURL, fingerprint },
  };
};

// ─── add: videos ─────────────────────────────────────────────────────────────

const checkVideo = (input) => {
  console.log(mb(input.length));
  if (input.length > VIDEO_WARN_BYTES) {
    console.log(
      `  Over ${mb(VIDEO_WARN_BYTES)}: a card video this big is slow to start. A shorter clip or a lower bitrate export helps.`
    );
  }
};

// Uploaded as-is: no resizing or re-encoding.
const prepareVideo = (input, name, ext, fingerprint) => {
  const [file] = KINDS.video.versionFiles(name, { ext, fingerprint });
  console.log(`\nUploading as ${file} (fingerprint ${fingerprint}).`);
  console.log(`  Preview: http://localhost:3000/content/${name}${ext}`);
  return {
    files: [{ body: input, file }],
    question: "\nUpload to R2?",
    version: { bytes: input.length, ext, fingerprint },
  };
};

// ─── add ─────────────────────────────────────────────────────────────────────

const add = async (fileArg) => {
  const source = await pickSource(fileArg);
  const kind = kindOfFile(source);
  if (!kind) {
    throw new Error(`${source} isn't a screenshot or video this script takes`);
  }
  const { label } = KINDS[kind];
  const input = await readFile(path.join(CONTENT_DIR, source));
  stdout.write(`\n${source} (${label}): `);
  await (kind === "image" ? checkScreenshot(input) : checkVideo(input));

  const manifest = await readManifest(kind);
  const ext = path.extname(source).toLowerCase();
  const item = await pickItem(
    kind,
    path.basename(source, path.extname(source)),
    await libraryItems(),
    manifest
  );
  const name = await pickName(kind, item, manifest, ext);
  const target = `${name}${ext}`;
  await renameSource(source, target);

  // Screenshots mix in the output settings, so new settings mean new names.
  const fingerprint = sha256(
    kind === "image" ? Buffer.concat([Buffer.from(PIPELINE), input]) : input
  ).slice(0, 8);
  const current = manifest[name];
  if (
    current?.fingerprint === fingerprint &&
    (kind === "image" || current.ext === ext)
  ) {
    await rm(path.join(CONTENT_DIR, target), { force: true });
    console.log(
      `\nThis exact ${label} is already on the card. Removed ${CONTENT_DIR}/${target}.`
    );
    return;
  }

  const prepared =
    kind === "image"
      ? await prepareScreenshot(input, name, fingerprint)
      : prepareVideo(input, name, ext, fingerprint);
  if (!(await confirm(prepared.question))) {
    console.log(
      `Not uploaded. The files are in ${CONTENT_DIR}; delete them or run again.`
    );
    return;
  }
  await uploadFiles(kind, prepared.files);

  const result = updateManifest(manifest, {
    item: item.name,
    name,
    version: prepared.version,
  });
  await writeManifest(kind, result.manifest);
  // Everything is in R2 and on the card now, so the local files go. Not
  // before: a failed run keeps them.
  const local = [
    target,
    ...(kind === "image" ? prepared.files : []).map(({ file }) => file),
  ];
  await Promise.all(
    local.map((file) => rm(path.join(CONTENT_DIR, file), { force: true }))
  );

  console.log(
    `\n✓ ${item.title} now uses "${name}". ${KINDS[kind].manifest} updated.`
  );
  console.log(`  Removed ${local.join(", ")} from ${CONTENT_DIR}.`);
  console.log(
    "  Check the card on http://localhost:3000, then commit and deploy."
  );
  if (result.replaced) {
    console.log(
      "  After the deploy, run `pnpm media prune` to delete the old files."
    );
  }
};

// ─── delete / rollback ───────────────────────────────────────────────────────

// Which manifest a name is in: the one --video/--image says, else wherever
// it's found (asking when it's in both).
const findEntry = async (name, kindFlag) => {
  if (!name) {
    throw new Error("Which one? Pass its name, e.g. hero-data-panel-hero");
  }
  const kinds = kindFlag ? [kindFlag] : KIND_IDS;
  const found = [];
  for (const kind of kinds) {
    const manifest = await readManifest(kind);
    if (manifest[name]) {
      found.push({ entry: manifest[name], kind, manifest });
    }
  }
  if (found.length === 0) {
    throw new Error(
      `No ${kindFlag ? KINDS[kindFlag].label : "screenshot or video"} named "${name}". See \`pnpm media check\` for names.`
    );
  }
  if (found.length === 1) {
    return found[0];
  }
  console.log(`\n"${name}" is both a screenshot and a video:`);
  return choose(
    "Which one",
    found.map((match) => ({ label: KINDS[match.kind].label, value: match }))
  );
};

const deleteEntry = async (name, kindFlag) => {
  const { entry, kind, manifest } = await findEntry(name, kindFlag);
  const { label } = KINDS[kind];
  console.log(
    `\n"${name}" is the ${label} for ${entry.item} (${entry.fingerprint}).`
  );
  if (!(await confirm(`Take the ${label} off the card?`))) {
    return;
  }
  const { [name]: _removed, ...rest } = manifest;
  await writeManifest(kind, rest);
  console.log(
    `\n✓ Removed from ${KINDS[kind].manifest}. Commit and deploy, then run`
  );
  console.log("  `pnpm media prune` to delete its files from R2.");
};

const rollback = async (name, kindFlag) => {
  const { entry, kind, manifest } = await findEntry(name, kindFlag);
  const { label } = KINDS[kind];
  const [previous, ...older] = entry.retired;
  if (!previous) {
    throw new Error(`"${name}" has no earlier ${label} to go back to`);
  }
  for (const file of filesOf(kind, name, previous)) {
    if (await publicProblem(kind, file)) {
      throw new Error(
        `${file} is no longer in R2 (pruned). Upload a new ${label} instead.`
      );
    }
  }
  if (
    !(await confirm(
      `\nGo back to ${previous.fingerprint} from ${previous.retiredAt}?`
    ))
  ) {
    return;
  }
  manifest[name] = {
    ...versionOf(previous),
    item: entry.item,
    retired: [{ ...versionOf(entry), retiredAt: today() }, ...older],
    updatedAt: today(),
  };
  await writeManifest(kind, manifest);
  console.log(
    `\n✓ "${name}" is back on ${previous.fingerprint}. Commit and deploy.`
  );
};

// ─── prune ───────────────────────────────────────────────────────────────────

const currentFiles = (kind, manifest) =>
  new Set(
    Object.entries(manifest).flatMap(([name, entry]) =>
      filesOf(kind, name, entry)
    )
  );

// One kind's files in R2 that its manifest no longer uses, split by whether
// the live site still references them (it does until the change is deployed).
const pruneCandidates = async (kind, manifest, liveHtml) => {
  const current = currentFiles(kind, manifest);
  const files = await listFiles(kind);
  const ours = files.filter((file) => KINDS[kind].ours.test(file));
  const unused = ours.filter((file) => !current.has(file));
  return {
    deletable: unused.filter((file) => !liveHtml.includes(file)),
    files,
    live: unused.filter((file) => liveHtml.includes(file)),
    others: files.length - ours.length,
  };
};

const liveSite = async (liveArg) => {
  const url = (
    liveArg ??
    process.env.MEDIA_LIVE_URL ??
    FALLBACK_SITE_ORIGIN
  ).replace(/\/$/, "");
  if (
    /localhost|127\.0\.0\.1/.test(url) &&
    !(await confirm(`${url} is local, not production. Check it anyway?`))
  ) {
    throw new Error(
      "Pass the production address: pnpm media prune --live https://…"
    );
  }
  let response;
  try {
    response = await fetch(`${url}/`, { cache: "no-store" });
  } catch {
    // Unreachable: handled below like a failed response.
  }
  if (!response?.ok) {
    throw new Error(
      `Couldn't load ${url}/ (${response?.status ?? "no response"}), so it can't be checked. Nothing was deleted. Set MEDIA_LIVE_URL or pass --live <url>.`
    );
  }
  console.log(`Live site: ${url}`);
  return response.text();
};

// Retired versions whose files are gone can't be rolled back to; drop them.
const forgetPruned = (kind, manifest, remaining) => {
  const left = new Set(remaining);
  const next = {};
  for (const [name, entry] of Object.entries(manifest)) {
    next[name] = {
      ...entry,
      retired: entry.retired.filter((old) =>
        filesOf(kind, name, old).some((file) => left.has(file))
      ),
    };
  }
  return next;
};

// Kinds whose folder is set up. A kind without its folder env var is skipped,
// unless its manifest has entries (then the env var is genuinely missing).
const configuredKinds = async () => {
  const kinds = [];
  for (const kind of KIND_IDS) {
    if (process.env[KINDS[kind].folderEnv]?.trim()) {
      kinds.push(kind);
    } else if (Object.keys(await readManifest(kind)).length > 0) {
      env(KINDS[kind].folderEnv);
    }
  }
  return kinds;
};

const prune = async (liveArg) => {
  const html = await liveSite(liveArg);
  const plans = [];
  for (const kind of await configuredKinds()) {
    const manifest = await readManifest(kind);
    const plan = await pruneCandidates(kind, manifest, html);
    plans.push({ ...plan, kind, manifest });
    if (plan.others > 0) {
      console.log(
        `(${plan.others} other file(s) in ${folderOf(kind)} weren't made by pnpm media; left alone)`
      );
    }
    for (const file of plan.live) {
      console.log(`  kept  ${file}  still used by the live site; deploy first`);
    }
  }

  const deletable = plans.flatMap(({ deletable: files, kind }) =>
    files.map((file) => ({ file, kind }))
  );
  if (deletable.length === 0) {
    console.log("\nNothing to prune.");
    return;
  }
  console.log("\nNot used by the manifests or the live site:");
  for (const { file, kind } of deletable) {
    console.log(`  ${folderOf(kind)}/${file}`);
  }
  const answer = await ask(
    `\nType "delete" to remove these ${deletable.length} file(s) from R2: `
  );
  if (answer !== "delete") {
    console.log("Nothing deleted.");
    return;
  }
  for (const { file, kind } of deletable) {
    await remove(kind, file);
    console.log(`  deleted ${folderOf(kind)}/${file}`);
  }

  const updated = [];
  for (const plan of plans) {
    const gone = new Set(plan.deletable);
    const next = forgetPruned(
      plan.kind,
      plan.manifest,
      plan.files.filter((file) => !gone.has(file))
    );
    if (JSON.stringify(next) !== JSON.stringify(plan.manifest)) {
      await writeManifest(plan.kind, next);
      updated.push(KINDS[plan.kind].manifest);
    }
  }
  console.log(
    updated.length > 0
      ? `\n✓ Pruned. ${updated.join(" and ")} updated (old versions removed); commit it.`
      : "\n✓ Pruned."
  );
};

// ─── check ───────────────────────────────────────────────────────────────────

const checkKind = async (kind, items) => {
  const manifest = await readManifest(kind);
  const { label } = KINDS[kind];
  let problems = 0;
  console.log(`\n${label[0].toUpperCase()}${label.slice(1)}s:`);
  if (Object.keys(manifest).length === 0) {
    console.log("  none yet");
  }
  for (const [name, entry] of Object.entries(manifest)) {
    const results = await Promise.all(
      filesOf(kind, name, entry).map((file) => publicProblem(kind, file))
    );
    const bad = results.filter(Boolean);
    problems += bad.length;
    console.log(
      `  ${bad.length === 0 ? "✓" : "✗"} ${name} → ${entry.item} (${entry.fingerprint})${bad.length === 0 ? "" : `: ${bad.join("; ")}`}`
    );
  }

  const current = currentFiles(kind, manifest);
  const inBucket = await listFiles(kind);
  const waiting = inBucket.filter(
    (file) => KINDS[kind].ours.test(file) && !current.has(file)
  );
  if (waiting.length > 0) {
    console.log(
      `  ${waiting.length} old file(s) waiting for \`pnpm media prune\` (after a deploy).`
    );
  }

  const used = new Set(Object.values(manifest).map((entry) => entry.item));
  const without = items.filter((item) => !used.has(item.name));
  if (without.length > 0) {
    console.log(
      `  Cards without a ${label}: ${without.map((item) => item.title).join(", ")}`
    );
  }
  return problems;
};

const check = async () => {
  const items = await libraryItems();
  let problems = 0;
  for (const kind of await configuredKinds()) {
    problems += await checkKind(kind, items);
  }
  if (problems > 0) {
    process.exitCode = 1;
  }
};

// ─── main ────────────────────────────────────────────────────────────────────

const [command = "add", ...rest] = process.argv.slice(2);
const flag = (name) => {
  const index = rest.indexOf(name);
  return index === -1 ? undefined : rest[index + 1];
};
const positional = rest.find((arg) => !arg.startsWith("--"));
let kindFlag;
if (rest.includes("--video")) {
  kindFlag = "video";
} else if (rest.includes("--image")) {
  kindFlag = "image";
}
const COMMANDS = {
  add: () => add(positional),
  check,
  delete: () => deleteEntry(positional, kindFlag),
  prune: () => prune(flag("--live")),
  rollback: () => rollback(positional, kindFlag),
};

try {
  const run = COMMANDS[command];
  if (!run) {
    throw new Error(
      `Unknown command "${command}". Use: ${Object.keys(COMMANDS).join(", ")}`
    );
  }
  await run();
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}
