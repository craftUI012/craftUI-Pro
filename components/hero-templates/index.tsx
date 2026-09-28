import { DevicePreview } from "@/components/hero-templates/device-preview";
import { TemplatesCta } from "@/components/hero-templates/templates-cta";
import { RHYTHM } from "@/constants/rhythm";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Server entry for the templates showcase: header, then one full template on
// a desktop, tablet or phone mockup (device-preview.tsx), then the CTA on
// phones. The page speaks for itself, so there's no per-section commentary.
//
// Rhythm: minor inside the header text, major between header > preview >
// CTA, section padding = 2 x major. CTA beside the header from md up,
// full-width after the preview on phones, as in the other sections. It's the
// page's primary (brand) action: templates are the Pro offer.
export const TemplatesSection = () => (
  <section aria-labelledby="templates-heading" className="container-wrapper">
    <div
      className={cn("container flex flex-col", RHYTHM.major, RHYTHM.section)}
    >
      <header
        className={cn(
          "flex flex-col md:flex-row md:items-end md:justify-between",
          RHYTHM.major
        )}
      >
        <div className={cn("flex max-w-2xl flex-col", RHYTHM.minor)}>
          <span
            className={cn(TYPE.cardEyebrow, "text-muted-foreground uppercase")}
          >
            Templates
          </span>
          <h2
            id="templates-heading"
            className={cn(TYPE.headingSection, "text-balance")}
          >
            Full pages, ready to launch
          </h2>
          <p className={cn(TYPE.pageLead, "text-muted-foreground text-pretty")}>
            Complete landing pages, from the first headline to the last call to
            action, that fit every screen your visitors use.
          </p>
        </div>
        <TemplatesCta className="hidden shrink-0 md:inline-flex" />
      </header>

      <DevicePreview />

      <TemplatesCta className="w-full md:hidden" />
    </div>
  </section>
);
