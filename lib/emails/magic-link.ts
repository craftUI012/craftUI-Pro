import { SITE } from "@/constants/site";
import { FONT, LOGO_URL, assetOrigin, escapeHtml } from "@/lib/emails/shared";

// How long a sign-in link works. lib/auth.ts passes it to better-auth's
// magicLink plugin, and the email states it, so the two can't disagree.
export const MAGIC_LINK_EXPIRES_IN_SECONDS = 15 * 60;

// The sign-in email, in the style of Vercel's: a white card with a hairline
// border, the logo, a short heading, one black button, the link spelled out
// for clients that block buttons, and a quiet footer. Tables and inline
// styles only, since that's what every email client renders the same.
export const magicLinkEmail = ({
  email,
  url,
}: {
  email: string;
  url: string;
}) => {
  const minutes = Math.round(MAGIC_LINK_EXPIRES_IN_SECONDS / 60);
  const href = escapeHtml(url);
  const address = escapeHtml(email);
  const subject = `Sign in to ${SITE.NAME}`;

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
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${SITE.NAME} sign-in link. It works once and expires in ${minutes} minutes.</div>
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
                      <h1 style="margin:0;font-size:24px;line-height:32px;font-weight:400;color:#000000;">Sign in to <strong>${SITE.NAME}</strong></h1>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;line-height:24px;color:#000000;">
                      Hello,
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:24px;font-size:14px;line-height:24px;color:#000000;">
                      To finish signing in as <a href="mailto:${address}" style="color:#000000;text-decoration:none;font-weight:600;">${address}</a>, click the button below. It unlocks every ${SITE.NAME} item your plan includes.
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding-bottom:24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#000000" style="border-radius:5px;">
                            <a href="${href}" target="_blank" style="display:inline-block;padding:12px 20px;font-size:12px;line-height:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:5px;">Sign in</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="font-size:14px;line-height:24px;color:#000000;">
                      or copy and paste this URL into your browser:
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-bottom:24px;font-size:14px;line-height:24px;word-break:break-all;">
                      <a href="${href}" target="_blank" style="color:#2563eb;text-decoration:none;">${href}</a>
                    </td>
                  </tr>
                  <tr>
                    <td style="border-top:1px solid #eaeaea;padding-top:24px;font-size:12px;line-height:24px;color:#666666;">
                      This link works once and expires in ${minutes} minutes. If you didn't try to sign in, you can safely ignore this email: no one can sign in without this link.
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

  // The plain-text part, for clients that don't show HTML (and spam filters,
  // which like to see one).
  const text = `Sign in to ${SITE.NAME}

To finish signing in as ${email}, open this link:

${url}

This link works once and expires in ${minutes} minutes. If you didn't try to sign in, you can safely ignore this email.

${SITE.NAME} · ${assetOrigin}`;

  return { html, subject, text };
};
