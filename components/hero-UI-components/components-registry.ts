import { APP_CARDS } from "@/components/design-admin/app-cards";
import { FINANCE_CARDS } from "@/components/design-admin/finance-cards";
import { STRIP_COMPONENTS } from "@/components/hero-UI-components/components-data";

// Resolves the strip's placeholder ids to live kit components. Only reached
// through a dynamic import in components-strip.tsx, so none of this ships with
// the first paint.
const KIT_CARDS = [...FINANCE_CARDS, ...APP_CARDS];

export const STRIP_CARDS: Record<string, React.ComponentType> =
  Object.fromEntries(
    STRIP_COMPONENTS.map(({ id }) => {
      const card = KIT_CARDS.find((item) => item.id === id);

      if (!card) {
        throw new Error(`Components strip: no kit card with id "${id}"`);
      }

      return [id, card.Component];
    })
  );
