import { emailTemplates } from "@/lib/db";
import type { EmailTemplateDoc } from "@/lib/db/schema";
import { emailContentSchema, emailProblems } from "@/lib/emails/compose";
import type { EmailContent, EmailId } from "@/lib/emails/compose";
import { getEmailTemplate } from "@/lib/emails/templates";

// Server only. The words an email is sent with: the admin panel's edited
// words if there are any (email_template collection), the defaults from
// code otherwise.

export const getSavedEmail = async (
  id: EmailId
): Promise<EmailTemplateDoc | null> => {
  const collection = await emailTemplates();
  return collection.findOne({ _id: id });
};

// Never throws: an email must still go out if MongoDB can't be read or the
// saved words no longer check out (say a variable was removed in code), so
// those cases send the defaults and log why.
export const getEmailContent = async (id: EmailId): Promise<EmailContent> => {
  const template = getEmailTemplate(id);
  try {
    const saved = await getSavedEmail(id);
    if (!saved) {
      return template.defaults;
    }
    const parsed = emailContentSchema.safeParse({
      ...template.defaults,
      ...saved.content,
    });
    if (!parsed.success) {
      console.error(
        `[email] Saved "${id}" email is malformed, sending defaults`
      );
      return template.defaults;
    }
    const problems = emailProblems(template, parsed.data);
    if (problems.length > 0) {
      console.error(
        `[email] Saved "${id}" email doesn't check out (${problems.join(" ")}), sending defaults`
      );
      return template.defaults;
    }
    return parsed.data;
  } catch (error) {
    console.error(`[email] Couldn't read the saved "${id}" email`, error);
    return template.defaults;
  }
};
