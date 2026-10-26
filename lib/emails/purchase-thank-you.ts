import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import type { PurchaseKind } from "@/lib/billing/plans";
import { FONT, LOGO_URL, assetOrigin, escapeHtml } from "@/lib/emails/shared";

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

const paragraph = (html: string, bottom = 16) =>
  `<tr><td style="padding-bottom:${bottom}px;font-size:14px;line-height:24px;color:#000000;">${html}</td></tr>`;

// The thank-you note sent once per new purchase (lib/billing/dodo-webhook.ts),
// from the founder. Same frame as the sign-in email (lib/emails/magic-link.ts)
// but written as a personal letter: a greeting, the thanks, how to get in
// (pay first, then sign in with the same email), and the founder's own
// address for setup problems, with the offer of a short call. Signed by name.
export const purchaseThankYouEmail = ({
  customerName,
  email,
  itemTitle,
  kind,
}: {
  customerName: string | null;
  email: string;
  itemTitle: string | null;
  kind: PurchaseKind;
}) => {
  const firstName = firstNameOf(customerName);
  const greeting = firstName ? `Hi ${escapeHtml(firstName)},` : "Hi there,";
  const bought = escapeHtml(purchaseLabel(kind, itemTitle));
  const address = escapeHtml(email);
  // Pay first, then sign in: the login page with their email filled in.
  const signInUrl = `${SITE.URL}${ROUTES.LOGIN}?email=${encodeURIComponent(email)}`;
  const signInHref = escapeHtml(signInUrl);
  const founderLink = `<a href="mailto:${FOUNDER.email}" style="color:#000000;font-weight:600;text-decoration:underline;">${FOUNDER.email}</a>`;
  const subject = `Thank you for trusting ${SITE.NAME}`;

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:${FONT};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">A personal note from ${FOUNDER.name}, the founder of ${SITE.NAME}.</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff;">
      <tr>
        <td align="center" style="padding:40px 12px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:465px;border:1px solid #eaeaea;border-radius:8px;">
            <tr>
              <td style="padding:32px 24px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <img src="${LOGO_URL}" width="40" height="40" alt="${SITE.NAME}" style="display:block;border:0;outline:none;text-decoration:none;" />
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <h1 style="margin:0;font-size:24px;line-height:32px;font-weight:400;color:#000000;">Thank you for trusting <strong>${SITE.NAME}</strong></h1>
                    </td>
                  </tr>
                  ${paragraph(greeting, 8)}
                  ${paragraph(`I'm ${FOUNDER.name}, the founder of ${SITE.NAME}. Thank you for choosing ${bought}. It genuinely means a lot: every purchase lets me keep crafting new sections, blocks and illustrations, and I'm glad you're building with them.`)}
                  ${paragraph(`To get started, sign in with <strong>${address}</strong>, the email you paid with, and everything included unlocks right away.`, 24)}
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#000000" style="border-radius:5px;">
                            <a href="${signInHref}" target="_blank" style="display:inline-block;padding:12px 20px;font-size:12px;line-height:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:5px;">Sign in to ${SITE.NAME}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${paragraph(`If you run into any problem with installation or setup, email me directly at ${founderLink}. That address is just for you: it comes straight to me, not to a support queue.`)}
                  ${paragraph("And if it's easier to talk it through, say so and we'll set up a short call to fix everything together.", 24)}
                  ${paragraph("Thanks again,", 0)}
                  ${paragraph(`<strong>${FOUNDER.name}</strong><br /><span style="color:#666666;">Founder, ${SITE.NAME}</span>`, 24)}
                  <tr>
                    <td style="border-top:1px solid #eaeaea;padding-top:24px;font-size:12px;line-height:24px;color:#666666;">
                      You're getting this because you bought ${bought} on ${SITE.NAME} with ${address}. Just reply to this email to reach me.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:465px;">
            <tr>
              <td align="center" style="padding-top:16px;font-size:12px;line-height:20px;color:#999999;">
                <a href="${assetOrigin}" style="color:#999999;text-decoration:none;">${SITE.NAME}</a> · shadcn/ui sections, blocks and illustrations
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = `${firstName ? `Hi ${firstName},` : "Hi there,"}

I'm ${FOUNDER.name}, the founder of ${SITE.NAME}. Thank you for choosing ${purchaseLabel(kind, itemTitle)}. It genuinely means a lot: every purchase lets me keep crafting new sections, blocks and illustrations, and I'm glad you're building with them.

To get started, sign in with ${email}, the email you paid with, and everything included unlocks right away:

${signInUrl}

If you run into any problem with installation or setup, email me directly at ${FOUNDER.email}. That address is just for you: it comes straight to me, not to a support queue.

And if it's easier to talk it through, say so and we'll set up a short call to fix everything together.

Thanks again,
${FOUNDER.name}
Founder, ${SITE.NAME}`;

  return { html, subject, text };
};
