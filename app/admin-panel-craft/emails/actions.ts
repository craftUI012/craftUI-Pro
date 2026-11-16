"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/app/admin-panel-craft/actions";
import { ROUTES } from "@/constants/routes";
import { requireAdmin } from "@/lib/admin/session";
import { emailTemplates } from "@/lib/db";
import { sendTestEmail } from "@/lib/email";
import {
  emailContentSchema,
  emailProblems,
  isEmailId,
  sampleValues,
} from "@/lib/emails/compose";
import type { EmailContent, EmailTemplate } from "@/lib/emails/compose";
import { getEmailTemplate } from "@/lib/emails/templates";

// The Emails page's writes (app/admin-panel-craft/emails). Saving puts the
// words live for the next email sent; resetting goes back to the defaults
// in code. Each checks the admin first, like the panel's other actions.

const fail = (error: unknown): ActionResult => {
  if (error instanceof z.ZodError) {
    return { error: error.issues[0]?.message ?? "Invalid words." };
  }
  return {
    error: error instanceof Error ? error.message : "Something went wrong.",
  };
};

// The email and the edited words, checked: a known email, every field
// present and within its limit, no unknown {{values}}, safe links.
const checked = (
  id: string,
  content: unknown
): { content: EmailContent; template: EmailTemplate } => {
  if (!isEmailId(id)) {
    throw new Error("No such email.");
  }
  const template = getEmailTemplate(id);
  const parsed = emailContentSchema.parse(content);
  const [problem] = emailProblems(template, parsed);
  if (problem) {
    throw new Error(problem);
  }
  return { content: parsed, template };
};

const refresh = () => revalidatePath(`${ROUTES.ADMIN_PANEL}/emails`, "layout");

export const saveEmail = async (input: {
  content: EmailContent;
  id: string;
}): Promise<ActionResult> => {
  try {
    const session = await requireAdmin();
    const { content, template } = checked(input.id, input.content);
    const collection = await emailTemplates();
    await collection.updateOne(
      { _id: template.id },
      {
        $set: {
          content,
          updatedAt: new Date(),
          updatedBy: session.user.email,
        },
      },
      { upsert: true }
    );
    refresh();
    return { message: "Saved. The next email sent uses it.", ok: true };
  } catch (error) {
    return fail(error);
  }
};

export const resetEmail = async (input: {
  id: string;
}): Promise<ActionResult> => {
  try {
    await requireAdmin();
    if (!isEmailId(input.id)) {
      throw new Error("No such email.");
    }
    const collection = await emailTemplates();
    await collection.deleteOne({ _id: input.id });
    refresh();
    return { message: "Back to the default words.", ok: true };
  } catch (error) {
    return fail(error);
  }
};

// Sends the words as they are in the editor (saved or not) to the admin,
// filled with the email's sample values.
export const sendEmailTest = async (input: {
  content: EmailContent;
  id: string;
}): Promise<ActionResult> => {
  try {
    const session = await requireAdmin();
    const { content, template } = checked(input.id, input.content);
    await sendTestEmail({
      content,
      template,
      to: session.user.email,
      values: sampleValues(template),
    });
    return { message: `Test sent to ${session.user.email}.`, ok: true };
  } catch (error) {
    return fail(error);
  }
};
