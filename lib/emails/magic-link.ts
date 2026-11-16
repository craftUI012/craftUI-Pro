import { SITE } from "@/constants/site";
import type { EmailTemplate } from "@/lib/emails/compose";

// How long a sign-in link works. lib/auth.ts passes it to better-auth's
// magicLink plugin, and the email states it ({{minutes}}), so the two can't
// disagree.
export const MAGIC_LINK_EXPIRES_IN_SECONDS = 15 * 60;

// The sign-in email, in the style of Vercel's: the logo, a short heading,
// one black button, the link spelled out for clients that block buttons,
// and a quiet footer. The frame is lib/emails/compose.ts; these are its
// default words, editable in the admin panel (/admin-panel-craft/emails).
export const magicLinkTemplate: EmailTemplate = {
  buttonHref: "url",
  defaults: {
    button: "Sign in",
    footer:
      "This link works once and expires in {{minutes}} minutes. If you didn't try to sign in, you can safely ignore this email: no one can sign in without this link.",
    heading: `Sign in to **${SITE.NAME}**`,
    intro: `Hello,\nTo finish signing in as **{{email}}**, click the button below. It unlocks every ${SITE.NAME} item your plan includes.`,
    outro: "or copy and paste this URL into your browser:\n[{{url}}]({{url}})",
    preheader: `Your ${SITE.NAME} sign-in link. It works once and expires in {{minutes}} minutes.`,
    subject: `Sign in to ${SITE.NAME}`,
  },
  from: `${SITE.NAME} <notification@craftui.space>`,
  id: "magic-link",
  name: "Sign-in link",
  sentWhen: "Someone asks to sign in (buyers and admins only)",
  variables: [
    { key: "email", label: "Their email", sample: "ada@example.com" },
    {
      key: "url",
      label: "Sign-in link",
      sample: `${SITE.URL}/api/auth/magic-link/verify?token=sample-token`,
    },
    {
      key: "minutes",
      label: "Minutes the link works",
      sample: String(MAGIC_LINK_EXPIRES_IN_SECONDS / 60),
    },
  ],
};

export const magicLinkValues = ({
  email,
  url,
}: {
  email: string;
  url: string;
}) => ({
  email,
  minutes: String(Math.round(MAGIC_LINK_EXPIRES_IN_SECONDS / 60)),
  url,
});
