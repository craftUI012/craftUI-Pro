import { BRAND_NAME } from "./brand-marks";
import type { CardBrand } from "./brand-marks";

/* Saved cards, their health, and the checks behind Add card. */

export interface SavedCard {
  /** Your id for the card (e.g. the payment provider's). */
  id: string;
  /** "visa", "mastercard" or "amex": picks the logo. */
  brand: CardBrand;
  /** The last four digits. */
  last4: string;
  /** MM/YY */
  expires: string;
  /** Name on the card. */
  name: string;
  /** A label you give it, e.g. "Company card". */
  nickname?: string;
  /** Who added it, shown in the card editor. */
  addedBy: string;
  /** When it was added, as you want it shown. */
  addedOn: string;
  /** The last charge failed on this date. */
  declinedOn?: string;
  /** The bank sent new details (card account updater). */
  updatedByBank?: boolean;
}

/** The cards, which one is charged, and which one is tried if it fails. */
export interface CardBook {
  /** Up to four saved cards, in the order they show. */
  cards: SavedCard[];
  /** Id of the card that's charged. */
  defaultId: string;
  /** Id of the card tried when the default fails, or null. */
  backupId: string | null;
}

export type Health = "declined" | "expired" | "updated" | "expiring" | "ok";

// The demo's today: 20 November 2026.
const NOW = { month: 11, year: 2026 };

export const monthsAway = (expires: string) => {
  const [mm, yy] = expires.split("/").map(Number);
  return ((yy ?? 0) + 2000 - NOW.year) * 12 + ((mm ?? 0) - NOW.month);
};

export const healthOf = (card: SavedCard): Health => {
  if (card.declinedOn) {
    return "declined";
  }
  if (monthsAway(card.expires) < 0) {
    return "expired";
  }
  if (card.updatedByBank) {
    return "updated";
  }
  return monthsAway(card.expires) <= 2 ? "expiring" : "ok";
};

/** The words under the number, one per health. */
export const statusLine = (card: SavedCard) =>
  ({
    declined: `Declined on ${card.declinedOn}`,
    expired: `Expired ${card.expires}`,
    expiring: `Expires soon, ${card.expires}`,
    ok: `Expires ${card.expires}`,
    updated: `Updated by your bank, expires ${card.expires}`,
  })[healthOf(card)];

export const describe = (card: SavedCard) =>
  `${BRAND_NAME[card.brand]} ending ${card.last4}`;

/** A card can be charged unless it has expired. */
export const canCharge = (card: SavedCard) => healthOf(card) !== "expired";

/* ── Add card ─────────────────────────────────────────── */

/** The brand from the first digits, as soon as they say it. */
export const detectBrand = (digits: string): CardBrand | null => {
  if (/^3[47]/.test(digits)) {
    return "amex";
  }
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) {
    return "mastercard";
  }
  if (digits.startsWith("4")) {
    return "visa";
  }
  return null;
};

export const numberLength = (brand: CardBrand | null) =>
  brand === "amex" ? 15 : 16;

/** 4242424242424242 → "4242 4242 4242 4242"; Amex groups 4-6-5. */
export const formatNumber = (digits: string, brand: CardBrand | null) => {
  const groups = brand === "amex" ? [4, 6, 5] : [4, 4, 4, 4];
  const parts: string[] = [];
  let at = 0;
  for (const size of groups) {
    if (at >= digits.length) {
      break;
    }
    parts.push(digits.slice(at, at + size));
    at += size;
  }
  return parts.join(" ");
};

/** The checksum every card number carries (Luhn). */
export const luhn = (digits: string) => {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index]);
    if (index % 2 === 1) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
  }
  return digits.length > 0 && sum % 10 === 0;
};

export const maskExpiry = (raw: string) => {
  const digits = raw.replaceAll(/\D/g, "").slice(0, 4);
  return digits.length > 2
    ? `${digits.slice(0, 2)}/${digits.slice(2)}`
    : digits;
};

export const expiryError = (value: string) => {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  const month = Number(match?.[1]);
  if (!match || month < 1 || month > 12) {
    return "Enter the date as MM/YY, like 04/29.";
  }
  if (monthsAway(value) < 0) {
    return "This date has passed. Use the date on your card.";
  }
  return null;
};
