import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import Link from "next/link";

import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";
import { Folder } from "@/registry/isometric/folder";
import { PlayOnHover } from "@/registry/isometric/iso-line";

// The Isometrics tab's banner, between the filters and the grid: the free
// isometrics agent skill, in the brand colour, with one object from the
// skill's examples playing on hover and a button to /skills/isometrics.
export const IsometricsSkillBanner = () => (
  <section
    aria-labelledby="isometrics-skill-banner"
    className="bg-brand text-brand-foreground relative flex flex-col gap-6 overflow-hidden rounded-xl p-6 md:flex-row md:items-center md:justify-between md:gap-10 md:p-8"
  >
    <div className="flex max-w-xl flex-col gap-3">
      <p
        className={cn(
          TYPE.cardEyebrow,
          "text-brand-foreground/75 font-medium tracking-wide uppercase"
        )}
      >
        Free agent skill
      </p>
      <h2
        id="isometrics-skill-banner"
        className={cn(TYPE.headingPanel, "font-semibold tracking-tight")}
      >
        Draw your own isometrics with your coding agent
      </h2>
      <p className={cn(TYPE.cardBody, "text-brand-foreground/80 text-pretty")}>
        Describe an empty state and get a line-drawn isometric object with
        motion, in your theme. Works with Claude Code, Cursor and Codex.
      </p>
      <div className="mt-2">
        <Button
          variant="secondary"
          nativeButton={false}
          render={<Link href={ROUTES.SKILLS_ISOMETRICS} />}
        >
          Get the skill
          <Icon icon={ArrowRight01Icon} />
        </Button>
      </div>
    </div>

    {/* One of the skill's own examples, art only, on a paper tile. */}
    <div className="bg-background text-foreground hidden shrink-0 items-center justify-center rounded-lg p-6 md:flex">
      <PlayOnHover>
        <Folder
          actionLabel=""
          artClassName="w-36"
          description=""
          heading=""
          title="A folder whose pages pop out"
        />
      </PlayOnHover>
    </div>
  </section>
);
