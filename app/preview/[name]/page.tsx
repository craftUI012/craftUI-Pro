import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LIVE_PREVIEW_COMPONENTS } from "@/components/live-preview-components";
import { PreviewSizeReporter } from "@/components/preview-size-reporter";
import { isLivePreview, LIVE_PREVIEWS } from "@/constants/live-previews";
import { PREVIEW_MOTION_SCRIPT } from "@/lib/preview-motion";

// One registry item alone, for the docs preview box's iframe
// (components/preview-iframe.tsx). Outside the (app) group, so there's no
// site header or footer: the page is the item at the width of the iframe,
// which is the device width picked in the preview toolbar, and it reports its
// height so the box can fit it. Not indexed, and not counted as a visit
// (components/analytics.tsx skips pages inside an iframe).
//
// The toolbar's reduced-motion switch loads it with ?motion=reduce (or
// full): PREVIEW_MOTION_SCRIPT, first in the page, sets that up before the
// item's code runs (lib/preview-motion.ts). Without the parameter it does
// nothing, so the page stays static.

export const dynamicParams = false;

export const generateStaticParams = () =>
  LIVE_PREVIEWS.map((name) => ({ name }));

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Component preview",
};

const ComponentPreviewPage = async ({
  params,
}: {
  params: Promise<{ name: string }>;
}) => {
  const { name } = await params;

  if (!isLivePreview(name)) {
    notFound();
  }

  const Item = LIVE_PREVIEW_COMPONENTS[name];

  return (
    <>
      <script
        // Our own constant, not user input: the reduced-motion shim.
        // oxlint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: PREVIEW_MOTION_SCRIPT }}
      />
      {/* Devices don't show a desktop scrollbar; hide it in the preview. */}
      <style>{`html{scrollbar-width:none}html::-webkit-scrollbar{display:none}`}</style>
      <PreviewSizeReporter>
        <main className="bg-background text-foreground">
          <Item />
        </main>
      </PreviewSizeReporter>
    </>
  );
};

export default ComponentPreviewPage;
