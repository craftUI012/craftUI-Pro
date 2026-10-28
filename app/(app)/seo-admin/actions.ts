"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ROUTES } from "@/constants/routes";
import { showSeoAdmin } from "@/lib/flags";
import { writeCardText, writeSearchText } from "@/lib/seo-edit";

// Saves a docs page's SEO text from /seo-admin into the files in this repo
// (lib/seo-edit.ts). Dev only, like the page: an action can be called
// directly, so it checks for itself.

export type SeoEditResult = { error: string } | { message: string; ok: true };

const input = z.object({
  card: z
    .string()
    .trim()
    .min(1, "Write a card description, or close the editor.")
    .max(300, "Keep the card description under 300 characters.")
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, "Write a search description.")
    .max(300, "Keep the search description under 300 characters."),
  path: z
    .string()
    .startsWith(`${ROUTES.DOCS}/`, "Only docs pages can be edited."),
  title: z
    .string()
    .trim()
    .min(1, "Write a title.")
    .max(120, "Keep the title under 120 characters."),
});

export const saveSeoText = async (
  values: z.input<typeof input>
): Promise<SeoEditResult> => {
  if (!showSeoAdmin) {
    return { error: "Editing is only available in development." };
  }
  try {
    const { card, description, path, title } = input.parse(values);
    const searchChanged = await writeSearchText(path, title, description);
    const cardChanged =
      card === undefined ? false : await writeCardText(path, card);
    revalidatePath(ROUTES.SEO_ADMIN);
    revalidatePath(path);
    const saved = [
      searchChanged && "search text",
      cardChanged && "card text (registry rebuilt)",
    ].filter(Boolean);
    return {
      message:
        saved.length > 0 ? `Saved ${saved.join(" and ")}.` : "Nothing changed.",
      ok: true,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Check the fields." };
    }
    return {
      error: error instanceof Error ? error.message : "Couldn't save.",
    };
  }
};
