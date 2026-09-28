import Image from "next/image";
import Link from "next/link";

import type { ShowcaseItem } from "@/components/new-hero-section/data/home-types";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Grid width → card width → the preview sits at 81% of it.
const PREVIEW_SIZES =
  "(min-width: 1400px) 26rem, (min-width: 1024px) 27vw, (min-width: 640px) 40vw, 81vw";

const ItemIcon = ({ icon }: Pick<ShowcaseItem, "icon">) => (
  <span className="bg-primary text-primary-foreground shadow-button-primary relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl">
    {icon.src ? (
      <Image src={icon.src} alt="" fill sizes="3rem" className="object-cover" />
    ) : (
      <span aria-hidden className={TYPE.headingPanel}>
        {icon.glyph}
      </span>
    )}
  </span>
);

// Server component. One card, as on Mobbin: a large rounded surface with the
// screenshot centred inside, then the icon, name and tagline below. The whole
// card is one link. Card tokens: bg-card + shadow-card, lifting to
// shadow-card-hover on hover.
//
// `eager` is set for the first row of the first tab only; those previews are on
// the first screen, so they load right away at high priority. The rest load
// lazily as they scroll in (and not at all while their tab is hidden).
export const BrowseCard = ({
  eager = false,
  item,
}: {
  eager?: boolean;
  item: ShowcaseItem;
}) => (
  <Link
    href={item.href}
    className="group flex flex-col gap-4 rounded-3xl outline-none"
  >
    <div className="bg-card shadow-card group-hover:shadow-card-hover group-focus-visible:ring-ring/50 flex aspect-[6/5] items-center justify-center rounded-3xl transition-shadow duration-200 ease-out group-focus-visible:ring-[3px]">
      <div className="shadow-border relative aspect-[16/10] w-[81%] overflow-hidden rounded-lg">
        <Image
          src={item.preview.src}
          alt={item.preview.alt}
          fill
          sizes={PREVIEW_SIZES}
          placeholder={item.preview.blurDataURL ? "blur" : "empty"}
          blurDataURL={item.preview.blurDataURL}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : "auto"}
          className="object-cover object-top transition-transform duration-300 ease-out group-hover:scale-[1.02] motion-reduce:transition-none"
        />
      </div>
    </div>
    <div className="flex min-w-0 items-center gap-3">
      <ItemIcon icon={item.icon} />
      <div className="flex min-w-0 flex-col">
        <span className={cn(TYPE.cardHeader, "text-foreground")}>
          {item.name}
        </span>
        <span
          className={cn(TYPE.cardDescription, "text-muted-foreground truncate")}
        >
          {item.tagline}
        </span>
      </div>
    </div>
  </Link>
);
