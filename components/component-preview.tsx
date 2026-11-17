import type { ReactNode } from "react";

import { ComponentSource } from "@/components/component-source";
import { PaidSource } from "@/components/paid-source";
import { PreviewFrame } from "@/components/preview-frame";
import { isLivePreview } from "@/constants/live-previews";
import { ROUTES } from "@/constants/routes";
import { readItemA11y } from "@/lib/item-a11y";
import {
  getDemoSource,
  getRegistryItem,
  getRegistryItemMeta,
  getRegistryItemTitle,
  getRegistrySource,
  isPaidItem,
  readOptionalFromRoot,
} from "@/lib/registry";

// The code ComponentSource would show for this name/src (demo first, then
// the registry file), or null. Checked ahead of time so the frame only shows
// the Preview/Code toggle when there's real code behind it (most mock items
// have none yet); it's also what the toolbar's "Copy for AI" copies.
const readSource = async ({ name, src }: { name?: string; src?: string }) => {
  if (name) {
    return (await getDemoSource(name)) ?? (await getRegistrySource(name));
  }

  if (src) {
    return await readOptionalFromRoot(src);
  }

  return null;
};

export const ComponentPreview = async ({
  name,
  src,
  title,
  children,
}: {
  name?: string;
  src?: string;
  title?: string;
  children?: ReactNode;
}) => {
  // A paid item (every library item without `meta.free`) never puts its
  // source in the page, even though the file is in this repo: its Code view
  // (PaidSource) shows the plans, or fetches the source for its owner.
  // Free items show their real source, if any.
  const paid = name ? isPaidItem(name) : false;
  const itemId = name ? getRegistryItemMeta(name)?.id : undefined;
  const itemTitle = title ?? (name ? getRegistryItemTitle(name) : undefined);
  const code = paid ? null : await readSource({ name, src });
  // A live item (constants/live-previews.ts) runs in an iframe of its own
  // page, so the toolbar's device widths switch its breakpoints too; the
  // children are then only what the MDX shows and aren't rendered here.
  const live = name !== undefined && isLivePreview(name);
  // The Accessibility view, for items with notes (registry meta.a11y).
  // (Typed from registry.json, which only has the field once an item does.)
  const a11y = name
    ? readItemA11y(
        (getRegistryItem(name)?.meta as { a11y?: unknown } | undefined)?.a11y
      )
    : null;

  let sourceSlot: ReactNode = null;

  if (paid && name) {
    sourceSlot = <PaidSource itemId={itemId} name={name} title={itemTitle} />;
  } else if (code) {
    sourceSlot = (
      <ComponentSource
        collapsible={false}
        name={name}
        src={src}
        title={title}
      />
    );
  }

  return (
    <PreviewFrame
      a11y={a11y}
      copyValue={code}
      installName={name}
      itemId={itemId}
      paid={paid}
      previewSrc={live ? `${ROUTES.COMPONENT_PREVIEW}/${name}` : undefined}
      source={sourceSlot}
      title={itemTitle}
    >
      {live ? null : children}
    </PreviewFrame>
  );
};
