import { MrrMovements } from "@/registry/blocks/mrr-movements";

// The month sits on a quiet, muted canvas, the way it would on a billing
// dashboard, at the width of a dashboard's main column. Its height never
// changes (the change card floats over the plot), so the docs box holds.
const MrrMovementsPreview = () => (
  <div className="bg-muted flex justify-center px-4 py-12 sm:px-12 sm:py-20">
    <MrrMovements />
  </div>
);

export default MrrMovementsPreview;
