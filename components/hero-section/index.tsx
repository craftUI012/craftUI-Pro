import { HeroCopy } from "@/components/hero-section/hero-copy";
import { HeroFog } from "@/components/hero-section/hero-fog";
import { HeroStage } from "@/components/hero-section/hero-stage";
import { HeroWallLazy } from "@/components/hero-section/hero-wall-lazy";

// Server entry. The client stage only owns scene state + motion; the copy and
// fog are rendered here on the server and passed through as slots.
//
// Scene 1: the copy panel sits centered on an empty stage.
// Scene 2: the panel morphs (layoutId "hero-panel") to the top-left while the
//          3D wall of live kit cards staggers in around it.
export const HeroSection = () => (
  <section aria-labelledby="hero-heading" className="container-wrapper">
    <div className="relative h-[calc(100svh-var(--header-height))] max-h-[60rem] min-h-[36rem] overflow-hidden">
      <HeroStage
        copy={<HeroCopy />}
        fog={<HeroFog />}
        wall={<HeroWallLazy />}
      />
    </div>
  </section>
);
