import type { ReactNode } from "react";

import { ComponentSource } from "@/components/component-source";
import { Paywall } from "@/components/paywall";
import { PreviewFrame } from "@/components/preview-frame";
import {
  getDemoSource,
  getRegistrySource,
  getRegistryItemMeta,
  getRegistryItemTitle,
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
  // A pro item (registry.json's `meta.pro`) never reveals its source, even
  // when the file exists in this repo: the Code tab shows the paywall
  // instead. Everything else falls back to the real source, if any.
  const isPro = name ? getRegistryItemMeta(name)?.pro === true : false;
  const code = isPro ? null : await readSource({ name, src });
  const showSource = Boolean(code);

  let sourceSlot: ReactNode = null;

  if (isPro) {
    sourceSlot = (
      <div className="flex min-h-full items-center justify-center p-6">
        <Paywall
          className="w-full max-w-sm"
          description="This template's source is part of craftUI Pro. Get lifetime or yearly all-access."
          title="Unlock this template's source"
        />
      </div>
    );
  } else if (showSource) {
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
      copyValue={code}
      installName={name}
      locked={isPro}
      source={sourceSlot}
      title={title ?? (name ? getRegistryItemTitle(name) : undefined)}
    >
      {children}
    </PreviewFrame>
  );
};
