"use client";

import { useEffect, useState } from "react";

import { CopyButton } from "@/components/copy-button";
import { getIconForLanguageExtension } from "@/components/icons";
import { Paywall } from "@/components/paywall";
import { loadItemSource, useAccess } from "@/hooks/use-access";

// A paid item's Code view. Its source is never in the page: owners get it
// from /api/source once access is confirmed; everyone else sees the plans.
// The code block matches ComponentSource's (component-source.tsx), which
// free items use.
export const PaidSource = ({
  itemId,
  name,
  title,
}: {
  itemId?: string;
  name: string;
  title?: string;
}) => {
  const access = useAccess();
  const unlocked = access.ready && access.canUse(itemId);
  const [source, setSource] = useState<{ code: string; html: string } | null>(
    null
  );

  useEffect(() => {
    if (!unlocked) {
      return;
    }
    let current = true;
    const load = async () => {
      const loaded = await loadItemSource(name);
      if (current) {
        setSource(loaded);
      }
    };
    load();
    return () => {
      current = false;
    };
  }, [name, unlocked]);

  if (!access.ready || (unlocked && !source)) {
    return <div aria-busy="true" className="min-h-full" />;
  }

  if (!unlocked || !source) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <Paywall
          className="w-full max-w-xl"
          description="Get every section, block and template with lifetime or yearly all-access."
          signedIn={access.signedIn}
          title={title ? `Unlock ${title}` : "Unlock this item"}
        />
      </div>
    );
  }

  return (
    <div className="relative">
      <figure data-rehype-pretty-code-figure="" className="[&>pre]:max-h-96">
        <figcaption
          className="text-code-foreground flex items-center gap-2 [&_svg]:size-4 [&_svg]:opacity-70"
          data-language="tsx"
          data-rehype-pretty-code-title=""
        >
          {getIconForLanguageExtension("tsx")}
          {title}
        </figcaption>
        <CopyButton event="copy_primitive_code" value={source.code} />
        {/* Our own Shiki output from /api/source. */}
        <div dangerouslySetInnerHTML={{ __html: source.html }} />
      </figure>
    </div>
  );
};
