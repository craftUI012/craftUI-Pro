"use client";

import dynamic from "next/dynamic";

import { PAGE } from "@/reels/spec";
import type { VideoSpec } from "@/reels/spec";
import type { CodeTokens } from "@/reels/video/reel";

// Client only: the reel reads its iframe's document and, while recording,
// the virtual clock the recorder installs before any code runs.
const Reel = dynamic(
  async () => {
    const reel = await import("@/reels/video/reel");
    return reel.Reel;
  },
  {
    ssr: false,
  }
);

export const ReelHost = ({
  code,
  spec,
}: {
  code: Record<number, CodeTokens>;
  spec: VideoSpec;
}) => (
  <div data-reel-stage style={{ height: PAGE.height, width: PAGE.width }}>
    <Reel code={code} spec={spec} />
  </div>
);
