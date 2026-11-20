"use client";

import { createContext, useContext } from "react";

import type { CardBrand } from "./brand-marks";
import type { CardBook, SavedCard } from "./card-data";

/* ─────────────────────────────────────────────────────────
 * ACTIONS: every call that would reach your server, in one object.
 *
 * Pass your own to <BillingSettings actions={…}>; anything you leave out
 * falls back to the demo below, which waits a moment and succeeds (or,
 * for verifyCard, declines Stripe's test card 4000 0000 0000 0002).
 * Throw (reject) from any of them to show it failed.
 * ───────────────────────────────────────────────────────── */

export interface NewCard {
  /** Detected from the first digits. */
  brand: CardBrand;
  /** All digits, no spaces. Send it to your payment provider, not your server. */
  number: string;
  /** MM/YY */
  expires: string;
  /** The 3 or 4 digit security code. */
  cvc: string;
  /** Billing postcode. */
  postcode: string;
}

export interface BillingInfo {
  /** Where receipts go. */
  email: string;
  /** Company name printed on invoices. */
  company: string;
  /** Street address. */
  street: string;
  /** City and postcode, e.g. "San Francisco, CA 94105". */
  city: string;
  /** Country name. */
  country: string;
  /** VAT or tax number; empty shows "None added". */
  taxId: string;
}

export type WalletId = "paypal" | "apple" | "google";

export interface BillingActions {
  /** Save the cards, the default and the backup (the dialog's Save). */
  saveCards: (book: CardBook) => Promise<void>;
  /** Check a new card with the bank (3-D Secure) and save it. Reject to decline. */
  verifyCard: (card: NewCard) => Promise<void>;
  /** Retry a declined card. Return new details if the bank sent any, or {}. */
  retryCard: (card: SavedCard) => Promise<Partial<SavedCard>>;
  /** Save the billing details printed on invoices. */
  saveBilling: (info: BillingInfo) => Promise<void>;
  /** Download one invoice. */
  downloadInvoice: (id: string) => Promise<void>;
  /** Connect a wallet; resolve with the account it connected as. */
  connectWallet: (id: WalletId) => Promise<string>;
  /** Disconnect a wallet. */
  disconnectWallet: (id: WalletId) => Promise<void>;
}

const wait = async (ms: number) => {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const DEMO_ACCOUNTS: Record<WalletId, string> = {
  apple: "iPhone and Mac",
  google: "maya.chen@gmail.com",
  paypal: "maya@acme.co",
};

export const DEMO_ACTIONS: BillingActions = {
  connectWallet: async (id) => {
    await wait(1000);
    return DEMO_ACCOUNTS[id];
  },
  disconnectWallet: async () => {
    await wait(300);
  },
  downloadInvoice: async () => {
    await wait(900);
  },
  retryCard: async () => {
    await wait(1100);
    // The bank had issued new details: the retry goes through on them.
    return { expires: "08/31", updatedByBank: true };
  },
  saveBilling: async () => {
    await wait(700);
  },
  saveCards: async () => {
    await wait(800);
  },
  verifyCard: async (card) => {
    await wait(1200);
    if (card.number === "4000000000000002") {
      throw new Error("Your bank declined this card. Try another.");
    }
  },
};

const BillingActionsContext = createContext<BillingActions>(DEMO_ACTIONS);

export const BillingActionsProvider = BillingActionsContext.Provider;

export const useBillingActions = () => useContext(BillingActionsContext);
