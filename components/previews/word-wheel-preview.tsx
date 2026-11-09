import WordWheel from "@/registry/blocks/word-wheel";

// The block is a headline meant to sit in a page's hero, so the docs
// preview gives it a hero's margins instead of running it edge to edge.
const WordWheelPreview = () => (
  <div className="bg-background px-6 py-16 sm:px-12 sm:py-20 lg:px-20 lg:py-24">
    <WordWheel />
  </div>
);

export default WordWheelPreview;
