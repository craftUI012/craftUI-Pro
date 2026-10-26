// Display helpers for the admin panel.

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

export const formatDate = (date: Date | null | undefined) =>
  date ? dateFormat.format(date) : "—";

export const formatDateTime = (date: Date | null | undefined) =>
  date ? dateTimeFormat.format(date) : "—";

// "2026-10-26", for <input type="date">.
export const toDateInput = (date: Date | null | undefined) =>
  date ? date.toISOString().slice(0, 10) : "";

// Minor units (cents) in their currency, e.g. "$249.00".
export const formatMoney = (cents: number | null, currency: string | null) => {
  if (cents === null) {
    return "—";
  }
  try {
    return new Intl.NumberFormat("en-US", {
      currency: currency ?? "USD",
      style: "currency",
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency ?? ""}`.trim();
  }
};
