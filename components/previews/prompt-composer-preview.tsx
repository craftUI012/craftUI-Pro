"use client";

import { PromptComposer } from "@/registry/components/prompt-composer";

// The composer where it lives: a full app canvas with the input capsule
// anchored at the bottom and the running-agents panel on the right.
const PromptComposerPreview = () => (
  <div className="h-[640px] w-full sm:h-[680px]">
    <PromptComposer />
  </div>
);

export default PromptComposerPreview;
