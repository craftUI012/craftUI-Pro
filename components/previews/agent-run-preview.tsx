import { AgentRun } from "@/registry/blocks/agent-run";

// The run sits in a quiet, muted canvas, the way it would in a chat
// thread, waiting for the visitor to press Run. The stage has a fixed
// height that fits the tallest state (the live call, Steps and one step's
// JSON open at once, about 31.5rem: steps open one at a time and the JSON
// scrolls past 15rem), and the card hangs from a fixed top edge: opening the
// live call, the steps or a step's JSON grows the card downward inside the
// stage, so the docs box around the iframe never changes height. min-h,
// not h, so a very narrow phone that wraps more still shows everything.
const AgentRunPreview = () => (
  <div className="bg-muted flex min-h-[36rem] items-start justify-center px-6 pt-12 sm:min-h-[38rem] sm:px-12 sm:pt-20">
    <AgentRun />
  </div>
);

export default AgentRunPreview;
