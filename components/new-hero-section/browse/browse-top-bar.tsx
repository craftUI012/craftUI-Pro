"use client";

import { SearchIcon, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandContextMenu } from "@/components/brand-context-menu";
import { LogoMark } from "@/components/logo";
import type {
  FilterGroupId,
  LibraryId,
} from "@/components/new-hero-section/data/home-types";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/constants/routes";
import { SITE } from "@/constants/site";
import { TYPE } from "@/constants/typography";
import { useAccess } from "@/hooks/use-access";
import { useIsMac } from "@/hooks/use-is-mac";
import { useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export interface LibraryTab {
  id: LibraryId;
  label: string;
  searchPlaceholder: string;
  // The library's key in the URL (/?library=blocks).
  slug: string;
  // The values each filter group can pick (listed and with items), for
  // reading filters from the URL (browse-url.ts).
  filters: Partial<Record<FilterGroupId, string[]>>;
}

export interface NavLink {
  href: string;
  label: string;
}

// Site pages, listed by the (commented-out) rail's phone drawer. The navbar
// shows only Pricing (see below).
export const SITE_NAV = [
  { href: ROUTES.PRICING, label: "Pricing" },
  { href: ROUTES.BLOG, label: "Blog" },
] as const;

// The previous top bar's primary CTA. Not in the navbar for now.
// const PRIMARY_CTA = { href: ROUTES.DOCS_INSTALLATION, label: "Get started" };

// One type for every navbar item, tabs and links alike: card-label
// (14px · 500), the same role as the brand and the search field, so the
// whole bar reads at one size.
const NAV_TYPE = TYPE.cardLabel;

// "Sign in" for visitors, "Dashboard" once signed in. The session loads on
// the client, so the page itself stays static. Until it's known, it shows
// "Sign in", the more common case, so nothing shifts for most visitors.
export const useAccountLink = () => {
  const { data } = useSession();
  return data?.user
    ? { href: ROUTES.DASHBOARD, label: "Dashboard" }
    : { href: ROUTES.LOGIN, label: "Sign in" };
};

// Search field styled like the site header's docs search button (h-8,
// bg-surface, ⌘K hint), with TYPE.cardLabel text. It's a real input: it
// filters the grid (browse) as you type, Enter opens the first docs match
// (docs), and Escape clears it (and closes the phone row via onEscape).
// Rendered twice: inline in the navbar from md up, and as the phone search
// row under it.
const BrowseSearch = ({
  className,
  fieldClassName,
  inputRef,
  onEscape,
  onQueryChange,
  onSubmit,
  placeholder,
  query,
}: {
  className?: string;
  fieldClassName?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEscape?: () => void;
  onQueryChange: (query: string) => void;
  onSubmit: () => void;
  placeholder: string;
  query: string;
}) => {
  const isMac = useIsMac();

  return (
    <search className={className}>
      <label
        className={cn(
          "bg-surface dark:bg-card text-surface-foreground focus-within:ring-ring/50 relative flex h-8 items-center gap-2 rounded-md pr-2 pl-2.5 transition-shadow duration-150 ease-out focus-within:ring-[3px]",
          fieldClassName
        )}
      >
        <SearchIcon aria-hidden className="size-4 shrink-0 opacity-60" />
        <span className="sr-only">{placeholder}</span>
        <input
          ref={inputRef}
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onQueryChange("");
              event.currentTarget.blur();
              onEscape?.();
            } else if (event.key === "Enter") {
              onSubmit();
            }
          }}
          className={cn(
            TYPE.cardLabel,
            "text-foreground placeholder:text-surface-foreground/60 min-w-0 flex-1 bg-transparent outline-none [&::-webkit-search-cancel-button]:hidden"
          )}
        />
        {/* The hint hides once there's text, so it never covers the query. */}
        <span
          aria-hidden
          className={cn("hidden gap-1 md:flex", query && "md:hidden")}
        >
          <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>
          <Kbd className="aspect-square">K</Kbd>
        </span>
      </label>
    </search>
  );
};

// Client component, the full-width navbar at the top of the shell (the left
// rail is commented out for now; see browse-shell.tsx).
//
//   [logo] craftUI   Sections  Blocks  Illustrations  Isometric
//                          [Search ⌘K]  (Admin panel)  Pricing  [Sign in]
//
// The library switch is a shadcn TabsList: its triggers drive the shell's
// <Tabs>, whose TabsContent panels are the browse grids (browse-panels.tsx).
// The right side holds the search, Docs admin and Design admin (development
// only, from md up), Admin panel (signed-in admins only), Pricing as a quiet
// ghost link, and Sign in (or Dashboard once signed in) as the one filled
// button.
//
// Below lg the tabs drop to a second row. On phones the search also becomes
// an icon button that opens a search row under the bar.
export const BrowseTopBar = ({
  devLinks,
  inputRef,
  libraries,
  onQueryChange,
  onSearchOpenChange,
  onSubmitSearch,
  phoneInputRef,
  placeholder,
  query,
  searchOpen,
}: {
  // Development-only internal pages (empty in production).
  devLinks: NavLink[];
  inputRef: React.RefObject<HTMLInputElement | null>;
  libraries: LibraryTab[];
  onQueryChange: (query: string) => void;
  onSearchOpenChange: (open: boolean) => void;
  onSubmitSearch: () => void;
  phoneInputRef: React.RefObject<HTMLInputElement | null>;
  placeholder: string;
  query: string;
  searchOpen: boolean;
}) => {
  const account = useAccountLink();
  const onPricing = usePathname() === ROUTES.PRICING;
  // Admins (ADMIN_EMAILS, checked by /api/access on the server) get a link to
  // the admin panel. Everyone else never sees it; the panel checks again.
  const { isAdmin } = useAccess();

  return (
    <header className="bg-background/90 sticky top-0 z-40 backdrop-blur">
      <div className="container flex flex-wrap items-center gap-x-6 lg:h-(--header-height) lg:flex-nowrap">
        {/* Right-click the brand to copy or download the logo SVG. */}
        <BrandContextMenu>
          <Link
            href={ROUTES.HOME}
            transitionTypes={["nav-back"]}
            className={cn(
              TYPE.cardLabel,
              "text-foreground focus-visible:ring-ring/50 flex h-(--header-height) shrink-0 items-center gap-2 rounded-md outline-none focus-visible:ring-[3px] lg:h-9"
            )}
          >
            <LogoMark className="size-5" />
            {SITE.NAME}
          </Link>
        </BrandContextMenu>

        {/* Library tabs. A second row below lg (order-last, full width,
            scrolls sideways on narrow phones), inline after the brand from
            lg up, where the four tabs and the search fit on one line. */}
        <div className="no-scrollbar order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-2 lg:order-none lg:mx-0 lg:w-auto lg:overflow-visible lg:p-0">
          <TabsList
            aria-label="Library"
            className="h-auto gap-1 bg-transparent p-0"
          >
            {libraries.map((library) => (
              <TabsTrigger
                key={library.id}
                value={library.id}
                sound="click"
                className={cn(
                  NAV_TYPE,
                  "text-muted-foreground hover:text-foreground data-[state=active]:bg-accent data-[state=active]:text-accent-foreground dark:data-[state=active]:bg-accent dark:data-[state=active]:text-accent-foreground dark:text-muted-foreground h-8 flex-none px-3 transition-[color,background-color,box-shadow] duration-150 ease-out data-[state=active]:shadow-none dark:data-[state=active]:border-transparent"
                )}
              >
                {library.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <BrowseSearch
            className="mr-2 hidden md:flex"
            fieldClassName="w-56 lg:w-64 xl:w-72"
            inputRef={inputRef}
            placeholder={placeholder}
            query={query}
            onQueryChange={onQueryChange}
            onSubmit={onSubmitSearch}
          />
          <Button
            variant="ghost"
            size="icon"
            sound="click"
            aria-label={searchOpen ? "Close search" : "Search"}
            aria-expanded={searchOpen}
            aria-controls="browse-phone-search"
            className="md:hidden"
            onClick={() => {
              onSearchOpenChange(!searchOpen);
              if (!searchOpen) {
                requestAnimationFrame(() => phoneInputRef.current?.focus());
              }
            }}
          >
            {searchOpen ? (
              <X aria-hidden className="size-4" />
            ) : (
              <SearchIcon aria-hidden className="size-4" />
            )}
          </Button>
          {devLinks.length > 0 && (
            <>
              <nav
                aria-label="Development"
                className="hidden items-center gap-0.5 md:flex"
              >
                {devLinks.map((link) => (
                  <Button
                    key={link.href}
                    asChild
                    variant="ghost"
                    size="sm"
                    sound="click"
                    className={cn(NAV_TYPE, "text-muted-foreground")}
                  >
                    <Link href={link.href} transitionTypes={["nav-forward"]}>
                      {link.label}
                    </Link>
                  </Button>
                ))}
              </nav>
              <span
                aria-hidden
                className="bg-border mx-1 hidden h-4 w-px md:block"
              />
            </>
          )}
          {isAdmin && (
            <Button
              asChild
              variant="ghost"
              size="sm"
              sound="click"
              className={NAV_TYPE}
            >
              <Link href={ROUTES.ADMIN_PANEL}>Admin panel</Link>
            </Button>
          )}
          {/* Filled like an active library tab while on the pricing page. */}
          <Button
            asChild
            variant="ghost"
            size="sm"
            sound="click"
            className={cn(
              NAV_TYPE,
              onPricing && "bg-accent text-accent-foreground"
            )}
          >
            <Link
              href={ROUTES.PRICING}
              aria-current={onPricing ? "page" : undefined}
              transitionTypes={["nav-forward"]}
            >
              Pricing
            </Link>
          </Button>
          <Button
            asChild
            size="sm"
            sound="click"
            className={cn(NAV_TYPE, "ml-1")}
          >
            <Link href={account.href} transitionTypes={["nav-forward"]}>
              {account.label}
            </Link>
          </Button>
        </div>
      </div>

      {/* Phone search row, under the bar while open. */}
      {searchOpen && (
        <div id="browse-phone-search" className="container pb-3 md:hidden">
          <BrowseSearch
            inputRef={phoneInputRef}
            placeholder={placeholder}
            query={query}
            onEscape={() => onSearchOpenChange(false)}
            onQueryChange={onQueryChange}
            onSubmit={onSubmitSearch}
          />
        </div>
      )}
    </header>
  );
};

// ─── Previous top bar (beside the rail), kept for when the rail returns ───
//
// // Client component, the slim bar over the content column. Search sits on the
// // left. The right holds the site navigation and the CTAs: Pricing and Blog as
// // quiet ghost links in the rail's row type, a hairline, then Sign in (or Dashboard) and the primary
// // "Get started". The theme toggle, settings and Sponsor live in the rail's
// // footer (browse-rail.tsx).
// //
// // On phones: the menu button, the logo and the active library's name on the
// // left, and only the primary CTA on the right. Pricing, Blog and Sign in move
// // into the drawer.
// export const BrowseTopBar = ({
//   active,
//   drawerOpen,
//   inputRef,
//   libraries,
//   mode,
//   onMenuOpen,
//   onQueryChange,
//   onSubmitSearch,
//   placeholder,
//   query,
// }: {
//   active: LibraryId;
//   drawerOpen: boolean;
//   inputRef: React.RefObject<HTMLInputElement | null>;
//   libraries: LibraryTab[];
//   mode: RailMode;
//   onMenuOpen: () => void;
//   onQueryChange: (query: string) => void;
//   onSubmitSearch: () => void;
//   placeholder: string;
//   query: string;
// }) => {
//   const library = libraries.find((item) => item.id === active);
//   const account = useAccountLink();
//
//   return (
//     <header className="bg-background/90 sticky top-0 z-40 flex h-(--header-height) items-center gap-2 px-4 backdrop-blur md:px-6">
//       <div className="flex items-center gap-2 md:hidden">
//         <Button
//           variant="ghost"
//           size="icon"
//           sound="click"
//           aria-label="Open navigation"
//           aria-expanded={drawerOpen}
//           aria-controls="browse-rail-drawer"
//           onClick={onMenuOpen}
//         >
//           <Menu aria-hidden className="size-5" />
//         </Button>
//         <LogoMark className="size-5" />
//         <span className={cn(TYPE.cardHeader, "max-sm:sr-only")}>
//           {mode === "docs" ? "Docs" : library?.label}
//         </span>
//       </div>
//
//       <BrowseSearch
//         inputRef={inputRef}
//         placeholder={placeholder}
//         query={query}
//         onQueryChange={onQueryChange}
//         onSubmit={onSubmitSearch}
//       />
//
//       <div className="ml-auto flex items-center gap-1">
//         <nav aria-label="Site" className="hidden items-center gap-0.5 md:flex">
//           {SITE_NAV.map((item) => (
//             <Button
//               key={item.href}
//               asChild
//               variant="ghost"
//               size="sm"
//               sound="click"
//               className={RAIL_ROW_TYPE}
//             >
//               <Link href={item.href} transitionTypes={["nav-forward"]}>
//                 {item.label}
//               </Link>
//             </Button>
//           ))}
//         </nav>
//         <span aria-hidden className="bg-border mx-2 hidden h-4 w-px md:block" />
//         <Button
//           asChild
//           variant="ghost"
//           size="sm"
//           sound="click"
//           className={cn(RAIL_ROW_TYPE, "hidden md:inline-flex")}
//         >
//           <Link href={account.href} transitionTypes={["nav-forward"]}>
//             {account.label}
//           </Link>
//         </Button>
//         <Button asChild size="sm" sound="click" className="ml-1">
//           <Link href={PRIMARY_CTA.href} transitionTypes={["nav-forward"]}>
//             {PRIMARY_CTA.label}
//           </Link>
//         </Button>
//       </div>
//     </header>
//   );
// };
