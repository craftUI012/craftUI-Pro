// The Studio's choices: what the admin picks before the director plans a
// video. Plain data, safe for client components.

export const VIDEO_TYPES = [
  {
    description:
      "Hook, install, use it in code, see it live, CTA. For developers.",
    id: "tutorial",
    label: "Tutorial",
  },
  {
    description:
      "Screen-record style: phone frames, light and dark, quick cuts, POV hooks.",
    id: "ugc",
    label: "UGC",
  },
  {
    description:
      "Interface Craft lists the component's design-engineering features; each gets one scene, motion centred, a short caption on top.",
    id: "showcase",
    label: "Showcase",
  },
] as const;

export const HOOK_STYLES = [
  {
    description: "A confident statement of the payoff.",
    id: "bold-claim",
    label: "Bold claim",
  },
  {
    description: "A question the viewer answers yes to.",
    id: "question",
    label: "Question",
  },
  {
    description: "The common way, then this way.",
    id: "before-after",
    label: "Before / after",
  },
  {
    description: "“POV: you …” in the viewer's shoes.",
    id: "pov",
    label: "POV",
  },
  {
    description: "Call out a habit and replace it.",
    id: "stop-doing",
    label: "Stop doing X",
  },
] as const;

export const AUDIENCES = [
  { id: "both", label: "Developers and founders" },
  { id: "developers", label: "Developers" },
  { id: "founders", label: "Startup founders" },
] as const;

export const LENGTHS = [
  { id: 15, label: "About 15 s" },
  { id: 30, label: "About 30 s" },
  { id: 45, label: "About 45 s" },
] as const;

/** The video's ground (video-director, references/look.md). Auto builds it
 *  from the component's own colours. */
export const GROUNDS = [
  { id: "auto", label: "Auto (from the component)" },
  { id: "aurora", label: "Aurora" },
  { id: "glow", label: "Glow" },
  { id: "ink", label: "Ink" },
  { id: "paper", label: "Paper" },
  { id: "flat", label: "Flat" },
] as const;

/** The series handle, top right of every video (growth.md). Change it
 *  here when the account's name is settled. */
export const SOCIAL_HANDLE = "@craftui";

/** The one ask on every end card. "Link in bio" until a comment-to-DM
 *  automation exists; then "Comment CRAFT for the code". */
export const VIDEO_ASK = "Link in bio";

export type VideoTypeId = (typeof VIDEO_TYPES)[number]["id"];
export type GroundId = (typeof GROUNDS)[number]["id"];
export type HookStyleId = (typeof HOOK_STYLES)[number]["id"];
export type AudienceId = (typeof AUDIENCES)[number]["id"];
/** Not a brief choice: the director picks the opening theme and shows the
 * other one as a feature. */
export type ThemeId = "dark" | "light";
export type LengthId = (typeof LENGTHS)[number]["id"];

export interface StudioComponentOption {
  name: string;
  title: string;
  library: string;
  paid: boolean;
}
