import { SITE } from "@/constants/site";
import { renderOgImage } from "@/seo/og-image";

// The site's default social card, and any page's card via ?title=&description=.
// The default shows the meta description's first sentence, which fits the
// card whole.
const DEFAULT_DESCRIPTION = `${SITE.DESCRIPTION.META.split(". ")[0]}.`;

export const GET = (request: Request) => {
  const { searchParams } = new URL(request.url);

  return renderOgImage({
    description: searchParams.get("description") || DEFAULT_DESCRIPTION,
    title: searchParams.get("title") || SITE.NAME,
  });
};
