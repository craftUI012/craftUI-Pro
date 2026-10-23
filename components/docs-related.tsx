import { BrowseCard } from "@/components/new-hero-section/browse/browse-card";
import { getRelatedItems } from "@/components/new-hero-section/data/related-items";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Server component. "More like …" under a docs page: the same cards as the
// home page grid (screenshots, video cards and all), ranked by shared browse
// tags (see related-items.ts). Named after the page's card when it shows one
// component, after the page when it holds several (the hero variants).
// Renders nothing for pages that aren't a browse item.
export const DocsRelated = async ({
  pageTitle,
  url,
}: {
  pageTitle: string;
  url: string;
}) => {
  const { items, own } = await getRelatedItems(url);
  if (items.length === 0) {
    return null;
  }
  const name = own.length === 1 ? own[0].name : pageTitle;

  return (
    <section
      aria-labelledby="more-like-this"
      className="flex flex-col gap-6 pt-12 lg:pt-16"
    >
      <h2
        id="more-like-this"
        className={cn(TYPE.headingPanel, "text-foreground")}
      >
        More like {name}
      </h2>
      <ul className="grid grid-cols-1 gap-x-5 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <li key={item.id}>
            <BrowseCard item={item} />
          </li>
        ))}
      </ul>
    </section>
  );
};
