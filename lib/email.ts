import { Reloop } from "reloop-email";

const apiKey = process.env.RELOOP_API_KEY;
const from =
  process.env.AUTH_EMAIL_FROM ?? "CraftUI Pro <onboarding@localhost>";

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

  const { emailError } = await reloop.mail.send({
    from,
    html: `<p>Click the link below to sign in to CraftUI Pro.</p><p><a href="${url}">Sign in</a></p><p>This link expires in 15 minutes. If you didn't request it, you can ignore this email.</p>`,
    subject: "Your CraftUI Pro sign-in link",
    text: `Sign in to CraftUI Pro: ${url}`,
    to: email,
  });

  if (emailError) {
    console.error("[auth] Failed to send magic link", emailError);
    throw emailError;
  }
};
