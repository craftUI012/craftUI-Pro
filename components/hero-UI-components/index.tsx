import { ComponentsCta } from "@/components/hero-UI-components/components-cta";
import { STRIP_COMPONENTS } from "@/components/hero-UI-components/components-data";
import { ComponentsStrip } from "@/components/hero-UI-components/components-strip";
import { RHYTHM } from "@/constants/rhythm";
import { TYPE } from "@/constants/typography";
import { readCssTokens } from "@/lib/css-tokens";
import { cn } from "@/lib/utils";

// Server entry for the UI components showcase: header, one draggable row of
// real-size components (with its scroll bar and paging buttons), CTA. The header and CTA sit in the page container; the strip is
// full-bleed so it can run off both edges.
//
// Rhythm: minor inside the header text, major between header > strip > CTA,
// section padding = 2 x major.
// CTA placement follows the device, as in the blocks section: beside the
// header from md up, full-width under the strip on phones.
export const UIComponentsSection = async () => {
  // Token values as written in globals.css, for each tile's Tokens overlay.
  const tokenSource = await readCssTokens(
    STRIP_COMPONENTS.flatMap((item) => item.tokens.map((token) => token.name))
  );

  return (
    <section
      aria-labelledby="components-heading"
      className={cn("flex flex-col", RHYTHM.major, RHYTHM.section)}
    >
      <div className="container-wrapper">
        <header
          className={cn(
            "container flex flex-col md:flex-row md:items-end md:justify-between",
            RHYTHM.major
          )}
        >
          <div className={cn("flex max-w-2xl flex-col", RHYTHM.minor)}>
            <span
              className={cn(
                TYPE.cardEyebrow,
                "text-muted-foreground uppercase"
              )}
            >
              Components
            </span>
            <h2
              id="components-heading"
              className={cn(TYPE.headingSection, "text-balance")}
            >
              The pieces behind every block
            </h2>
            <p
              className={cn(TYPE.pageLead, "text-muted-foreground text-pretty")}
            >
              Every block is made from these components, and every component
              reads from the same design tokens.
            </p>
          </div>
          <ComponentsCta className="hidden shrink-0 md:inline-flex" />
        </header>
      </div>

      <ComponentsStrip
        alignToId="components-heading"
        tokenSource={tokenSource}
      />

      <div className="container-wrapper md:hidden">
        <div className="container">
          <ComponentsCta className="w-full" />
        </div>
      </div>
    </section>
  );
};
