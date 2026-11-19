// The documents this app stores in MongoDB (connection: lib/db/index.ts).
//
// better-auth's own collections (user, session, account, verification) are
// created and indexed by its MongoDB adapter (lib/auth.ts). A user's `_id` is
// an ObjectId; the app sees it as its hex string (`session.user.id`), and
// that string is what `purchase.userId` and install tokens hold.

// Relative, not "@/…": scripts load this file without the path alias.
import type { ResourceCategory } from "../admin/constants";
import type { PurchaseKind } from "../billing/plans";
import type { EmailContent, EmailId } from "../emails/compose";
import type { Opinion, SurveyTrigger, WantMore } from "../feedback";

// One document per order or subscription. What it unlocks:
//   kind "lifetime" | "yearly" → everything (all-access)
//   kind "item"                → one product, `itemId` (its product code,
//                                registry.json meta.id, e.g. "SEC-0003")
export interface PurchaseDoc {
  // "order_<provider order id>" or "sub_<provider subscription id>", so a
  // provider's repeated webhooks update one document instead of adding more.
  _id: string;
  // What was paid, in the currency's minor unit (cents). Null if the
  // provider didn't say.
  amountCents: number | null;
  createdAt: Date;
  currency: string | null;
  currentPeriodEnd: Date | null;
  // Lowercase. Guest checkout happens before sign-in, so purchases are
  // matched by email until `userId` is filled in.
  email: string;
  itemId: string | null;
  kind: PurchaseKind;
  // The payment provider ("polar", "dodo") and its own IDs.
  provider: string;
  providerCustomerId: string | null;
  providerOrderId: string | null;
  providerSubscriptionId: string | null;
  status: string;
  updatedAt: Date;
  // Null until the buyer signs in, then backfilled to their user ID.
  userId: string | null;
}

// MongoDB has no check constraints, so writers call this: a single-item
// purchase must name its item, and an all-access plan mustn't.
export const assertPurchaseShape = (
  purchase: Pick<PurchaseDoc, "itemId" | "kind">
) => {
  if ((purchase.kind === "item") !== (purchase.itemId !== null)) {
    throw new Error(
      `A "${purchase.kind}" purchase ${purchase.kind === "item" ? "needs" : "can't have"} an itemId.`
    );
  }
};

// One saved link in the admin panel's Resources (app/admin-panel-craft/
// resources): a website, a person or an X post worth keeping, with tags to
// filter by (categories: RESOURCE_CATEGORIES in lib/admin/constants.ts).
// Admin-only; nothing on the public site reads it.
export interface ResourceDoc {
  // "res_<uuid>".
  _id: string;
  category: ResourceCategory;
  createdAt: Date;
  // The admin's email who added it.
  createdBy: string;
  name: string;
  // Normalised by normalizeTags (lib/admin/constants.ts): lowercase,
  // hyphenated, unique.
  tags: string[];
  updatedAt: Date;
  // http(s) only.
  url: string;
}

// One answer to the pricing page's exit survey
// (components/pricing-survey.tsx), stored by app/api/feedback and listed on
// the admin panel's Feedback page. Only signed-out visitors see the survey,
// so there's no user to link; `email` is what they chose to share.
export interface FeedbackDoc {
  // "fb_<uuid>".
  _id: string;
  // Which survey; room for others later.
  kind: "pricing_exit";
  wantMore: WantMore[];
  opinion: Opinion[];
  // Lowercased, or null when left empty. Only for telling them when what
  // they asked for ships.
  email: string | null;
  trigger: SurveyTrigger;
  // Their PostHog ID, to find their visit in PostHog.
  distinctId: string | null;
  // anonymousId(ip, user agent): rate limiting only, never shown.
  clientHash: string;
  // Two-letter code from Vercel's geo header.
  country: string | null;
  createdAt: Date;
}

// An email's edited words from the admin panel's Emails page
// (app/admin-panel-craft/emails), one document per email. Without one the
// email sends its default words from code (lib/emails/*.ts); resetting an
// email deletes its document. Read when sending (lib/emails/store.ts).
export interface EmailTemplateDoc {
  _id: EmailId;
  content: EmailContent;
  updatedAt: Date;
  // The admin's email who saved it.
  updatedBy: string;
}
