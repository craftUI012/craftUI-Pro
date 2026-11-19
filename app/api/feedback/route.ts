import { randomUUID } from "node:crypto";

import { after } from "next/server";
import { z } from "zod";

import { feedbackResponses } from "@/lib/db";
import {
  OPINION_VALUES,
  SURVEY_TRIGGERS,
  WANT_MORE_VALUES,
} from "@/lib/feedback";
import { anonymousId, captureServerEvent } from "@/lib/posthog-server";

// The pricing page's exit survey (components/pricing-survey.tsx): stores one
// answer in the `feedback` collection, read on the admin panel's Feedback
// page. Every field is optional, but an answer must say something.
//
// Answers: 400 for a malformed or empty answer, 429 past 3 answers an hour
// from one visitor, 200 otherwise. The hidden `website` field is a bot trap:
// a filled one gets 200 and nothing is stored, so bots learn nothing.
const feedbackSchema = z.object({
  distinctId: z.string().max(200).optional(),
  email: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => value || undefined)
    .pipe(z.email().optional()),
  opinion: z.array(z.enum(OPINION_VALUES)).max(OPINION_VALUES.length),
  trigger: z.enum(SURVEY_TRIGGERS),
  wantMore: z.array(z.enum(WANT_MORE_VALUES)).max(WANT_MORE_VALUES.length),
  website: z.string().max(500).optional(),
});

const HOURLY_LIMIT = 3;

export const POST = async (request: Request) => {
  const parsed = feedbackSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) {
    return Response.json(
      { error: "That answer couldn't be read." },
      { status: 400 }
    );
  }
  const { distinctId, email, opinion, trigger, wantMore, website } =
    parsed.data;

  if (website) {
    return Response.json({ ok: true });
  }
  // Duplicates removed: a value counts once however it arrives.
  const wants = [...new Set(wantMore)];
  const opinions = [...new Set(opinion)];
  if (wants.length === 0 && opinions.length === 0 && !email) {
    return Response.json({ error: "Pick an answer first." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const userAgent = request.headers.get("user-agent") ?? "";
  const clientHash = await anonymousId(ip, userAgent);

  const collection = await feedbackResponses();
  const recent = await collection.countDocuments({
    clientHash,
    createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
  });
  if (recent >= HOURLY_LIMIT) {
    return Response.json(
      { error: "Thanks, we already have your answers." },
      { status: 429 }
    );
  }

  await collection.insertOne({
    _id: `fb_${randomUUID()}`,
    clientHash,
    country: request.headers.get("x-vercel-ip-country"),
    createdAt: new Date(),
    distinctId: distinctId ?? null,
    email: email?.toLowerCase() ?? null,
    kind: "pricing_exit",
    opinion: opinions,
    trigger,
    wantMore: wants,
  });

  // The answers in PostHog too, on the visitor's ID, never the email.
  after(() =>
    captureServerEvent({
      distinctId: distinctId ?? clientHash,
      event: "survey_answer_stored",
      properties: {
        has_email: Boolean(email),
        opinion: opinions.join(","),
        survey: "pricing_exit",
        trigger,
        want_more: wants.join(","),
      },
    })
  );

  return Response.json({ ok: true });
};
