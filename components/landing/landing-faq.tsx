import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { FAQ } from "@/constants/faq";

export const LandingFaq = () => (
  <section
    id="faq"
    className="relative py-20 md:py-28 bg-muted/20 border-t border-border/50"
  >
    <div className="container mx-auto max-w-4xl px-4">
      {/* Header */}
      <div className="mx-auto max-w-2xl text-center">
        <Badge
          variant="outline"
          className="mb-3 rounded-full px-3 py-1 text-xs"
        >
          FAQ
        </Badge>
        <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
          Frequently asked questions
        </h2>
        <p className="mt-4 text-base text-muted-foreground sm:text-lg">
          Everything you need to know about craftUI, ownership, licensing, and
          installation.
        </p>
      </div>

      {/* FAQ Accordion */}
      <div className="mt-12">
        <Accordion type="single" collapsible className="w-full space-y-4">
          {FAQ.map((item, index) => (
            <AccordionItem
              key={index}
              value={`faq-${index}`}
              className="rounded-2xl border border-border/70 bg-card px-6 py-1 shadow-xs transition hover:border-border"
            >
              <AccordionTrigger className="text-left text-base font-semibold hover:no-underline">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  </section>
);
