import type { Metadata } from "next";
import Link from "next/link";

import { PageTransition } from "@/components/page-transition";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ } from "@/constants/faq";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";
import { BreadcrumbJsonLd, FaqPageJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

// What craftUI is, how it works, and the FAQ. It took over the old /docs
// introduction (next.config.mjs redirects /docs here). The FAQ's text is in
// constants/faq.ts, shared with the FAQPage structured data.
export const metadata: Metadata = createPageMetadata({
  description:
    "What craftUI is, how it works and answers to common questions: shadcn/ui sections, blocks and illustrations you install with one command.",
  path: ROUTES.ABOUT,
  title: "About",
});

const REASONS = [
  {
    body: "Items are copied into your project, not hidden inside a package. Change anything.",
    title: "You own the code",
  },
  {
    body: "Items use shadcn's CSS variables (bg-primary, text-muted-foreground and so on), so they pick up your colours, radius and dark mode.",
    title: "Works with your theme",
  },
  {
    body: "npx shadcn add installs the item, its npm dependencies and any shadcn primitives it needs.",
    title: "One command to install",
  },
  {
    body: "React 19, TypeScript, Tailwind CSS v4 and Motion.",
    title: "Built with",
  },
];

const STEPS = [
  {
    id: "setup",
    text: (
      <>
        Set up shadcn/ui in your project (see{" "}
        <Link
          href={ROUTES.DOCS_INSTALLATION}
          className="text-foreground font-medium underline underline-offset-4"
        >
          Installation
        </Link>
        ).
      </>
    ),
  },
  {
    id: "pick",
    text: (
      <>
        Pick a section, block or illustration on the{" "}
        <Link
          href={ROUTES.HOME}
          className="text-foreground font-medium underline underline-offset-4"
        >
          browse page
        </Link>
        .
      </>
    ),
  },
  {
    id: "install",
    text: (
      <>
        Copy its install command from its page and run it in your project:
        <code className="bg-surface dark:bg-card mt-2 block overflow-x-auto rounded-md px-3 py-2 font-mono text-sm">
          npx shadcn@latest add {SITE.URL}/r/&lt;item&gt;.json
        </code>
      </>
    ),
  },
  { id: "use", text: "Import it from your components folder and use it." },
];

const AboutPage = () => (
  <PageTransition>
    <BreadcrumbJsonLd
      items={[
        { name: "Home", path: ROUTES.HOME },
        { name: "About", path: ROUTES.ABOUT },
      ]}
    />
    <FaqPageJsonLd items={FAQ} />

    <article className="container-wrapper">
      <div className="container flex max-w-3xl flex-col gap-16 py-16">
        <header className="flex flex-col gap-4">
          <h1 className={cn(TYPE.headingHero, "font-bold tracking-tight")}>
            About {SITE.NAME}
          </h1>
          <p className={cn(TYPE.pageLead, "text-muted-foreground text-pretty")}>
            {SITE.NAME} is a collection of crafted, production-ready sections,
            blocks, illustrations and isometric art built on top of{" "}
            <a
              href="https://ui.shadcn.com"
              className="text-foreground font-medium underline underline-offset-4"
            >
              shadcn/ui
            </a>
            . Every item is distributed through a shadcn registry, so you
            install it with the shadcn CLI and the source code lands directly in
            your project.
          </p>
        </header>

        <section aria-labelledby="why" className="flex flex-col gap-6">
          <h2
            id="why"
            className={cn(TYPE.headingSection, "font-semibold tracking-tight")}
          >
            Why {SITE.NAME}
          </h2>
          <dl className="grid gap-6 sm:grid-cols-2">
            {REASONS.map((reason) => (
              <div key={reason.title} className="flex flex-col gap-1">
                <dt className={cn(TYPE.cardHeader, "font-medium")}>
                  {reason.title}
                </dt>
                <dd className={cn(TYPE.cardBody, "text-muted-foreground")}>
                  {reason.body}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="how" className="flex flex-col gap-6">
          <h2
            id="how"
            className={cn(TYPE.headingSection, "font-semibold tracking-tight")}
          >
            How it works
          </h2>
          <ol
            className={cn(
              TYPE.cardBody,
              "text-muted-foreground flex list-decimal flex-col gap-3 pl-5"
            )}
          >
            {STEPS.map((step) => (
              <li key={step.id}>{step.text}</li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq" className="flex flex-col gap-4">
          <h2
            id="faq"
            className={cn(TYPE.headingSection, "font-semibold tracking-tight")}
          >
            FAQ
          </h2>
          <Accordion type="multiple">
            {FAQ.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger className={TYPE.cardHeader}>
                  {item.question}
                </AccordionTrigger>
                <AccordionContent
                  className={cn(TYPE.cardBody, "text-muted-foreground")}
                >
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
          <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
            Ready to start?{" "}
            <Link
              href={ROUTES.PRICING}
              className="text-foreground font-medium underline underline-offset-4"
            >
              See the plans
            </Link>
            .
          </p>
        </section>
      </div>
    </article>
  </PageTransition>
);

export default AboutPage;
