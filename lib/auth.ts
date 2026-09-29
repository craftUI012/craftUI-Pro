import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { hasActivePlanForEmail } from "./billing/entitlements";
import { db } from "./db";
import * as schema from "./db/schema";
import { sendMagicLinkEmail } from "./email";

export const NO_PLAN_MESSAGE =
  "No active plan found for this email. Get access first, then sign in with the email you paid with.";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    magicLink({
      disableSignUp: false,
      expiresIn: 900,
      sendMagicLink: async ({ email, url }) => {
        // Pay-first gate: only buyers can sign in or sign up.
        // The purchase is keyed by the Polar checkout email.
        const hasPlan = await hasActivePlanForEmail(email);
        if (!hasPlan) {
          throw new APIError("FORBIDDEN", { message: NO_PLAN_MESSAGE });
        }
        await sendMagicLinkEmail({ email, url });
      },
    }),
    nextCookies(),
  ],
  secret: process.env.BETTER_AUTH_SECRET,
  session: {
    expiresIn: 60 * 60 * 24 * 7,
  },
});
