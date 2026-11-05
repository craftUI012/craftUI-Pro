import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { codeToTokens } from "shiki";

import { isLivePreview } from "@/constants/live-previews";
import { showReels } from "@/lib/flags";
import { isSpecName, readSpec } from "@/reels/specs";
import type { CodeTokens } from "@/reels/video/reel";
import { ReelHost } from "@/reels/video/reel-host";

// A whole video as one page: /reels/video?spec=<name>. Dev only. Open it to
// watch the video play; `pnpm video <name>` (or Studio's Render video)
// films this same page frame by frame into reels/out/<name>.mp4.

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Reel",
};

const VideoPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ spec?: string }>;
}) => {
  const { spec: name = "" } = await searchParams;
  if (!showReels || !isSpecName(name)) {
    notFound();
  }
  const spec = await readSpec(name).catch(() => null);
  if (!spec || !isLivePreview(spec.item)) {
    notFound();
  }
  // Code shots, highlighted here so the page ships tokens, not shiki.
  const code: Record<number, CodeTokens> = {};
  for (const [index, shot] of spec.shots.entries()) {
    if (shot.kind === "code") {
      const { tokens } = await codeToTokens(shot.code, {
        lang: shot.lang,
        theme:
          spec.theme === "dark"
            ? "github-dark-default"
            : "github-light-default",
      });
      code[index] = tokens.map((line) =>
        line.map((t) => ({ color: t.color, content: t.content }))
      );
    }
  }
  return <ReelHost code={code} spec={spec} />;
};

export default VideoPage;
