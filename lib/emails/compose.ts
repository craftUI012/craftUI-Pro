import { z } from "zod";

import { SITE } from "@/constants/site";
import { FONT, LOGO_URL, assetOrigin, escapeHtml } from "@/lib/emails/shared";

// The one frame every email is drawn in, and the words that fill it.
//
// An email's words are fields (EMAIL_FIELDS): subject, inbox preview,
// heading, the text before and after its one button, the button's label and
// the small print. Each email has default words in code (lib/emails/
// magic-link.ts, purchase-thank-you.ts); the admin panel's Emails page
// (/admin-panel-craft/emails) saves edited words to MongoDB, and
// lib/emails/store.ts picks those over the defaults when sending.
//
// The frame is fixed: a white card with a hairline border, the logo, the
// heading, a black button, a hairline over the small print, and the site's
// line under the card. Tables and inline styles only, since that's what
// every email client renders the same. The button's link is never part of
// the words: each email names the value it points at (`buttonHref`), so an
// edit can't break the sign-in link.
//
// The words are plain text with a little markup:
//   a blank line          a new paragraph (a single line break stays one)
//   **bold**              bold
//   [label](https://…)    a link (http, https or mailto only)
//   {{name}}              a value filled in when sending (`variables`)
// Everything is escaped, and values are filled in after the markup is read,
// so a buyer's name can never add a link or HTML.
//
// Client-safe: the editor renders its live preview with renderEmail.

export const EMAIL_FIELDS = [
  "subject",
  "preheader",
  "heading",
  "intro",
  "button",
  "outro",
  "footer",
] as const;

export type EmailField = (typeof EMAIL_FIELDS)[number];
export type EmailContent = Record<EmailField, string>;

export const EMAIL_IDS = ["magic-link", "purchase-thank-you"] as const;
export type EmailId = (typeof EMAIL_IDS)[number];

export const isEmailId = (value: string): value is EmailId =>
  (EMAIL_IDS as readonly string[]).includes(value);

export interface EmailVariable {
  // Used as {{key}}.
  key: string;
  label: string;
  // What the preview and test emails fill in.
  sample: string;
}

export interface EmailTemplate {
  id: EmailId;
  // "Sign-in link", for the admin list.
  name: string;
  // When it's sent, for the admin list.
  sentWhen: string;
  from: string;
  replyTo?: string;
  defaults: EmailContent;
  variables: readonly EmailVariable[];
  // The variable the button links to.
  buttonHref: string;
}

// Field limits, checked when saving and when reading saved words back.
const LIMITS: Record<EmailField, number> = {
  button: 60,
  footer: 1000,
  heading: 200,
  intro: 4000,
  outro: 4000,
  preheader: 200,
  subject: 200,
};

const REQUIRED: readonly EmailField[] = ["subject", "heading", "button"];

export const emailContentSchema = z.object(
  Object.fromEntries(
    EMAIL_FIELDS.map((field) => [
      field,
      z.string().max(LIMITS[field], `The ${field} is too long.`),
    ])
  ) as Record<EmailField, z.ZodString>
);

// --- Reading the words ------------------------------------------------------

// **bold**, [label](href) or {{name}}.
const TOKEN =
  /\*\*(.+?)\*\*|\[([^\]\n]+)\]\(([^)\s]+)\)|\{\{\s*([A-Za-z]\w*)\s*\}\}/g;
const VARIABLE = /\{\{\s*([A-Za-z]\w*)\s*\}\}/g;
const SAFE_HREF = /^(?:https?:\/\/|mailto:)/i;

type Values = Record<string, string>;

const fill = (source: string, values: Values) =>
  source.replaceAll(VARIABLE, (_, key: string) => values[key] ?? "");

const LINK_STYLE = "color:#2563eb;text-decoration:none;";

// One line of words as HTML: escaped, with bold, links and values.
const inlineHtml = (source: string, values: Values): string => {
  let html = "";
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    html += escapeHtml(source.slice(last, match.index));
    last = match.index + match[0].length;
    const [whole, bold, label, href, key] = match;
    if (bold !== undefined) {
      html += `<strong>${inlineHtml(bold, values)}</strong>`;
    } else if (label !== undefined && href !== undefined) {
      const url = fill(href, values);
      html += SAFE_HREF.test(url)
        ? `<a href="${escapeHtml(url)}" target="_blank" style="${LINK_STYLE}">${inlineHtml(label, values)}</a>`
        : escapeHtml(whole);
    } else if (key !== undefined) {
      html += escapeHtml(values[key] ?? "");
    }
  }
  return html + escapeHtml(source.slice(last));
};

// The same words as plain text: markup dropped, a link as "label (url)".
const inlineText = (source: string, values: Values): string =>
  source.replaceAll(
    TOKEN,
    (whole, bold?: string, label?: string, href?: string, key?: string) => {
      if (bold !== undefined) {
        return inlineText(bold, values);
      }
      if (label !== undefined && href !== undefined) {
        const url = fill(href, values);
        const text = inlineText(label, values);
        return text === url || url === `mailto:${text}`
          ? text
          : `${text} (${url})`;
      }
      if (key !== undefined) {
        return values[key] ?? "";
      }
      return whole;
    }
  );

const paragraphsOf = (source: string) =>
  source
    .replaceAll("\r\n", "\n")
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

const htmlParagraphs = (source: string, values: Values, style: string) =>
  paragraphsOf(source)
    .map(
      (block) =>
        `<tr><td style="${style}">${block
          .split("\n")
          .map((line) => inlineHtml(line, values))
          .join("<br />")}</td></tr>`
    )
    .join("\n                  ");

const textParagraphs = (source: string, values: Values) =>
  paragraphsOf(source)
    .map((block) => inlineText(block, values))
    .join("\n\n");

// --- Checking the words -----------------------------------------------------

// The values the preview and test emails fill in.
export const sampleValues = (template: EmailTemplate): Values =>
  Object.fromEntries(
    template.variables.map((variable) => [variable.key, variable.sample])
  );

// What's wrong with the words, as sentences for the editor (empty if
// nothing): a missing required field, a value the email doesn't have, or a
// link that isn't http, https or mailto.
export const emailProblems = (
  template: EmailTemplate,
  content: EmailContent
): string[] => {
  const problems: string[] = [];
  const parsed = emailContentSchema.safeParse(content);
  if (!parsed.success) {
    problems.push(parsed.error.issues[0]?.message ?? "Invalid words.");
  }
  for (const field of REQUIRED) {
    if (!content[field]?.trim()) {
      problems.push(`The ${field} can't be empty.`);
    }
  }
  const known = new Set(template.variables.map((variable) => variable.key));
  const sample = sampleValues(template);
  const unknown = new Set<string>();
  for (const field of EMAIL_FIELDS) {
    const value = content[field] ?? "";
    for (const [, key] of value.matchAll(VARIABLE)) {
      if (!known.has(key)) {
        unknown.add(key);
      }
    }
    for (const match of value.matchAll(TOKEN)) {
      const { 3: href } = match;
      if (href !== undefined && !SAFE_HREF.test(fill(href, sample))) {
        problems.push(
          `The link to "${href}" needs to start with https://, http:// or mailto:.`
        );
      }
    }
  }
  if (unknown.size > 0) {
    problems.push(
      `This email has no ${[...unknown].map((key) => `{{${key}}}`).join(", ")}.`
    );
  }
  return problems;
};

// --- The frame --------------------------------------------------------------

const PARAGRAPH =
  "padding-bottom:16px;font-size:14px;line-height:24px;color:#000000;overflow-wrap:anywhere;";
const SMALL_PRINT =
  "padding-bottom:8px;font-size:12px;line-height:24px;color:#666666;overflow-wrap:anywhere;";

export const renderEmail = (
  template: EmailTemplate,
  content: EmailContent,
  values: Values
) => {
  const subject = inlineText(content.subject, values).trim();
  const preheader = inlineText(content.preheader, values).trim();
  const button = inlineText(content.button, values).trim();
  const href = values[template.buttonHref] ?? "";
  const outro = htmlParagraphs(content.outro, values, PARAGRAPH);
  const footer = htmlParagraphs(content.footer, values, SMALL_PRINT);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:#ffffff;font-family:${FONT};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
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
                      <h1 style="margin:0;font-size:24px;line-height:32px;font-weight:400;color:#000000;">${inlineHtml(content.heading, values)}</h1>
                    </td>
                  </tr>
                  ${htmlParagraphs(content.intro, values, PARAGRAPH)}
                  <tr>
                    <td align="center" style="padding:8px 0 24px;">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td align="center" bgcolor="#000000" style="border-radius:5px;">
                            <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:12px 20px;font-size:12px;line-height:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:5px;">${escapeHtml(button)}</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ${outro}${
                    footer
                      ? `
                  <tr>
                    <td style="border-top:1px solid #eaeaea;padding-top:24px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  ${footer}
                      </table>
                    </td>
                  </tr>`
                      : ""
                  }
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

  // The plain-text part, for clients that don't show HTML (and spam
  // filters, which like to see one), built from the same words.
  const text = [
    inlineText(content.heading, values).trim(),
    textParagraphs(content.intro, values),
    `${button}: ${href}`,
    textParagraphs(content.outro, values),
    textParagraphs(content.footer, values),
    `${SITE.NAME} · ${assetOrigin}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { html, preheader, subject, text };
};
