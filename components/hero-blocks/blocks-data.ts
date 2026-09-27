// Blocks shown in the showcase grid, in order. `id` is a kit card from the
// Design Admin kit (FINANCE_CARDS / APP_CARDS); the rest is the card footer.
// `title` names what the block is for: the live preview already shows the
// component's own heading, so the footer shouldn't repeat it.
export const SHOWCASE_BLOCKS = [
  {
    category: "Finance",
    id: "contribution-history",
    title: "Savings over time",
    uses: ["Bar chart", "Card", "Button"],
  },
  {
    category: "Scheduling",
    id: "upcoming-payments",
    title: "Payment scheduler",
    uses: ["Calendar", "List"],
  },
  {
    category: "Analytics",
    id: "traffic-channels",
    title: "Traffic by device",
    uses: ["Bar chart", "Legend"],
  },
  {
    category: "Team",
    id: "invite-team",
    title: "Team invites",
    uses: ["Input", "Select", "Button"],
  },
  {
    category: "Payments",
    id: "transfer-funds",
    title: "Account transfer",
    uses: ["Form", "Select"],
  },
  {
    category: "Smart home",
    id: "kitchen-island",
    title: "Lighting controls",
    uses: ["Switch", "Slider", "Toggle group"],
  },
] as const;

export type ShowcaseBlockId = (typeof SHOWCASE_BLOCKS)[number]["id"];
