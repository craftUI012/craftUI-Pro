import { HERO_REVEAL_CLASS } from "@/components/hero-section/hero-data";
import { HeroReveal } from "@/components/hero-section/hero-reveal";
import { HomeCtas } from "@/components/home-ctas";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// Server component: the heading ships in the initial HTML so it paints before
// any JS runs. The install command lives on the installation page (Get
// Started), not in the hero.
//
// Scene 1 shows the promise (brand + headline); the subcopy and actions are
// revealed with scene 2 (HeroReveal). Everything is in the HTML either way.
//
// Copy is written for two readers: developers judging quality, and business
// builders shipping with AI tools whose output tends to look generic.
export const HeroCopy = () => (
  <div className="flex max-w-xl flex-col items-start gap-5">
    {/* Without JS the scene never advances, so keep the reveal visible. */}
    <noscript>
      <style>{`.${HERO_REVEAL_CLASS}{opacity:1!important;transform:none!important}`}</style>
    </noscript>
    {/* No `uppercase`: the brand keeps its own casing. */}
    <span className={cn(TYPE.cardEyebrow, "text-muted-foreground")}>
      craftUI Pro
    </span>
    <h1 id="hero-heading" className={cn(TYPE.headingHero, "text-balance")}>
      Build apps that look like a design team made them.
    </h1>
    <HeroReveal order={0}>
      <p className={cn(TYPE.pageLead, "text-muted-foreground text-pretty")}>
        The first UI library that ships its full design system with the code.
        Colors, type, spacing and components come ready for your team and for
        the AI tools you build with.
      </p>
    </HeroReveal>
    <HeroReveal order={1}>
      <HomeCtas className="justify-start pt-2" />
    </HeroReveal>
  </div>
);
