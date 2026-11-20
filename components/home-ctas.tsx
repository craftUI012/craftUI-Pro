"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";

import { ArrowRightIcon } from "@/components/animated-icons/arrow-right";
import type { ArrowRightIconHandle } from "@/components/animated-icons/arrow-right";
import { ComponentIcon } from "@/components/animated-icons/component";
import type { ComponentIconHandle } from "@/components/animated-icons/component";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const GetStartedButton = () => {
  const arrowRightRef = useRef<ArrowRightIconHandle>(null);

  const handleMouseEnter = useCallback(() => {
    arrowRightRef.current?.startAnimation();
  }, []);

  const handleMouseLeave = useCallback(() => {
    arrowRightRef.current?.stopAnimation();
  }, []);

  return (
    <Button
      sound="click"
      className="px-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      nativeButton={false}
      render={
        <Link
          href={ROUTES.DOCS_INSTALLATION}
          transitionTypes={["nav-forward"]}
        />
      }
    >
      Get Started
      <ArrowRightIcon ref={arrowRightRef} />
    </Button>
  );
};

const BrowseComponentsButton = () => {
  const componentIconRef = useRef<ComponentIconHandle>(null);

  const handleMouseEnter = useCallback(() => {
    componentIconRef.current?.startAnimation();
  }, []);

  const handleMouseLeave = useCallback(() => {
    componentIconRef.current?.stopAnimation();
  }, []);

  return (
    <Button
      variant="outline"
      sound="click"
      className="px-4"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      nativeButton={false}
      render={
        <Link href={ROUTES.DOCS_COMPONENTS} transitionTypes={["nav-forward"]} />
      }
    >
      <ComponentIcon ref={componentIconRef} size={22} />
      Browse Components
    </Button>
  );
};

export const HomeCtas = ({ className }: { className?: string }) => (
  <div
    className={cn(
      "flex flex-wrap items-center justify-center gap-4",
      className
    )}
  >
    <GetStartedButton />
    <BrowseComponentsButton />
  </div>
);
