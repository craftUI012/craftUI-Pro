import type { EmailId, EmailTemplate } from "@/lib/emails/compose";
import { magicLinkTemplate } from "@/lib/emails/magic-link";
import { purchaseThankYouTemplate } from "@/lib/emails/purchase-thank-you";

// Every email the site sends, in the order the admin panel lists them.
// Client-safe. Adding one: a file like magic-link.ts with its defaults and
// variables, its id in EMAIL_IDS (compose.ts), a sender in lib/email.ts.
export const EMAIL_TEMPLATES: readonly EmailTemplate[] = [
  magicLinkTemplate,
  purchaseThankYouTemplate,
];

export const getEmailTemplate = (id: EmailId) => {
  const template = EMAIL_TEMPLATES.find((entry) => entry.id === id);
  if (!template) {
    throw new Error(`No email template "${id}".`);
  }
  return template;
};
