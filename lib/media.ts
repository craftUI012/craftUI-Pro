import { MEDIA_ASPECT, MEDIA_WIDTHS } from "@/constants/media";
import manifest from "@/content/media-manifest.json";
import videoManifest from "@/content/video-manifest.json";
import registry from "@/registry.json";

// Browse-card media served from Cloudflare R2, not Vercel. Files are made and
// uploaded with `pnpm media` (scripts/media.mjs); entries are keyed by file
// name (<section>-<component name>, e.g. hero-data-panel-hero), each with the
// registry item whose card shows it.
//
// Screenshots: content/media-manifest.json, four AVIF widths each
// (constants/media.ts):
//
//   <R2_IMAGES_FOLDER>/<name>-<width>.<fingerprint>.avif
//
// Videos: content/video-manifest.json, uploaded as-is:
//
//   <R2_VIDEOS_FOLDER>/<name>.<fingerprint>.<mp4|webm>
//
// The fingerprint changes with every new file, so a file never changes once
// uploaded and is cached for a year (immutable).

// Width served when the browser ignores srcset.
const DEFAULT_WIDTH = 800;

const VIDEO_TYPES = { ".mp4": "video/mp4", ".webm": "video/webm" } as const;
type VideoExt = keyof typeof VIDEO_TYPES;

// Earlier versions still in R2, newest first: `pnpm media rollback` restores
// one, `pnpm media prune` deletes their files after a deploy.
interface Retired {
  fingerprint: string;
  retiredAt: string;
}

export interface MediaEntry {
  blurDataURL: string;
  fingerprint: string;
  item: string;
  retired: (Retired & { blurDataURL: string })[];
  updatedAt: string;
}

export interface VideoEntry {
  bytes: number;
  ext: VideoExt;
  fingerprint: string;
  item: string;
  retired: (Retired & { bytes: number; ext: VideoExt })[];
  updatedAt: string;
}

const images = manifest as Record<string, MediaEntry>;
const videos = videoManifest as Record<string, VideoEntry>;

const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FINGERPRINT = /^[0-9a-f]{8}$/;

// The manifests are written by `pnpm media` but can be edited by hand, so
// check them the way lib/taxonomy.ts checks the registry: a bad entry fails
// the build rather than showing a broken card.
const entryErrors = (
  entries: Record<string, { fingerprint: string; item: string }>
) => {
  const items = new Set(registry.items.map((item) => item.name));
  const seen = new Map<string, string>();
  const errors: string[] = [];
  for (const [name, entry] of Object.entries(entries)) {
    if (!NAME.test(name)) {
      errors.push(`"${name}": name must be lowercase-with-dashes`);
    }
    if (!FINGERPRINT.test(entry.fingerprint)) {
      errors.push(`"${name}": fingerprint must be 8 hex characters`);
    }
    if (!items.has(entry.item)) {
      errors.push(`"${name}": item "${entry.item}" isn't in registry.json`);
    }
    const other = seen.get(entry.item);
    if (other) {
      errors.push(`"${name}" and "${other}" both point at "${entry.item}"`);
    }
    seen.set(entry.item, name);
  }
  return errors;
};

const validateManifests = () => {
  const report = [
    ["content/media-manifest.json", entryErrors(images)],
    [
      "content/video-manifest.json",
      [
        ...entryErrors(videos),
        ...Object.entries(videos)
          .filter(([, entry]) => !(entry.ext in VIDEO_TYPES))
          .map(([name]) => `"${name}": ext must be .mp4 or .webm`),
      ],
    ],
  ] as const;
  const failed = report.filter(([, errors]) => errors.length > 0);
  if (failed.length > 0) {
    throw new Error(
      failed
        .map(
          ([file, errors]) =>
            `${file}:\n${errors.map((line) => `  - ${line}`).join("\n")}`
        )
        .join("\n")
    );
  }
};

validateManifests();

const indexByItem = <T extends { item: string }>(entries: Record<string, T>) =>
  new Map(
    Object.entries(entries).map(([name, entry]) => [
      entry.item,
      { entry, name },
    ])
  );

const imagesByItem = indexByItem(images);
const videosByItem = indexByItem(videos);

// Public R2 address of a folder, or undefined when it isn't configured
// (cards then go without, instead of breaking).
const folderUrl = (folder: string | undefined) => {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const trimmed = folder?.replaceAll(/^\/|\/$/g, "");
  return base && trimmed ? `${base}/${trimmed}` : undefined;
};
const imagesBaseUrl = () => folderUrl(process.env.R2_IMAGES_FOLDER);
const videosBaseUrl = () => folderUrl(process.env.R2_VIDEOS_FOLDER);

// The card image for a registry item, when it has an uploaded screenshot.
export const getCardMedia = (item: string) => {
  const found = imagesByItem.get(item);
  const base = imagesBaseUrl();
  if (!found || !base) {
    return;
  }
  const url = (width: number) =>
    `${base}/${found.name}-${width}.${found.entry.fingerprint}.avif`;

  return {
    blurDataURL: found.entry.blurDataURL,
    height: Math.round(
      (DEFAULT_WIDTH * MEDIA_ASPECT.height) / MEDIA_ASPECT.width
    ),
    src: url(DEFAULT_WIDTH),
    srcSet: MEDIA_WIDTHS.map((width) => `${url(width)} ${width}w`).join(", "),
    width: DEFAULT_WIDTH,
  };
};

// The card video for a registry item, when it has an uploaded one.
export const getCardVideo = (item: string) => {
  const found = videosByItem.get(item);
  const base = videosBaseUrl();
  if (!found || !base) {
    return;
  }
  const { ext, fingerprint } = found.entry;
  return {
    src: `${base}/${found.name}.${fingerprint}${ext}`,
    type: VIDEO_TYPES[ext],
  };
};

// Part of the home data's cache key, so a manifest edit or a new public
// address shows up without bumping HOME_DATA_VERSION.
export const mediaCacheKey = () =>
  JSON.stringify([
    manifest,
    videoManifest,
    imagesBaseUrl() ?? null,
    videosBaseUrl() ?? null,
  ]);
