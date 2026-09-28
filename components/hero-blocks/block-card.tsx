import { BlockPreview } from "@/components/hero-blocks/block-preview";
import type { SHOWCASE_BLOCKS } from "@/components/hero-blocks/blocks-data";
import { Badge } from "@/components/ui/badge";
import { RHYTHM } from "@/constants/rhythm";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Server component: the card frame and its text render on the server; only
// the preview well is a client island.
//
// Surfaces come from the theme tokens: bg-card with shadow-card at rest,
// lifting to shadow-card-hover (the floating elevation) on hover. Radii are concentric: the card is rounded-2xl (1rem)
// with a p-2 (0.5rem) inset, so the preview well is rounded-lg (0.5rem).
export const BlockCard = ({
  block,
}: {
  block: (typeof SHOWCASE_BLOCKS)[number];
}) => (
  <article className="bg-card flex flex-col rounded-2xl p-2 shadow-card transition-[box-shadow] duration-200 ease-out-strong hover:shadow-card-hover motion-reduce:transition-none">
    <BlockPreview id={block.id} />
    <div className={cn("flex flex-col px-3 py-minor", RHYTHM.minor)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className={cn(TYPE.cardHeader, "text-balance")}>{block.title}</h3>
        <span
          className={cn(TYPE.cardCaption, "text-muted-foreground shrink-0")}
        >
          {block.category}
        </span>
      </div>
      <ul className="flex flex-wrap gap-1.5" aria-label="Built with">
        {block.uses.map((use) => (
          <li key={use}>
            <Badge variant="outline">{use}</Badge>
          </li>
        ))}
      </ul>
    </div>
  </article>
);
