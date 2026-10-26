// Plain values the admin panel's client forms and its server actions share
// (no server imports, so client components can use them).

// Every status a purchase can have: ours ("active", "refunded") and the
// subscription statuses Dodo sends. Only "active" grants access.
export const PURCHASE_STATUSES = [
  "active",
  "refunded",
  "cancelled",
  "expired",
  "on_hold",
  "past_due",
  "failed",
  "paused",
] as const;

export const PURCHASE_KINDS = ["lifetime", "yearly", "item"] as const;
