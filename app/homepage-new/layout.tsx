import { NewHomeShell } from "@/components/new-hero-section";

// Outside the (app) group on purpose: /homepage-new brings its own rail and
// top bar, so it doesn't get the site header and footer.
//
// The shell lives here, not in the page, so it stays mounted while the reader
// moves between the browse page and the docs pages (/homepage-new/docs/...).
// That's what lets the rail animate from one menu to the other.
export default function HomepageNewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-svh">
      <NewHomeShell>{children}</NewHomeShell>
    </div>
  );
}
