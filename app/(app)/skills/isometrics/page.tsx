import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { CopyButton } from "@/components/copy-button";
import { Icon } from "@/components/icon";
import { PageTransition } from "@/components/page-transition";
import { AgentSession } from "@/components/skills-page/agent-session";
import { MotionDemo } from "@/components/skills-page/demos";
import {
  Arrow,
  C,
  Eyebrow,
  GRID,
  Note,
  SectionHead,
  Tile,
} from "@/components/skills-page/primitives";
import { ProductStrip } from "@/components/skills-page/product-strip";
import { SkillFolder } from "@/components/skills-page/skill-folder";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";
import { Folder } from "@/registry/isometric/folder";
import { MapPin } from "@/registry/isometric/map-pin";
import { Stopwatch } from "@/registry/isometric/stopwatch";
import { BreadcrumbJsonLd } from "@/seo/json-ld";
import { createPageMetadata } from "@/seo/metadata";

// The free isometrics agent skill's page: a marketing page on a 12-column
// asymmetric grid. Every object on it is a real, live library object; notes
// in Caveat (font-hand) with sketched arrows explain the demos. Keywords
// that steer the skill are blue (<K>) only in the prompt cookbook.
export const metadata: Metadata = createPageMetadata({
  description:
    "A free agent skill for Claude Code, Cursor and Codex: describe an empty state and your agent draws a line isometric object with motion, checked frame by frame.",
  path: ROUTES.SKILLS_ISOMETRICS,
  title: "Isometrics skill",
});

const LIBRARY = `${ROUTES.HOME}?library=isometrics`;
const INSTALL = "npx skills add craftUI012/Skills --skill isometrics";
const ART = { actionLabel: "", description: "", heading: "" } as const;

const InstallChip = ({ tone = "page" }: { tone?: "page" | "brand" }) => (
  <div
    className={cn(
      "flex max-w-full min-w-0 items-center gap-2 rounded-xl py-1.5 pr-1.5 pl-4 font-mono text-sm",
      tone === "page"
        ? "bg-surface dark:bg-card"
        : "bg-brand-foreground/10 text-brand-foreground"
    )}
  >
    <span className="truncate">
      <span className="opacity-60">$ </span>
      {INSTALL}
    </span>
    <CopyButton
      className={cn(
        "relative top-0 right-0 shrink-0",
        tone === "brand" ? "text-brand-foreground bg-transparent" : ""
      )}
      value={INSTALL}
    />
  </div>
);

const TIPS = [
  "Ask for one object. Scenes with several objects aren't part of the skill yet.",
  "Say the state and the message; the motion follows from them.",
  "When it shows three concepts, pick one. If none fit, say whether the object, the message or the beat missed.",
  "Asking for a change? Name the part: the lid, the brand mark, the lines.",
  "Building a set? Ask for them side by side, so they come out at one size and one look.",
];

const FAQ = [
  {
    a: "Yes. The skill, its engine and its examples are MIT: use them in anything, commercial included.",
    q: "Is it free?",
  },
  {
    a: "Any agent that reads skills: Claude Code, Cursor, Codex and others. Install once and choose Symlink to share it between them.",
    q: "Which agents does it work with?",
  },
  {
    a: "React with Tailwind CSS and shadcn/ui, plus the motion package. The skill copies its engine into components/isometrics the first time it runs.",
    q: "What does my project need?",
  },
  {
    a: "Not yet: it draws one object at a time, as an empty state or as art on its own. Our Isometrics library also has ready-made scenes.",
    q: "Can it draw whole scenes?",
  },
];

const SkillPage = () => (
  <PageTransition>
    <BreadcrumbJsonLd
      items={[
        { name: "Home", path: ROUTES.HOME },
        { name: "Isometrics skill", path: ROUTES.SKILLS_ISOMETRICS },
      ]}
    />

    <div className="container flex flex-col gap-28 pt-12 md:gap-36 md:pt-20">
      {/* 1 · Hero: 7 + 5 */}
      <section aria-labelledby="hero" className={GRID}>
        <div className="flex flex-col justify-center gap-6 md:col-span-6">
          <Eyebrow>Free agent skill</Eyebrow>
          <h1
            className={cn(
              TYPE.headingDisplay,
              "font-semibold tracking-tight text-balance"
            )}
            id="hero"
          >
            Describe it.{" "}
            {/* Caveat runs small and wide: up a size, normal tracking. Inline
                font too, as a dev server's CSS can lag the font-hand token. */}
            <span
              className="font-hand text-brand-text text-[1.2em] leading-none font-semibold tracking-normal whitespace-nowrap"
              style={{ fontFamily: "var(--font-hand)" }}
            >
              Your agent draws it.
            </span>
          </h1>
          <p
            className={cn(
              TYPE.pageLead,
              "text-muted-foreground max-w-xl text-pretty"
            )}
          >
            A free skill for Claude Code, Cursor and Codex that turns a two-word
            brief into a line-drawn isometric object with motion, in your theme.
          </p>
          <div className="flex flex-col items-start gap-3">
            <InstallChip />
            <Button
              className="shrink-0"
              variant="outline"
              nativeButton={false}
              render={<Link href={LIBRARY} />}
            >
              See what it makes
              <Icon icon={ArrowRight01Icon} />
            </Button>
          </div>
        </div>
        <div className="md:col-span-6">
          <SkillFolder />
        </div>
      </section>

      {/* 2 · Prompt cookbook + agent session: 5 + 7 */}
      <section aria-labelledby="prompts">
        <AgentSession />
      </section>
    </div>

    {/* 3 · What you get: product strip, full bleed right */}
    <section
      aria-labelledby="bento"
      className="flex flex-col gap-8 py-28 md:gap-10 md:py-36"
    >
      <ProductStrip
        action={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={LIBRARY} />}
          >
            See all isometrics
            <Icon icon={ArrowRight01Icon} />
          </Button>
        }
        head={
          <SectionHead
            eyebrow="What you get"
            id="bento"
            title="Built to drop into a real product"
          />
        }
      />
    </section>

    {/* 4 · Install band: full bleed, 7 + 5 */}
    <section
      aria-labelledby="install"
      className="bg-brand text-brand-foreground py-16 md:py-20"
    >
      <div className="container">
        <div className={GRID}>
          <div className="flex min-w-0 flex-col gap-5 md:col-span-7">
            <p
              className={cn(
                TYPE.cardEyebrow,
                "text-brand-foreground/70 font-medium tracking-wide uppercase"
              )}
            >
              Install
            </p>
            <h2
              className={cn(
                TYPE.headingSection,
                "scroll-mt-24 font-semibold tracking-tight"
              )}
              id="install"
            >
              One command. Every agent.
            </h2>
            <InstallChip tone="brand" />
          </div>
          <ol
            className={cn(
              TYPE.cardBody,
              "text-brand-foreground/85 flex flex-col justify-end gap-2 md:col-span-4 md:col-start-9"
            )}
          >
            <li>1. Run it in your project.</li>
            <li>2. Pick Claude Code, Cursor, Codex or all three.</li>
            <li>3. Choose Symlink: one copy, shared by every agent.</li>
            <li className="text-brand-foreground/65 mt-2">
              Update later with npx skills update.
            </li>
          </ol>
        </div>
      </div>
    </section>

    <div className="container flex flex-col gap-28 py-28 md:gap-36">
      {/* 5 · Bento: what every object does */}
      <section aria-label="What every object does">
        <div className={GRID}>
          <Tile
            body={
              <>
                Every object takes <C>active</C> and <C>onPlayEnd</C>. Your code
                decides when it moves; there&apos;s no button inside the art.
              </>
            }
            className="md:col-span-7 md:row-span-2"
            title="Motion you control"
          >
            <MotionDemo />
            <div className="absolute top-6 right-6 hidden flex-col items-end md:flex">
              <Note>flip it, it plays</Note>
              <Arrow
                className="h-10 w-16"
                d="M50 4 C 54 22, 46 40, 24 52"
                delay={0.3}
                head="M24 40 L24 52 L36 54"
                viewBox="0 0 60 60"
              />
            </div>
          </Tile>
          <Tile
            body="Colours come from your shadcn theme; one small mark takes your brand colour."
            className="md:col-span-5"
            title="Your theme"
          >
            <div className="grid w-full grid-cols-3 items-end gap-3">
              {["primary", "oklch(0.66 0.19 42)", "oklch(0.6 0.15 160)"].map(
                (tone) => (
                  <MapPin
                    {...ART}
                    artClassName="w-full"
                    key={tone}
                    tone={tone}
                  />
                )
              )}
            </div>
          </Tile>
          <Tile
            body="The checker renders every object dark at 4× and fails doubled lines. Left: before. Right: after."
            className="md:col-span-5"
            title="Clean lines, enforced"
          >
            <div className="flex w-full flex-col gap-2">
              <div className="grid w-full grid-cols-2 gap-3">
                <Image
                  alt="A database drawing with doubled lines marked in red"
                  className="h-40 w-full rounded-lg object-cover"
                  height={724}
                  src="/skills/isometrics/database-before.webp"
                  width={560}
                />
                <Image
                  alt="The same database redrawn with clean single lines"
                  className="h-40 w-full rounded-lg object-cover"
                  height={658}
                  src="/skills/isometrics/database-after.webp"
                  width={560}
                />
              </div>
              <Note className="-rotate-2 self-start">
                the checker caught this
              </Note>
            </div>
          </Tile>
          <Tile
            body="Size the art like an icon; the outline stays 1 px at every size."
            className="md:col-span-4"
            title="Any size"
          >
            <div className="flex items-end gap-6">
              <Folder {...ART} artClassName="w-12" />
              <Folder {...ART} artClassName="w-20" />
              <Folder {...ART} artClassName="w-32" />
            </div>
          </Tile>
          <Tile
            body="Dark mode just works, and people who ask for less motion see it at rest."
            className="md:col-span-4"
            title="Dark mode, reduced motion"
          >
            <div className="grid w-full grid-cols-2 overflow-hidden rounded-xl">
              <div className="light bg-background flex justify-center p-4">
                <Stopwatch {...ART} artClassName="w-24" />
              </div>
              <div className="dark bg-background flex justify-center p-4">
                <Stopwatch {...ART} artClassName="w-24" />
              </div>
            </div>
          </Tile>
          <Tile
            body="Not an image: a component in your codebase, with its copy as props."
            className="md:col-span-4"
            title="A real component"
          >
            <pre className="bg-surface dark:bg-background w-full rounded-xl p-4 font-mono text-xs leading-relaxed">
              {`components/isometrics/
├─ iso-core.tsx
├─ iso-line.tsx
└─ folder.tsx   ← yours to edit`}
            </pre>
          </Tile>
        </div>
      </section>

      {/* 6 · Tips + FAQ: 6 + 6 */}
      <section aria-labelledby="tips" className={GRID}>
        <div className="flex flex-col gap-5 md:col-span-6">
          <h2
            className={cn(TYPE.headingPanel, "font-semibold tracking-tight")}
            id="tips"
          >
            Tips for the best output
          </h2>
          <ul
            className={cn(
              TYPE.cardBody,
              "text-muted-foreground flex list-disc flex-col gap-2 pl-5"
            )}
          >
            {TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-3 md:col-span-6">
          <h2 className={cn(TYPE.headingPanel, "font-semibold tracking-tight")}>
            Questions
          </h2>
          <Accordion type="multiple">
            {FAQ.map((item) => (
              <AccordionItem key={item.q} value={item.q}>
                <AccordionTrigger className={TYPE.cardHeader}>
                  {item.q}
                </AccordionTrigger>
                <AccordionContent
                  className={cn(TYPE.cardBody, "text-muted-foreground")}
                >
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* 7 · Closing CTA: centred on 8 */}
      <section aria-labelledby="cta" className={GRID}>
        <div className="flex flex-col items-center gap-6 text-center md:col-span-8 md:col-start-3">
          <h2
            className={cn(
              TYPE.headingSection,
              "font-semibold tracking-tight text-balance"
            )}
            id="cta"
          >
            Your next empty state is one sentence away
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button nativeButton={false} render={<a href="#install" />}>
              Install the skill
              <Icon icon={ArrowRight01Icon} />
            </Button>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={LIBRARY} />}
            >
              See what it makes
            </Button>
          </div>
        </div>
      </section>
    </div>
  </PageTransition>
);

export default SkillPage;
