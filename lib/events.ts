import { track } from "@vercel/analytics";
import { posthog } from "posthog-js";
import { z } from "zod";

const eventSchema = z.object({
  name: z.enum([
    "copy_npm_command",
    "copy_usage_import_code",
    "copy_usage_code",
    "copy_primitive_code",
    "copy_theme_code",
    "copy_block_code",
    "copy_chunk_code",
    "enable_lift_mode",
    "copy_chart_code",
    "copy_chart_theme",
    "copy_chart_data",
    "copy_color",
    "set_layout",
    "open_command_menu",
    "click_edit_page",
    "click_registry_add_button",
    "copy_registry_command",
    "keyboard_shortcut_navigate",
    // Browse and purchase journey (PostHog funnels).
    "filter_applied",
    "search_performed",
    "paywall_viewed",
    "checkout_started",
  ]),
  properties: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.null()])
    )
    .optional(),
});

export type Event = z.infer<typeof eventSchema>;

// One call reports to both Vercel Analytics and PostHog. PostHog's capture
// is a no-op when it isn't initialised (no project token), so this is safe
// everywhere on the client.
export const trackEvent = (input: Event): void => {
  const event = eventSchema.parse(input);
  if (event) {
    track(event.name, event.properties);
    posthog.capture(event.name, event.properties);
  }
};
