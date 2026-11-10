"use client";

import { PromptComposer } from "@/registry/components/prompt-composer";

// The composer alone, centred on a quiet app canvas. The canvas lives here,
// not in the component: the shipped prompt-composer stays transparent so it
// takes on whatever background the host app already has.
const PromptComposerPreview = () => (
  <div className="h-[640px] w-full bg-zinc-50 sm:h-[680px]">
    <PromptComposer />
  </div>
);

export default PromptComposerPreview;
