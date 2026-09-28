import { BlockCard } from "@/components/hero-blocks/block-card";
import { BlocksCta } from "@/components/hero-blocks/blocks-cta";
import { SHOWCASE_BLOCKS } from "@/components/hero-blocks/blocks-data";
import { RHYTHM } from "@/constants/rhythm";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Server entry for the blocks showcase: header, straight card grid, CTA.
//
// Grid: 1 column on phones, 2 from md, 3 from xl.
// Rhythm: minor inside a group (the header text, the cards of the grid),
// major between groups (header > grid > CTA), section padding = 2 x major.
// CTA placement follows the device: beside the header from md up (the eye
// finishes the heading and lands on it), full-width under the grid on phones
// (reached with a thumb after scrolling the cards).
export const BlocksSection = () => (
  <section aria-labelledby="blocks-heading" className="container-wrapper">
    <div
      className={cn("container flex flex-col", RHYTHM.major, RHYTHM.section)}
    >
      <header
        className={cn(
          "flex flex-col md:flex-row md:items-end md:justify-between",
          RHYTHM.major
        )}
      >
        <div className={cn("flex max-w-2xl flex-col", RHYTHM.minor)}>
          <span
            className={cn(TYPE.cardEyebrow, "text-muted-foreground uppercase")}
          >
            Blocks
          </span>
          <h2
            id="blocks-heading"
            className={cn(TYPE.headingSection, "text-balance")}
          >
            Start from a finished block
          </h2>
          <p className={cn(TYPE.pageLead, "text-muted-foreground text-pretty")}>
            Dashboards, forms, schedules and settings built from the same tokens
            as the rest of the kit. Drop one in and it matches your product
            without restyling.
          </p>
        </div>
        <BlocksCta className="hidden shrink-0 md:inline-flex" />
      </header>

      <ul
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
          RHYTHM.minor
        )}
      >
        {SHOWCASE_BLOCKS.map((block) => (
          <li key={block.id}>
            <BlockCard block={block} />
          </li>
        ))}
      </ul>

      <BlocksCta className="w-full md:hidden" />
    </div>
  </section>
);
