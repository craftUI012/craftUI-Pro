import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";

import { isAdminEmail } from "./admin/emails";
import { hasActivePurchaseForEmail } from "./billing/entitlements";
import { client, db, prepareIndexes } from "./db";
import { sendMagicLinkEmail } from "./email";
import { MAGIC_LINK_EXPIRES_IN_SECONDS } from "./emails/magic-link";

// better-auth's collections need their unique indexes (email, session
// token) before the first sign-in; started when the auth module loads.
prepareIndexes();

export const NO_PLAN_MESSAGE =
  "No active plan found for this email. Get access first, then sign in with the email you paid with.";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL,
  // Creates and indexes its own collections (user, session, account,
  // verification). Passing the client turns on transactions (Atlas runs a
  // replica set, which they need).
  database: mongodbAdapter(db, { client }),
  emailAndPassword: {
    enabled: false,
  },
  plugins: [
    magicLink({
      disableSignUp: false,
      expiresIn: MAGIC_LINK_EXPIRES_IN_SECONDS,
      sendMagicLink: async ({ email, url }) => {
        // Pay-first gate: only buyers can sign in or sign up.
        // Purchases are keyed by the email entered at Dodo checkout.
        // Admins (ADMIN_EMAILS) may sign in without one, to reach the
        // admin panel.
        const allowed =
          isAdminEmail(email) || (await hasActivePurchaseForEmail(email));
        if (!allowed) {
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
