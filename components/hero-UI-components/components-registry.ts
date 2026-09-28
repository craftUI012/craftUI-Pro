import { STRIP_COMPONENTS } from "@/components/hero-UI-components/components-data";
import { STRIP_PIECES } from "@/components/hero-UI-components/strip-pieces";

// Resolves strip ids to their live examples. Only reached through a dynamic
// import in components-strip.tsx, so none of this (charts included) ships
// with the first paint.
export const STRIP_CARDS: Record<string, React.ComponentType> =
  Object.fromEntries(
    STRIP_COMPONENTS.map(({ id }) => {
      const piece = STRIP_PIECES[id];

      if (!piece) {
        throw new Error(`Components strip: no example for "${id}"`);
      }

      return [id, piece];
    })
  );
