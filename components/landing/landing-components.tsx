"use client";

import {
  ArrowRight,
  Blocks,
  Box,
  Component,
  LayoutTemplate,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { BrowseCard } from "@/components/new-hero-section/browse/browse-card";
import type { ShowcaseItem } from "@/components/new-hero-section/data/home-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";

export interface CategoryData {
  id: string;
  label: string;
  description: string;
  icon: typeof Component;
  items: ShowcaseItem[];
  totalCount: number;
}

const CATEGORY_TABS = [
  {
    description:
      "Full-page heroes, pricing matrices, benchmarks and testimonial walls.",
    icon: LayoutTemplate,
    id: "sections",
    label: "Sections",
  },
  {
    description:
      "Interactive prompt composers, voice membrane visualizers, and animated charts.",
    icon: Blocks,
    id: "blocks",
    label: "Blocks",
  },
  {
    description:
      "Magnetic buttons, animated switches, and custom input micro-interactions.",
    icon: Component,
    id: "components",
    label: "Components",
  },
  {
    description:
      "Vector isometric scenes and devtool diagrams with mathematical precision.",
    icon: Box,
    id: "illustrations",
    label: "Illustrations & 3D",
  },
];

const toLibraryParam = (tabId: string) => {
  if (tabId === "sections") {
    return "templates";
  }
  if (tabId === "illustrations") {
    return "isometric";
  }
  return tabId;
};

export const LandingComponents = ({
  categories,
}: {
  categories: Record<string, ShowcaseItem[]>;
}) => {
  const [activeTab, setActiveTab] = React.useState("sections");

  return (
    <section id="components" className="relative py-20 md:py-28">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            className="mb-3 rounded-full px-3 py-1 text-xs"
          >
            Component Registry
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">
            Designed for every part of your product
          </h2>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Explore production-ready components categorized for rapid discovery.
            All styled with Tailwind CSS and Motion.
          </p>
        </div>

        {/* Category Tabs */}
        <div className="mt-12 flex justify-center">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="flex justify-center">
              <TabsList className="h-auto flex-wrap gap-1 rounded-full border border-border/70 bg-muted/40 p-1.5 backdrop-blur-md">
                {CATEGORY_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const count = categories[tab.id]?.length || 0;
                  return (
                    <TabsTrigger
                      key={tab.id}
                      value={tab.id}
                      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition sm:text-sm data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
                    >
                      <Icon className="size-4" />
                      <span>{tab.label}</span>
                      {count > 0 && (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          {count}
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {CATEGORY_TABS.map((tab) => {
              const items = categories[tab.id]?.slice(0, 6) || [];
              return (
                <TabsContent
                  key={tab.id}
                  value={tab.id}
                  className="mt-10 outline-none"
                >
                  {/* Category description */}
                  <p className="mb-8 text-center text-sm text-muted-foreground">
                    {tab.description}
                  </p>

                  {/* Cards Grid */}
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((item) => (
                      <div key={item.id} className="group">
                        <BrowseCard item={item} />
                      </div>
                    ))}
                  </div>

                  {/* Bottom link to full browse category */}
                  <div className="mt-12 flex justify-center">
                    <Button
                      asChild
                      variant="outline"
                      size="lg"
                      className="rounded-full px-6 font-medium"
                    >
                      <Link
                        href={`${ROUTES.BROWSE}?library=${toLibraryParam(tab.id)}`}
                      >
                        Browse all {tab.label.toLowerCase()} in catalog
                        <ArrowRight className="ml-2 size-4" />
                      </Link>
                    </Button>
                  </div>
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </div>
    </section>
  );
};
