import { Reloop } from "reloop-email";

import type { PurchaseKind } from "./billing/plans";
import { renderEmail } from "./emails/compose";
import type { EmailContent, EmailTemplate } from "./emails/compose";
import { magicLinkTemplate, magicLinkValues } from "./emails/magic-link";
import {
  purchaseThankYouTemplate,
  purchaseThankYouValues,
} from "./emails/purchase-thank-you";
import { getEmailContent } from "./emails/store";

// Sends the site's emails through Reloop. Each email's frame is
// lib/emails/compose.ts and its words are the admin panel's edited ones or
// the defaults in lib/emails/<email>.ts (lib/emails/store.ts picks).

const apiKey = process.env.RELOOP_API_KEY;

const getClient = () => {
  if (!apiKey) {
    return null;
  }
  return new Reloop({ apiKey });
};

const send = async ({
  content,
  subjectPrefix = "",
  template,
  to,
  values,
}: {
  content: EmailContent;
  subjectPrefix?: string;
  template: EmailTemplate;
  to: string;
  values: Record<string, string>;
}) => {
  const reloop = getClient();
  if (!reloop) {
    throw new Error("RELOOP_API_KEY isn't set, so no email can be sent.");
  }
  const { html, subject, text } = renderEmail(template, content, values);
  const { emailError } = await reloop.mail.send({
    from: template.from,
    html,
    ...(template.replyTo ? { reply_to: template.replyTo } : {}),
    subject: `${subjectPrefix}${subject}`,
    text,
    to,
  });
  if (emailError) {
    throw emailError;
  }
};

interface SendMagicLinkEmailInput {
  email: string;
  url: string;
}

export const sendMagicLinkEmail = async ({
  email,
  url,
}: SendMagicLinkEmailInput) => {
  if (!apiKey) {
    console.log(`[auth] Magic link for ${email}: ${url}`);
    return;
  }

  try {
    await send({
      content: await getEmailContent("magic-link"),
      template: magicLinkTemplate,
      to: email,
      values: magicLinkValues({ email, url }),
    });
  } catch (error) {
    console.error("[auth] Failed to send magic link", error);
    throw error;
  }
};

// The founder's thank-you note after a purchase (lib/billing/dodo-webhook.ts),
// sent from and answered at the founder's own address.
export const sendPurchaseThankYouEmail = async (input: {
  customerName: string | null;
  email: string;
  itemTitle: string | null;
  kind: PurchaseKind;
}) => {
  if (!apiKey) {
    console.log(
      `[billing] Thank-you note for ${input.email} (no RELOOP_API_KEY, not sent)`
    );
    return;
  }

  await send({
    content: await getEmailContent("purchase-thank-you"),
    template: purchaseThankYouTemplate,
    to: input.email,
    values: purchaseThankYouValues(input),
  });
};

// A test of words being edited in the admin panel, to the admin, with the
// email's sample values and "[Test] " before the subject.
export const sendTestEmail = ({
  content,
  template,
  to,
  values,
}: {
  content: EmailContent;
  template: EmailTemplate;
  to: string;
  values: Record<string, string>;
}) => send({ content, subjectPrefix: "[Test] ", template, to, values });
