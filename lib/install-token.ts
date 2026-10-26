import { createHmac, timingSafeEqual } from "node:crypto";

// The token in a paid item's install command (/r/<item>.json?t=<token>): the
// buyer's user ID plus a signature only this server can make, so an ID can't
// be typed in or guessed from elsewhere (it also reaches PostHog). It never
// expires; access itself is checked against the database on every install,
// so a refunded or lapsed buyer's old commands stop working on their own.
//
// Format: base64url(userId) + "." + base64url(HMAC-SHA256(secret, purpose + userId)).

const PURPOSE = "craftui-install:";

const secret = () => {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) {
    throw new Error("BETTER_AUTH_SECRET is required to sign install links.");
  }
  return value;
};

const signature = (userId: string) =>
  createHmac("sha256", secret())
    .update(PURPOSE + userId)
    .digest();

export const signInstallToken = (userId: string) =>
  `${Buffer.from(userId).toString("base64url")}.${signature(userId).toString("base64url")}`;

// The user ID the token was issued to, or null if it's malformed or forged.
export const verifyInstallToken = (token: string | null) => {
  const [encodedId, encodedSignature, ...rest] = token?.split(".") ?? [];
  if (!encodedId || !encodedSignature || rest.length > 0) {
    return null;
  }
  const userId = Buffer.from(encodedId, "base64url").toString();
  const given = Buffer.from(encodedSignature, "base64url");
  const expected = signature(userId);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  return userId;
};
