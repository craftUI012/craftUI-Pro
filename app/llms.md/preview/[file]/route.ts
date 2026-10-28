import sharp from "sharp";

import {
  PREVIEW_IMAGE_FILE,
  previewImagePath,
} from "@/lib/agent-discovery/preview-image";
import { getCardScreenshot } from "@/lib/media";

// An item's screenshot as a JPEG, for AI agents (see
// lib/agent-discovery/preview-image.ts): /llms.md/preview/<item>.<fingerprint>.jpg

export const GET = async (
  request: Request,
  { params }: { params: Promise<{ file: string }> }
) => {
  const { file } = await params;
  const match = PREVIEW_IMAGE_FILE.exec(file);
  const shot = match ? getCardScreenshot(match[1]) : undefined;
  if (!(match && shot)) {
    return new Response("Not found", { status: 404 });
  }
  // An older screenshot's address: send it to the current one.
  if (shot.fingerprint !== match[2]) {
    const current = previewImagePath(match[1]) ?? "/";
    return Response.redirect(new URL(current, request.url), 307);
  }

  const source = await fetch(shot.src);
  if (!source.ok) {
    return new Response("Preview unavailable", { status: 502 });
  }
  const body = await sharp(Buffer.from(await source.arrayBuffer()))
    .jpeg({ chromaSubsampling: "4:4:4", mozjpeg: true, quality: 82 })
    .toBuffer();

  return new Response(new Uint8Array(body), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": "image/jpeg",
    },
  });
};
