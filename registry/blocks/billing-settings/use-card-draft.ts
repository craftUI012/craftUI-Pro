"use client";

import { useState } from "react";

import type { CardBook, SavedCard } from "./card-data";
import type { CardEdit } from "./card-editor";

export type { CardBook } from "./card-data";

/* The dialog's draft: cards, the default, the backup. Nothing reaches
 * the page until Save; Cancel drops the whole draft. */

export interface Removed {
  card: SavedCard;
  index: number;
  wasBackup: boolean;
  /** Unique per removal, so a second removal restarts the toast. */
  key: number;
}

export const useCardDraft = (saved: CardBook) => {
  const [book, setBook] = useState(saved);
  const [removed, setRemoved] = useState<Removed | null>(null);

  const reset = (next: CardBook) => {
    setBook(next);
    setRemoved(null);
  };

  // Choosing a card makes it the default. If it was the backup, the
  // two swap roles: the old default becomes the backup, and the
  // Default and Backup pills cross on their way.
  const choose = (id: string) =>
    setBook((value) =>
      value.defaultId === id
        ? value
        : {
            ...value,
            backupId: value.backupId === id ? value.defaultId : value.backupId,
            defaultId: id,
          }
    );

  const remove = (id: string) => {
    const index = book.cards.findIndex((card) => card.id === id);
    const card = book.cards[index];
    if (!card || id === book.defaultId) {
      return;
    }
    setRemoved({
      card,
      index,
      key: Date.now(),
      wasBackup: book.backupId === id,
    });
    setBook((value) => ({
      ...value,
      backupId: value.backupId === id ? null : value.backupId,
      cards: value.cards.filter((each) => each.id !== id),
    }));
  };

  const undo = () => {
    if (!removed) {
      return;
    }
    setBook((value) => {
      const cards = [...value.cards];
      cards.splice(removed.index, 0, removed.card);
      return {
        ...value,
        backupId: removed.wasBackup ? removed.card.id : value.backupId,
        cards,
      };
    });
    setRemoved(null);
  };

  const add = (card: SavedCard) =>
    setBook((value) => ({ ...value, cards: [...value.cards, card] }));

  const update = (id: string, edit: CardEdit) =>
    setBook((value) => {
      let { backupId } = value;
      if (edit.backup) {
        backupId = id;
      } else if (backupId === id) {
        backupId = null;
      }
      return {
        ...value,
        backupId,
        cards: value.cards.map((card) =>
          card.id === id
            ? {
                ...card,
                expires: edit.expires,
                name: edit.name,
                nickname: edit.nickname || undefined,
                // A new date typed in by hand replaces the bank's.
                updatedByBank:
                  edit.expires === card.expires ? card.updatedByBank : false,
                // A new number is a new card: its brand and last four,
                // and the old card's decline no longer applies.
                ...(edit.number
                  ? {
                      brand: edit.number.brand,
                      declinedOn: undefined,
                      last4: edit.number.last4,
                    }
                  : {}),
              }
            : card
        ),
      };
    });

  // A declined card went through on retry: clear the decline, and take
  // whatever new details the bank sent (card account updater).
  const retried = (id: string, details: Partial<SavedCard> = {}) =>
    setBook((value) => ({
      ...value,
      cards: value.cards.map((card) =>
        card.id === id ? { ...card, ...details, declinedOn: undefined } : card
      ),
    }));

  return {
    add,
    book,
    choose,
    clearRemoved: () => setRemoved(null),
    remove,
    removed,
    reset,
    retried,
    undo,
    update,
  };
};
