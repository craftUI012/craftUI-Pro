import { APP_CARDS } from "@/components/design-admin/app-cards";
import { FINANCE_CARDS } from "@/components/design-admin/finance-cards";

// Kit components by id. Only reached through a dynamic import in
// block-preview.tsx, so the kit (charts included) never ships with the first
// paint of the page.
const KIT_CARDS = [...FINANCE_CARDS, ...APP_CARDS];

export const findKitCard = (id: string) => {
  const card = KIT_CARDS.find((item) => item.id === id);

  if (!card) {
    throw new Error(`Blocks showcase: no kit card with id "${id}"`);
  }

  return card.Component;
};
