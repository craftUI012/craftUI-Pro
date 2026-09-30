import type {
  HomeData,
  IndexGroup,
  ShowcaseItem,
} from "@/components/new-hero-section/data/home-types";
import { ROUTES } from "@/constants/routes";
import aiHero01 from "@/public/images/AIHero01.png";

// MOCK DATA, for layout only. Every card uses AIHero01.png for now. Replace
// it field by field with the building JSON (see the WHEN WE SHIP REAL DATA
// notes in home-types.ts).

const PREVIEW = {
  blurDataURL: aiHero01.blurDataURL,
  height: aiHero01.height,
  src: aiHero01.src,
  width: aiHero01.width,
};

const slug = (label: string) =>
  label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");

const group = (
  label: string,
  links: string[],
  columns: 1 | 2 = 1
): IndexGroup => ({
  columns,
  id: slug(label),
  label,
  links: links.map((link) => ({ id: slug(link), label: link })),
});

// Mock tagging: item i gets the i-th item of every index group (wrapping),
// plus a second style so multi-tag filtering has something to show. Real tags
// come from the registry (see ShowcaseItem.tags).
const tagItems = (index: IndexGroup[], list: ShowcaseItem[]) =>
  list.map((item, i) => ({
    ...item,
    tags: index.flatMap((g) => {
      const first = g.links[i % g.links.length];
      const second =
        g.id === "styles" ? g.links[(i + 2) % g.links.length] : undefined;
      return [first, second].flatMap((link) =>
        link ? [`${g.id}:${link.id}`] : []
      );
    }),
  }));

// [name, tagline, publishedAt, popularity]
type ItemSeed = [string, string, string, number];

const items = (base: string, seeds: ItemSeed[]): ShowcaseItem[] =>
  seeds.map(([name, tagline, publishedAt, popularity]) => ({
    href: `${base}/${slug(name)}`,
    icon: { glyph: name.slice(0, 1) },
    id: slug(name),
    name,
    popularity,
    preview: { ...PREVIEW, alt: `${name} preview` },
    publishedAt,
    tagline,
    tags: [],
  }));

const STYLES = ["Minimal", "Motion", "Sound & haptics", "Dark mode", "Dense"];

const RAW: HomeData = {
  feeds: [
    { id: "latest", label: "Latest" },
    { id: "popular", label: "Most popular" },
  ],
  libraries: [
    {
      id: "components",
      index: [
        group("Categories", [
          "Forms",
          "Data display",
          "Navigation",
          "Overlays",
          "Feedback",
        ]),
        group(
          "Primitives",
          [
            "Button",
            "Input",
            "Select",
            "Switch",
            "Slider",
            "Checkbox",
            "Radio group",
            "Toggle group",
            "Calendar",
            "Chart",
          ],
          2
        ),
        group("Styles", STYLES),
      ],
      itemLabel: { one: "component", other: "components" },
      items: items(`${ROUTES.DOCS}/components`, [
        [
          "Button",
          "Click sound, haptics and a brand shadow",
          "2026-09-20",
          940,
        ],
        [
          "Input",
          "Text entry with clear error and focus states",
          "2026-09-12",
          610,
        ],
        [
          "Select",
          "Native picker on mobile, custom on desktop",
          "2026-09-24",
          480,
        ],
        ["Switch", "On and off with full keyboard support", "2026-08-30", 720],
        ["Slider", "One thumb or two for a range", "2026-09-26", 390],
        ["Calendar", "Pick a date or a range of dates", "2026-09-02", 560],
      ]),
      label: "Components",
      searchPlaceholder: "Search components…",
    },
    {
      id: "blocks",
      index: [
        group("Categories", [
          "Finance",
          "Analytics",
          "Smart home",
          "Commerce",
          "Team",
        ]),
        group(
          "Sections",
          [
            "Hero",
            "Pricing",
            "FAQ",
            "Features",
            "Stats",
            "Dashboard",
            "Sign in",
            "Onboarding",
            "Settings",
            "Empty state",
          ],
          2
        ),
        group("Styles", STYLES),
      ],
      itemLabel: { one: "block", other: "blocks" },
      items: items(`${ROUTES.DOCS}/blocks`, [
        [
          "Savings over time",
          "Monthly contributions as a bar chart",
          "2026-09-18",
          830,
        ],
        [
          "Payment scheduler",
          "Upcoming payments on a calendar",
          "2026-09-25",
          510,
        ],
        [
          "Traffic by device",
          "Channel split with a bar chart",
          "2026-09-10",
          670,
        ],
        ["Team invites", "Invite people and set their role", "2026-09-22", 450],
        ["Account transfer", "Move money between accounts", "2026-09-05", 900],
        [
          "Lighting controls",
          "Switches and dimmers for each room",
          "2026-09-27",
          300,
        ],
      ]),
      label: "Blocks",
      searchPlaceholder: "Search blocks…",
    },
    {
      // Shown as "Sections": what's here today are page sections, not full
      // templates. The id (and the /docs/templates URLs) stay as they are.
      id: "templates",
      // No index yet: real content is 3 sections (see registry/new-york),
      // not enough to categorize meaningfully. Re-add groups once there's a
      // real spread of templates to filter.
      index: [],
      itemLabel: { one: "section", other: "sections" },
      items: items(`${ROUTES.DOCS}/templates`, [
        [
          "Hero section",
          "Full marketing hero with a data panel cluster",
          "2026-09-21",
          760,
        ],
        [
          "Benchmarks section",
          "Four comparison metrics, each its own chart form",
          "2026-09-14",
          620,
        ],
        [
          "Team section",
          "Clustered avatar grid with a synced detail list",
          "2026-09-08",
          410,
        ],
      ]),
      label: "Sections",
      searchPlaceholder: "Search sections…",
    },
  ],
};

export const HOME_MOCK: HomeData = {
  ...RAW,
  libraries: RAW.libraries.map((library) => ({
    ...library,
    items: tagItems(library.index, library.items),
  })),
};
