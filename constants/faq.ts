// The FAQ on the about page (app/(app)/about). Plain text on purpose: the
// same answers go into the page's FAQPage structured data, which takes text,
// not markup. Freemium wording only, and no prices: those live on /pricing.
export const FAQ: { answer: string; question: string }[] = [
  {
    answer:
      "craftUI is a library of production-ready sections, blocks, illustrations and isometric art for SaaS and startup sites, built on shadcn/ui with Tailwind CSS and Motion. You install each item with the shadcn CLI, and its source lands in your project.",
    question: "What is craftUI?",
  },
  {
    answer:
      "Copying the source gives you ownership of the code. You can adapt every item to your product without fighting a library's API or waiting for upstream releases.",
    question: "Why copy the source instead of installing an npm package?",
  },
  {
    answer:
      "Any React framework that shadcn/ui supports: Next.js, React Router, Astro, Vite, TanStack Start and others.",
    question: "Which frameworks are supported?",
  },
  {
    answer:
      "Yes. Items are styled with Tailwind CSS utility classes and shadcn's CSS variables, the same as shadcn/ui itself, so they pick up your colours, radius and dark mode.",
    question: "Do I need to use Tailwind CSS?",
  },
  {
    answer:
      "craftUI is freemium. Some items are free to install; the rest are included in a paid plan. Every preview is free to explore. The plans are on the pricing page.",
    question: "Is craftUI free?",
  },
  {
    answer:
      "No. Pay with your email at checkout, then sign in with a magic link sent to that same email. Your access is unlocked as soon as you sign in.",
    question: "Do I need an account before I buy?",
  },
  {
    answer:
      "Sign in, open the item's page and copy its install command. It carries your personal access link, so run it in your project as it is and the shadcn CLI adds the files.",
    question: "How do I install a paid item?",
  },
  {
    answer:
      "Everything you already installed stays in your project: the code is yours. Viewing the source and installing more items need an active plan again.",
    question: "What happens when a yearly plan ends?",
  },
];
