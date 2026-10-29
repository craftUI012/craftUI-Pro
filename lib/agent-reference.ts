import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { CATEGORIES, STYLES, TYPES } from "@/constants/taxonomy";
import type { TaxonomyValue } from "@/constants/taxonomy";
import reference from "@/content/agent-reference.json";
import { previewImagePath } from "@/lib/agent-discovery/preview-image";
import { getCardVideo } from "@/lib/media";

// The part of a docs page's Markdown that's for AI agents: how to install,
// import and configure the library item behind the page. Built from
// content/agent-reference.json, which `pnpm registry:build` regenerates from
// registry.json and each component's own types (scripts/agent-reference.mjs),
// so it follows the code without anyone writing it by hand.

interface Prop {
  name: string;
  type: string;
  optional: boolean;
  description: string;
  default?: string | null;
}

interface ItemReference {
  name: string;
  title: string;
  id: string | null;
  library: string;
  description: string;
  docs: string;
  component: string | null;
  import: string | null;
  extends?: string | null;
  paid: boolean;
  props: Prop[];
  types: { name: string; fields: Omit<Prop, "default">[] }[];
  dependencies: string[];
  registryDependencies: string[];
  files: string[];
  // The browse page's tags (slugs), and who it's for (registry.json meta).
  tags: { categories: string[]; styles: string[]; types: string[] };
  useCases: string[];
}

const items = Object.values(reference as Record<string, ItemReference>);

/** The reference for the item whose docs page is at `url`, if there is one. */
export const referenceFor = (url: string) =>
  items.find((item) => item.docs === url);

const labels = (pool: Record<string, TaxonomyValue>, slugs: string[]) =>
  slugs.map((slug) => pool[slug]?.label ?? slug).join(", ");

/** "Category: Marketing · Type: Hero · Style: Motion, Dark mode". */
const tagLine = (item: ItemReference, bold: boolean) =>
  (
    [
      ["Category", labels(CATEGORIES, item.tags.categories)],
      ["Type", labels(TYPES, item.tags.types)],
      ["Style", labels(STYLES, item.tags.styles)],
    ] as const
  )
    .filter(([, value]) => value)
    .map(([key, value]) => (bold ? `**${key}:** ${value}` : `${key}: ${value}`))
    .join(" · ");

/** Where to see it: the docs page, and the card's screenshot or video. */
const seeIt = (item: ItemReference) => {
  const image = previewImagePath(item.name);
  const video = getCardVideo(item.name);
  return {
    image: image ? `${SITE.URL}${image}` : undefined,
    links: [
      `[Live preview](${SITE.URL}${item.docs})`,
      ...(image ? [`[Screenshot](${SITE.URL}${image})`] : []),
      ...(video ? [`[Video](${video.src})`] : []),
    ].join(" · "),
  };
};

/**
 * The item's line in llms.txt, after its description: who it's for, its
 * tags and a screenshot, so an agent can shortlist without opening pages.
 */
export const indexNote = (docsPath: string) => {
  const item = referenceFor(docsPath);
  if (!item) {
    return "";
  }
  const { image } = seeIt(item);
  return [
    item.useCases.length > 0 ? ` Good for: ${item.useCases.join("; ")}.` : "",
    ` ${tagLine(item, false)}.`,
    image ? ` [Screenshot](${image})` : "",
  ].join("");
};

/** Who it's for, its tags and where to see it: what agents match on. */
const glanceMarkdown = (item: ItemReference) => {
  const { image, links } = seeIt(item);
  const lines = [
    ...(item.useCases.length > 0
      ? [`- **Good for:** ${item.useCases.join("; ")}`]
      : []),
    `- ${tagLine(item, true)}`,
    `- **See it:** ${links}`,
  ];
  return [
    `## At a glance\n\n${lines.join("\n")}`,
    ...(image ? [`![${item.title}](${image})`] : []),
  ].join("\n\n");
};

/** A table cell: no pipes or line breaks, which would break the row. */
const cell = (text: string) =>
  text.replaceAll("|", "\\|").replaceAll(/\s+/g, " ").trim() || "—";

const propsTable = (props: Prop[], withDefaults: boolean) => {
  const head = withDefaults
    ? "| Prop | Type | Default | Description |\n| --- | --- | --- | --- |"
    : "| Field | Type | Description |\n| --- | --- | --- |";
  const rows = props.map((prop) => {
    const name = `\`${prop.name}\`${prop.optional ? "" : " (required)"}`;
    const type = `\`${cell(prop.type)}\``;
    return withDefaults
      ? `| ${name} | ${type} | ${prop.default ? `\`${cell(prop.default)}\`` : "—"} | ${cell(prop.description)} |`
      : `| ${name} | ${type} | ${cell(prop.description)} |`;
  });
  return [head, ...rows].join("\n");
};

/** At a glance, Install, Usage, Props, Types and Files for an item. */
export const referenceMarkdown = (item: ItemReference) => {
  const installUrl = `${SITE.URL}/r/${item.name}.json`;
  const access = item.paid
    ? `This is a paid item${item.id ? ` (${item.id})` : ""}: the install needs a craftUI plan or a purchase of it. Signed in, the docs page gives your personal install command. Plans: ${SITE.URL}${ROUTES.PRICING}`
    : "Free to install.";
  const component = item.component ?? "Component";
  const sections = [
    glanceMarkdown(item),
    `## Install\n\n\`\`\`bash\npnpm dlx shadcn@latest add ${installUrl}\n\`\`\`\n\n${access}`,
  ];

  if (item.import) {
    sections.push(
      `## Usage\n\n\`\`\`tsx\nimport ${component} from "${item.import}";\n\nexport default function Page() {\n  return <${component} />;\n}\n\`\`\`\n\nWith no props it renders with demo content; pass your own through the props below.`
    );
  }

  if (item.props.length > 0) {
    const extra = item.extends
      ? `\n\nIt also accepts every \`<${item.extends}>\` attribute (\`className\`, \`id\`, \`aria-*\` and so on).`
      : "";
    sections.push(`## Props\n\n${propsTable(item.props, true)}${extra}`);
  }

  for (const type of item.types) {
    sections.push(
      `### \`${type.name}\`\n\n${propsTable(
        type.fields.map((field) => ({ ...field, default: null })),
        false
      )}`
    );
  }

  const files = item.files.map((file) => `- \`${file}\``).join("\n");
  const dependencies =
    item.dependencies.length > 0
      ? `\n\nnpm dependencies (installed for you): ${item.dependencies.map((dep) => `\`${dep}\``).join(", ")}.`
      : "\n\nNo npm dependencies beyond React and Tailwind CSS.";
  // Bare names are shadcn/ui primitives; full URLs are other registry items.
  const registryDependencies =
    item.registryDependencies.length > 0
      ? `\n\nshadcn/ui components it uses (the shadcn CLI adds any that are missing): ${item.registryDependencies.map((dep) => `\`${dep}\``).join(", ")}.`
      : "";
  sections.push(
    `## Files\n\nThe install adds:\n\n${files}${dependencies}${registryDependencies}`
  );

  return sections.join("\n\n");
};

/** MDX `{/* … *\/}` comments: notes for editors, never for readers. */
const MDX_COMMENT = /\{\/\*[\s\S]*?\*\/\}\s*/g;
/** A live preview: <ComponentPreview …>…</ComponentPreview> or self-closed. */
const PREVIEW =
  /<ComponentPreview\b[^>]*?(?:\/>|>[\s\S]*?<\/ComponentPreview>)\s*/g;

/**
 * A docs page's Markdown body, for agents: editor comments removed, and
 * the live preview (meaningless outside the site) replaced by the item's
 * reference, or the reference added at the end if the page has no preview.
 */
export const agentBody = (url: string, body: string) => {
  const cleaned = body.replaceAll(MDX_COMMENT, "");
  const item = referenceFor(url);
  if (!item) {
    return cleaned.replaceAll(PREVIEW, "").replaceAll(/\n{3,}/g, "\n\n");
  }
  const block = `${referenceMarkdown(item)}\n\n`;
  let placed = false;
  const replaced = cleaned.replaceAll(PREVIEW, () => {
    if (placed) {
      return "";
    }
    placed = true;
    return block;
  });
  const out = placed ? replaced : `${replaced.trimEnd()}\n\n${block}`;
  return (
    out
      // A heading left with nothing under it (the preview was its content).
      .replaceAll(/^#{2,6} [^\n]*\n+(?=## At a glance\n)/gm, "")
      .replaceAll(/\n{3,}/g, "\n\n")
      .trim()
  );
};
