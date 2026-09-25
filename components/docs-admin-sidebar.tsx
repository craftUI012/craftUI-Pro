"use client";

import { usePathname } from "next/navigation";

import { SidebarPageGroup } from "@/components/docs-sidebar";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";
import { getAllPagesFromFolder } from "@/lib/page-tree";
import type { adminSource } from "@/lib/source";

export const DocsAdminSidebar = ({
  tree,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  tree: typeof adminSource.pageTree;
}) => {
  const pathname = usePathname();

  const rootPages = tree.children.filter((node) => node.type === "page");

  return (
    <Sidebar
      className="text-sidebar-foreground sticky top-[calc(var(--header-height)+0.6rem)] z-30 hidden h-[calc(100svh-10rem)] flex-col overscroll-none bg-transparent [--sidebar-menu-width:--spacing(48)] lg:flex"
      collapsible="none"
      {...props}
    >
      <div className="h-9" />
      <div className="absolute top-8 z-10 h-8 w-(--sidebar-menu-width) shrink-0 bg-linear-to-b from-background via-background/80 to-background/50 blur-xs" />
      <div className="absolute top-12 right-2 bottom-0 hidden h-full w-px bg-linear-to-b from-transparent via-border to-transparent lg:flex" />
      <SidebarContent className="mx-auto no-scrollbar w-(--sidebar-menu-width) overflow-x-hidden px-2 pt-6">
        <SidebarPageGroup
          label="Docs Admin"
          pages={rootPages}
          pathname={pathname}
        />
        {tree.children.map((item) =>
          item.type === "folder" ? (
            <SidebarPageGroup
              key={item.$id}
              label={item.name}
              pages={getAllPagesFromFolder(item)}
              pathname={pathname}
            />
          ) : null
        )}
        <div className="from-background via-background/80 to-background/50 sticky -bottom-1 z-10 h-16 shrink-0 bg-linear-to-t blur-xs" />
      </SidebarContent>
    </Sidebar>
  );
};
