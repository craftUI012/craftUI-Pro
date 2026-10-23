import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { SITE } from "@/constants/site";

// The 1200 × 630 social card shared by /og (site and app pages) and
// /og/docs/... (one per docs page). The mark is the PNG from
// `pnpm brand:icons`: Satori, which draws these, can't render the SVG's blur.

export const OG_SIZE = { height: 630, width: 1200 } as const;

const MARK_PATH = join(process.cwd(), "public/logo/logo-mark-256.png");

// Read once per server instance, then reused for every card.
let markSrc: string | undefined;
const loadMark = async () => {
  if (!markSrc) {
    const file = await readFile(MARK_PATH);
    markSrc = `data:image/png;base64,${file.toString("base64")}`;
  }
  return markSrc;
};

// Long text is cut at a word so the card never overflows its frame (three
// lines of description fit).
const clip = (text: string, max: number) => {
  if (text.length <= max) {
    return text;
  }
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,.;:]$/, "")}…`;
};

export const renderOgImage = async ({
  description,
  title,
}: {
  description: string;
  title: string;
}) => {
  const mark = await loadMark();

  return new ImageResponse(
    <div tw="flex h-full w-full bg-black text-white">
      <div tw="flex border absolute border-stone-700 border-dashed inset-y-0 left-16 w-[1px]" />
      <div tw="flex border absolute border-stone-700 border-dashed inset-y-0 right-16 w-[1px]" />
      <div tw="flex border absolute border-stone-700 inset-x-0 h-[1px] top-16" />
      <div tw="flex border absolute border-stone-700 inset-x-0 h-[1px] bottom-16" />
      <div tw="flex absolute flex-row items-center bottom-24 right-24 text-white">
        {/* oxlint-disable-next-line nextjs/no-img-element -- Satori draws plain <img>. */}
        <img src={mark} width={56} height={56} alt="" />
        <div
          tw="ml-4 text-[32px] text-stone-200"
          style={{ fontWeight: 600, letterSpacing: "-0.02em" }}
        >
          {SITE.NAME}
        </div>
      </div>
      <div tw="flex flex-col absolute w-[896px] justify-center inset-32">
        <div
          tw="tracking-tight flex-grow-1 flex flex-col justify-center leading-[1.1]"
          style={{
            fontSize: title.length > 20 ? 64 : 80,
            fontWeight: 600,
            letterSpacing: "-0.04em",
            textWrap: "balance",
          }}
        >
          {clip(title, 70)}
        </div>
        <div
          tw="text-[40px] leading-[1.5] flex-grow-1 text-stone-400"
          style={{
            fontWeight: 500,
            textWrap: "balance",
          }}
        >
          {clip(description, 120)}
        </div>
      </div>
    </div>,
    OG_SIZE
  );
};
