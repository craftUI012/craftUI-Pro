import { NewHomeShell } from "@/components/new-hero-section";
import { SiteFooter } from "@/components/site-footer";
import { WebMcpTools } from "@/components/web-mcp-tools";
import { AGENT_DOCS_DIRECTIVE_TEXT } from "@/lib/agent-discovery/directive";

// The site pages (pricing, sign-in, dashboard, the admin pages), in the same
// browse shell as the home page and the docs, so every page has one navbar.
// On these pages the shell shows only its top bar; the footer is theirs.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background min-h-svh">
      <blockquote className="sr-only">{AGENT_DOCS_DIRECTIVE_TEXT}</blockquote>
      <WebMcpTools />
      <NewHomeShell>
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
      </NewHomeShell>
    </div>
  );
}
