"use client";

import { PromptComposer } from "@/registry/components/prompt-composer";

// The composer alone, centred on a quiet app canvas. The canvas lives here,
// not in the component: the shipped prompt-composer stays transparent so it
// takes on whatever background the host app already has.
const PromptComposerPreview = () => (
  <div className="h-screen w-full bg-background">
    <PromptComposer />
  </div>
);

export default PromptComposerPreview;
