import SwapGrid from "@/registry/blocks/swap-grid";

// The grid sits on a quiet, muted canvas with room around it, like work on
// a gallery wall, at the width of a page's content column.
const SwapGridPreview = () => (
  <div className="bg-muted px-4 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-20">
    <SwapGrid className="mx-auto max-w-6xl" />
  </div>
);

export default SwapGridPreview;
