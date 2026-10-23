import Link from "next/link";

import {
  CARD_FRAME,
  CARD_SURFACE,
  CardCaption,
  PreviewImage,
} from "@/components/new-hero-section/browse/browse-card-parts";
import { BrowseVideoCard } from "@/components/new-hero-section/browse/browse-video-card";
import type { ShowcaseItem } from "@/components/new-hero-section/data/home-types";

// Server component. One card, as on Mobbin: a large rounded surface with the
// screenshot inset evenly inside, then the name and tagline below. The whole
// card is one link. An item with a video (content/video-manifest.json) gets
// BrowseVideoCard instead: the same card, plus hover-to-play and a scrub
// ruler.
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
}) =>
  item.video ? (
    <BrowseVideoCard eager={eager} item={item} video={item.video} />
  ) : (
    <Link
      href={item.href}
      className="group flex flex-col gap-4 rounded-3xl outline-none"
    >
      <div className={CARD_SURFACE}>
        <div className={CARD_FRAME}>
          <PreviewImage eager={eager} preview={item.preview} />
        </div>
      </div>
      <CardCaption item={item} />
    </Link>
  );
