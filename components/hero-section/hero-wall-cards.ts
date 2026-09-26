import { APP_CARDS } from "@/components/design-admin/app-cards";
import { FINANCE_CARDS } from "@/components/design-admin/finance-cards";
import { HERO_CARDS_META } from "@/components/hero-section/hero-data";

// Resolves HERO_CARDS_META to the live kit components. Only imported by the
// lazily loaded wall, so none of this ships with the first paint.
const KIT_CARDS = [...FINANCE_CARDS, ...APP_CARDS];

export const HERO_CARDS = HERO_CARDS_META.map(({ id, uses }) => {
  const card = KIT_CARDS.find((item) => item.id === id);

  if (!card) {
    throw new Error(`Hero wall: no kit card with id "${id}"`);
  }

  return { ...card, uses };
});
