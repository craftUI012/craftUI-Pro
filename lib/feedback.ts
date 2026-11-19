// The pricing page's exit survey (components/pricing-survey.tsx): its
// answers, shared by the dialog, the API that stores them
// (app/api/feedback) and the admin panel's Feedback page. Safe on the
// client: no server imports.
//
// Change a label freely. Change a value only with a migration: stored
// documents (lib/db/schema.ts → FeedbackDoc) keep the old values.

export const WANT_MORE = [
  { label: "Sections", value: "sections" },
  { label: "Blocks", value: "blocks" },
  { label: "UI components", value: "components" },
] as const;

export const OPINIONS = [
  { label: "Too pricey", value: "too_pricey" },
  { label: "Quality isn't there yet", value: "quality" },
  { label: "Not useful for my work", value: "not_useful" },
] as const;

// What opened the survey: the pointer leaving the page toward the tabs
// (desktop), or coming back to /pricing from Dodo's checkout unpaid.
export const SURVEY_TRIGGERS = [
  "exit_intent",
  "returned_from_checkout",
] as const;

export type WantMore = (typeof WANT_MORE)[number]["value"];
export type Opinion = (typeof OPINIONS)[number]["value"];
export type SurveyTrigger = (typeof SURVEY_TRIGGERS)[number];

export const WANT_MORE_VALUES = WANT_MORE.map((option) => option.value) as [
  WantMore,
  ...WantMore[],
];
export const OPINION_VALUES = OPINIONS.map((option) => option.value) as [
  Opinion,
  ...Opinion[],
];

const labels = new Map<string, string>(
  [...WANT_MORE, ...OPINIONS].map((option) => [option.value, option.label])
);

// "too_pricey" → "Too pricey"; an unknown (older) value shows as itself.
export const feedbackLabel = (value: string) => labels.get(value) ?? value;

// Set when someone leaves for Dodo's checkout (components/checkout-button),
// read when /pricing shows again: the survey's "came back unpaid" trigger.
export const CHECKOUT_LEFT_KEY = "checkout-left-at";

// Fired on window by the checkout button while it's sending someone to
// Dodo (detail: true) and when that ends without leaving (false), so the
// survey never opens on a buyer mid-checkout.
export const CHECKOUT_BUSY_EVENT = "craftui:checkout-busy";
