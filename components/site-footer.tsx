"use client";

import Link from "next/link";

import { LINK } from "@/constants/links";
import { ROUTES } from "@/constants/routes";
import { SITE, UTM_PARAMS } from "@/constants/site";
import { useFeedback } from "@/hooks/use-feedback";
import { addQueryParams } from "@/lib/url";

export const SiteFooter = () => {
  const playClick = useFeedback({ sound: "click" });

  return (
    <footer
      className="group-has-[.section-soft]/body:bg-surface/40 3xl:fixed:bg-transparent group-has-[.docs-nav]/body:pb-20 group-has-[.docs-nav]/body:sm:pb-0 dark:bg-transparent"
      style={{ viewTransitionName: "site-footer" }}
    >
      <div className="container-wrapper px-4 xl:px-6">
        <div className="flex h-(--footer-height) items-center justify-between">
          <div className="text-muted-foreground w-full px-1 text-center text-xs leading-loose sm:text-sm">
            Built by{" "}
            <a
              href={addQueryParams(LINK.GITHUB_ORG, UTM_PARAMS)}
              target="_blank"
              rel="noreferrer"
              className="font-medium underline underline-offset-4"
              onClick={playClick}
            >
              {SITE.AUTHOR.NAME}
            </a>
            {/* A crawlable link to the about page from every site page. */}
            {" · "}
            <Link
              href={ROUTES.ABOUT}
              className="font-medium underline underline-offset-4"
              onClick={playClick}
            >
              About
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
