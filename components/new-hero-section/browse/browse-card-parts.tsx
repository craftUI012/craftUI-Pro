import Image from "next/image";

import type { ShowcaseItem } from "@/components/new-hero-section/data/home-types";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// The pieces BrowseCard and BrowseVideoCard share, so an image card and a
// video card look identical at rest.

// The card surface: bg-card insetting the 16:10 media by p-[6%] (percentage
// padding resolves against width on every side, so the inset is even all
// round and the card's height follows the screenshot). Lifts to
// shadow-card-hover on hover.
export const CARD_SURFACE =
  "bg-card shadow-card group-hover:shadow-card-hover group-focus-visible:ring-ring/50 rounded-3xl p-[6%] transition-shadow duration-200 ease-out group-focus-visible:ring-[3px]";

export const CARD_FRAME =
  "shadow-border relative aspect-[16/10] w-full overflow-hidden rounded-lg";

// The preview's rendered width: 88% of a card. Cards sit in a grid of 1/2/3
// columns (gap 20px) inside the container (padding 16/32px, max 1400px,
// 1536px from 1600px up). Keep in step with that layout; the R2 widths in
// constants/media.ts were picked from it.
const PREVIEW_SIZES = [
  "(min-width: 1600px) 420px",
  "(min-width: 1400px) 380px",
  "(min-width: 1024px) calc((100vw - 104px) * 0.293)",
  "(min-width: 640px) calc((100vw - 52px) * 0.44)",
  "calc((100vw - 32px) * 0.88)",
].join(", ");

// Fills the frame from the top, and grows a touch on card hover.
export const PREVIEW_CLASS =
  "object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transition-none";

// The card's screenshot. An R2 screenshot (srcSet set) is a plain <img> with
// its own AVIF widths, so Vercel's image optimizer never touches it; the
// blur shows underneath until it loads. A local placeholder goes through
// next/image.
export const PreviewImage = ({
  eager,
  preview,
}: {
  eager: boolean;
  preview: ShowcaseItem["preview"];
}) =>
  preview.srcSet ? (
    // oxlint-disable-next-line nextjs/no-img-element -- Pre-sized AVIFs on R2; next/image would re-optimize them on Vercel.
    <img
      src={preview.src}
      srcSet={preview.srcSet}
      sizes={PREVIEW_SIZES}
      alt={preview.alt}
      width={preview.width}
      height={preview.height}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      decoding="async"
      style={
        preview.blurDataURL
          ? {
              backgroundImage: `url("${preview.blurDataURL}")`,
              backgroundSize: "cover",
            }
          : undefined
      }
      className={cn("absolute inset-0 size-full", PREVIEW_CLASS)}
    />
  ) : (
    <Image
      src={preview.src}
      alt={preview.alt}
      fill
      sizes={PREVIEW_SIZES}
      placeholder={preview.blurDataURL ? "blur" : "empty"}
      blurDataURL={preview.blurDataURL}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : "auto"}
      className={PREVIEW_CLASS}
    />
  );

// The name and tagline under the card.
export const CardCaption = ({
  item,
}: {
  item: Pick<ShowcaseItem, "name" | "tagline">;
}) => (
  <div className="flex min-w-0 flex-col">
    <span className={cn(TYPE.cardHeader, "text-foreground")}>{item.name}</span>
    <span
      className={cn(TYPE.cardDescription, "text-muted-foreground truncate")}
    >
      {item.tagline}
    </span>
  </div>
);
