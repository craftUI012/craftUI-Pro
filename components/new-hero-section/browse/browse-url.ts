import type { BrowseSelection } from "@/components/new-hero-section/browse/browse-filters";
import type { LibraryTab } from "@/components/new-hero-section/browse/browse-top-bar";
import { FILTER_GROUPS } from "@/constants/taxonomy";
import type { LibraryId } from "@/constants/taxonomy";

// The browse page's state in its URL, so a filtered view can be shared,
// survives a refresh, and is back when returning from a docs page:
//
//   /?library=blocks&category=marketing,company&type=charts&style=motion
//
// `library` is left out for the default (first) tab, and each group's key is
// its `param` in constants/taxonomy.ts. Only the active library's picks are
// in the URL. Values the library doesn't offer (or has no items for) are
// ignored, so a stale link degrades to a wider view instead of an empty one.
// Other query params (utm_* and so on) are kept as they are.

const LIBRARY_PARAM = "library";
const OWN_PARAMS = [
  LIBRARY_PARAM,
  ...FILTER_GROUPS.map((group) => group.param),
];

// The library and selection a URL asks for, or null when it has none of the
// browse params.
export const parseBrowseSearch = (
  search: string,
  libraries: LibraryTab[],
  defaultLibrary: LibraryId
): { library: LibraryId; selection: BrowseSelection } | null => {
  const params = new URLSearchParams(search);
  if (!OWN_PARAMS.some((param) => params.has(param))) {
    return null;
  }
  const library =
    libraries.find((item) => item.slug === params.get(LIBRARY_PARAM)) ??
    libraries.find((item) => item.id === defaultLibrary);
  if (!library) {
    return null;
  }

  const selection: BrowseSelection = {};
  for (const group of FILTER_GROUPS) {
    const offered = library.filters[group.id] ?? [];
    const values = [
      ...new Set((params.get(group.param) ?? "").split(",")),
    ].filter((value) => offered.includes(value));
    if (values.length > 0) {
      selection[group.id] = values;
    }
  }
  return { library: library.id, selection };
};

// The search string ("" or "?…") for a library and its selection, on top of
// whatever other params `currentSearch` has.
export const browseSearch = (
  currentSearch: string,
  library: LibraryId,
  selection: BrowseSelection,
  libraries: LibraryTab[],
  defaultLibrary: LibraryId
) => {
  const others = new URLSearchParams(currentSearch);
  for (const param of OWN_PARAMS) {
    others.delete(param);
  }

  // Slugs are [a-z0-9-], so they're joined with a literal "," (which
  // URLSearchParams would escape as %2C).
  const own: string[] = [];
  const slug = libraries.find((item) => item.id === library)?.slug;
  if (library !== defaultLibrary && slug) {
    own.push(`${LIBRARY_PARAM}=${encodeURIComponent(slug)}`);
  }
  for (const group of FILTER_GROUPS) {
    const values = selection[group.id] ?? [];
    if (values.length > 0) {
      own.push(
        `${group.param}=${values.map((value) => encodeURIComponent(value)).join(",")}`
      );
    }
  }

  const query = [...own, others.toString()].filter(Boolean).join("&");
  return query ? `?${query}` : "";
};
