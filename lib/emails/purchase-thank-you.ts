import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import type { PurchaseKind } from "@/lib/billing/plans";
import type { EmailTemplate } from "@/lib/emails/compose";

// The founder's direct address: the note is sent from it, replies go to it,
// and it's the one buyers are told to write to for setup help.
export const FOUNDER = {
  email: "nil@craftui.space",
  name: "Indranil",
} as const;

// What they bought, as the note says it: "the lifetime plan".
const purchaseLabel = (kind: PurchaseKind, itemTitle: string | null) => {
  if (kind === "lifetime") {
    return "the lifetime plan";
  }
  if (kind === "yearly") {
    return "the yearly plan";
  }
  return itemTitle ?? "your purchase";
};

// The buyer's first name from the name they gave at checkout, if it looks
// like a name (not empty, not an email address).
const firstNameOf = (name: string | null) => {
  const first = name?.trim().split(/\s+/)[0];
  return first && !first.includes("@") ? first : null;
};

// The thank-you note sent once per new purchase (lib/billing/dodo-webhook.ts),
// from the founder. Same frame as the sign-in email (lib/emails/compose.ts)
// but written as a personal letter: a greeting, the thanks, how to get in
// (pay first, then sign in with the same email), and the founder's own
// address for setup problems, with the offer of a short call. Signed by
// name. These are its default words, editable in the admin panel
// (/admin-panel-craft/emails).
export const purchaseThankYouTemplate: EmailTemplate = {
  buttonHref: "signInUrl",
  defaults: {
    button: `Sign in to ${SITE.NAME}`,
    footer: `You're getting this because you bought {{plan}} on ${SITE.NAME} with {{email}}. Just reply to this email to reach me.`,
    heading: `Thank you for trusting **${SITE.NAME}**`,
    intro: `Hi {{firstName}},\n\nI'm ${FOUNDER.name}, the founder of ${SITE.NAME}. Thank you for choosing {{plan}}. It genuinely means a lot: every purchase lets me keep crafting new sections, blocks and illustrations, and I'm glad you're building with them.\n\nTo get started, sign in with **{{email}}**, the email you paid with, and everything included unlocks right away.`,
    outro: `If you run into any problem with installation or setup, email me directly at [{{founderEmail}}](mailto:{{founderEmail}}). That address is just for you: it comes straight to me, not to a support queue.\n\nAnd if it's easier to talk it through, say so and we'll set up a short call to fix everything together.\n\nThanks again,\n**${FOUNDER.name}**\nFounder, ${SITE.NAME}`,
    preheader: `A personal note from ${FOUNDER.name}, the founder of ${SITE.NAME}.`,
    subject: `Thank you for trusting ${SITE.NAME}`,
  },
  from: `${FOUNDER.name} from ${SITE.NAME} <${FOUNDER.email}>`,
  id: "purchase-thank-you",
  name: "Thank-you note",
  replyTo: FOUNDER.email,
  sentWhen: "Dodo confirms a new purchase",
  variables: [
    {
      key: "firstName",
      label: 'First name (or "there")',
      sample: "Ada",
    },
    { key: "email", label: "Email they paid with", sample: "ada@example.com" },
    { key: "plan", label: "What they bought", sample: "the lifetime plan" },
    {
      key: "signInUrl",
      label: "Sign-in page link",
      sample: `${SITE.URL}${ROUTES.LOGIN}?email=ada%40example.com`,
    },
    { key: "founderEmail", label: "Your email", sample: FOUNDER.email },
  ],
};

export const purchaseThankYouValues = ({
  customerName,
  email,
  itemTitle,
  kind,
}: {
  customerName: string | null;
  email: string;
  itemTitle: string | null;
  kind: PurchaseKind;
}) => ({
  email,
  firstName: firstNameOf(customerName) ?? "there",
  founderEmail: FOUNDER.email,
  plan: purchaseLabel(kind, itemTitle),
  // Pay first, then sign in: the login page with their email filled in.
  signInUrl: `${SITE.URL}${ROUTES.LOGIN}?email=${encodeURIComponent(email)}`,
});
