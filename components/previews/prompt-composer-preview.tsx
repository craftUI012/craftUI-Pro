"use client";

import { PromptComposer } from "@/registry/components/prompt-composer";

// The composer alone, centred on a quiet app canvas.
const PromptComposerPreview = () => (
  <div className="h-[640px] w-full sm:h-[680px]">
    <PromptComposer />
  </div>
);

export default PromptComposerPreview;
