import { Reloop } from "reloop-email";

import type { PurchaseKind } from "./billing/plans";
import { magicLinkEmail } from "./emails/magic-link";
import { FOUNDER, purchaseThankYouEmail } from "./emails/purchase-thank-you";

const apiKey = process.env.RELOOP_API_KEY;
const from = "craftUI <notification@craftui.space>";

const getClient = () => {
  if (!apiKey) {
    return null;
  }
  return new Reloop({ apiKey });
};

interface SendMagicLinkEmailInput {
  email: string;
  url: string;
}

// The email's design and copy are in lib/emails/magic-link.ts.
export const sendMagicLinkEmail = async ({
  email,
  url,
}: SendMagicLinkEmailInput) => {
  if (!apiKey) {
    console.log(`[auth] Magic link for ${email}: ${url}`);
    return;
  }

  const reloop = getClient();
  if (!reloop) {
    return;
  }

  const { html, subject, text } = magicLinkEmail({ email, url });
  const { emailError } = await reloop.mail.send({
    from,
    html,
    subject,
    text,
    to: email,
  });

  if (emailError) {
    console.error("[auth] Failed to send magic link", emailError);
    throw emailError;
  }
};

// The founder's thank-you note after a purchase (lib/billing/dodo-webhook.ts),
// sent from and answered at the founder's own address. Design and copy:
// lib/emails/purchase-thank-you.ts.
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

  const reloop = getClient();
  if (!reloop) {
    return;
  }

  const { html, subject, text } = purchaseThankYouEmail(input);
  const { emailError } = await reloop.mail.send({
    from: `${FOUNDER.name} from craftUI <${FOUNDER.email}>`,
    html,
    reply_to: FOUNDER.email,
    subject,
    text,
    to: input.email,
  });

  if (emailError) {
    throw emailError;
  }
};
