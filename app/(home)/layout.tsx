import { NewHomeShell } from "@/components/new-hero-section";
import { WebMcpTools } from "@/components/web-mcp-tools";
import { AGENT_DOCS_DIRECTIVE_TEXT } from "@/lib/agent-discovery/directive";

// The home page (/) and the docs (/docs/...), in the browse shell. Outside the
// (app) group on purpose: the shell brings its own rail and top bar, so it
// doesn't get the site header and footer. The agent directive and WebMCP
// tools the (app) layout carries come along.
//
// The shell lives here, not in the pages, so it stays mounted while the
// reader moves between the browse page and the docs pages. That's what lets
// the rail animate from one menu to the other.
export default function HomeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-svh">
      <blockquote className="sr-only">{AGENT_DOCS_DIRECTIVE_TEXT}</blockquote>
      <WebMcpTools />
      <NewHomeShell>{children}</NewHomeShell>
    </div>
  );
}
