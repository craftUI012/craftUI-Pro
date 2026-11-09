import MosaicCard from "@/registry/blocks/mosaic-card";

// The card sits small in a quiet, muted canvas with room around it, like a
// photo on a gallery wall, and moves on by itself so the dissolve shows
// without a click.
const MosaicCardPreview = () => (
  <div className="flex justify-center bg-muted px-6 py-16 sm:px-12 sm:py-24 lg:py-28">
    <MosaicCard className="max-w-md" interval={4} nextLabel="Next principle" />
  </div>
);

export default MosaicCardPreview;
