// Server component. The gradient mask around the copy: a pool of background
// color, feathered with a wide radial mask, so the image wall dissolves under
// the text instead of stopping at an edge. Copy and images read as one
// surface. It lives inside the moving block, so it travels with the text.
export const HeroFog = () => (
  <div
    aria-hidden
    className="bg-background pointer-events-none absolute -inset-x-32 -inset-y-24 -z-10 mask-ease-radial lg:-inset-x-64 lg:-inset-y-48"
  />
);
