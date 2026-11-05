import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { getAdminSession } from "@/lib/admin/session";
import { showReels } from "@/lib/flags";
import { videoFile } from "@/lib/studio/render-jobs";

// Serves a rendered video from reels/out to the Studio, admins on a dev
// machine only. Byte ranges so the preview can seek; ?download=1 saves it.

const NAME = /^[a-z0-9-]+$/;
const RANGE = /^bytes=(\d*)-(\d*)$/;

const notFound = () => new Response("Not found", { status: 404 });

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ name: string }> }
) => {
  const { name } = await params;
  if (!showReels || !NAME.test(name) || !(await getAdminSession())) {
    return notFound();
  }

  const file = videoFile(name);
  let size: number;
  try {
    ({ size } = await stat(file));
  } catch {
    return notFound();
  }

  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-store",
    "Content-Type": "video/mp4",
  });
  if (new URL(request.url).searchParams.has("download")) {
    headers.set(
      "Content-Disposition",
      `attachment; filename="craftui-${name}.mp4"`
    );
  }

  const range = RANGE.exec(request.headers.get("range") ?? "");
  if (range) {
    const start = range[1]
      ? Number(range[1])
      : Math.max(0, size - Number(range[2]));
    const end =
      range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) {
      return new Response(null, {
        headers: { "Content-Range": `bytes */${size}` },
        status: 416,
      });
    }
    headers.set("Content-Length", String(end - start + 1));
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    const body = Readable.toWeb(createReadStream(file, { end, start }));
    return new Response(body as ReadableStream, { headers, status: 206 });
  }

  headers.set("Content-Length", String(size));
  const body = Readable.toWeb(createReadStream(file));
  return new Response(body as ReadableStream, { headers, status: 200 });
};
