import { notFound } from "next/navigation";

import { DocsAdminSidebar } from "@/components/docs-admin-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { showDocsAdmin } from "@/lib/flags";
import { adminSource } from "@/lib/source";

export default function DocsAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!showDocsAdmin) {
    notFound();
  }

  return (
    <div className="container-wrapper flex flex-1 flex-col px-2">
      <SidebarProvider className="3xl:fixed:container 3xl:fixed:px-3 min-h-min flex-1 items-start px-0 [--sidebar-width:220px] [--top-spacing:0] lg:grid lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:[--sidebar-width:240px] lg:[--top-spacing:calc(var(--spacing)*4)]">
        <DocsAdminSidebar tree={adminSource.pageTree} />
        <div className="h-full w-full">{children}</div>
      </SidebarProvider>
    </div>
  );
}
