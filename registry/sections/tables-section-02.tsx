"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  Globe,
  Inbox,
  Link2,
  ListFilter,
  Mail,
  MessageCircle,
  Minus,
  MoreHorizontal,
  PanelRightOpen,
  Phone,
  RefreshCw,
  Search,
  SearchX,
  SlidersHorizontal,
  Timer,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ─── Menus ───────────────────────────────────────────────────────────────────
// This block runs on either shadcn style. Radix closes a menu after a radio
// pick on its own; Base UI keeps it open. So every menu here owns its open
// state, and its radio groups close it once a value is chosen.
const CloseMenuContext = React.createContext<(() => void) | null>(null);

const Menu = ({
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenu>) => {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  return (
    <CloseMenuContext.Provider value={close}>
      <DropdownMenu {...props} onOpenChange={setOpen} open={open}>
        {children}
      </DropdownMenu>
    </CloseMenuContext.Provider>
  );
};

type MenuRadioGroupProps = React.ComponentProps<typeof DropdownMenuRadioGroup>;

const MenuRadioGroup = ({ onValueChange, ...props }: MenuRadioGroupProps) => {
  const close = React.useContext(CloseMenuContext);
  const handleValueChange = ((
    ...args: Parameters<NonNullable<MenuRadioGroupProps["onValueChange"]>>
  ) => {
    onValueChange?.(...args);
    close?.();
  }) as MenuRadioGroupProps["onValueChange"];
  return (
    <DropdownMenuRadioGroup {...props} onValueChange={handleValueChange} />
  );
};

// Support tickets table: a help-desk queue in the same shape as the API keys
// table (tables-section.tsx): header actions, a search + filter toolbar,
// selectable rows with a per-row menu, a pagination footer and dialogs. On
// top of that: saved views with counts, status and assignee edited in place,
// a live SLA timer per ticket, sorting, CSV export and a detail sheet.
//
// Design rules:
// - Six plain-text columns: Ticket (subject, channel and number), Requester,
//   Priority, Status, Assignee, Due. Tags live in the detail sheet (and stay
//   searchable). No avatars or decorative icons in the cells.
// - Grey by default. Red means "act now" (overdue, urgent), amber means "due
//   within the hour". Nothing else is coloured, so those two always read.
// - Quiet at rest: menus, sort arrows and edit affordances show on hover.
//
// Interactive demo state lives in this file so the block works the moment it
// is dropped into a page.

export type TicketStatus = "open" | "pending" | "on-hold" | "solved" | "closed";
export type TicketPriority = "urgent" | "high" | "medium" | "low";
export type TicketChannel = "email" | "chat" | "phone" | "web";

export interface TicketRequester {
  name: string;
  email: string;
  company: string;
}

export interface TicketRow {
  id: string;
  subject: string;
  /** The latest message, shown in the detail sheet. */
  preview: string;
  requester: TicketRequester;
  status: TicketStatus;
  priority: TicketPriority;
  /** Null means unassigned. */
  assignee: string | null;
  channel: TicketChannel;
  tags: string[];
  replies: number;
  /** A customer reply nobody has read yet. */
  unread: boolean;
  createdAt: number;
  updatedAt: number;
  /** When the next response is due under the SLA. */
  slaDueAt: number;
}

export interface TicketsSectionProps {
  initialTickets?: TicketRow[];
  /** Agents tickets can be assigned to. */
  agents?: string[];
  /** The signed-in agent: "Mine" and new tickets' default assignee. */
  currentUser?: string;
  className?: string;
}

type ColumnId = "requester" | "priority" | "status" | "assignee" | "due";

const COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "requester", label: "Requester" },
  { id: "priority", label: "Priority" },
  { id: "status", label: "Status" },
  { id: "assignee", label: "Assignee" },
  { id: "due", label: "Due" },
];

const ALL_COLUMNS: Record<ColumnId, boolean> = {
  assignee: true,
  due: true,
  priority: true,
  requester: true,
  status: true,
};

// Columns appear as the table's own box widens, most useful first. These
// are container queries (the section is @container), so the table adapts to
// the space it's given (a phone, a side panel, a narrow preview), not just
// the window.
const SHOW_FROM: Record<ColumnId, string> = {
  assignee: "hidden @4xl:table-cell",
  // Under @lg the due time moves into the ticket cell (TicketCell).
  due: "hidden @lg:table-cell",
  priority: "hidden @lg:table-cell",
  requester: "hidden @5xl:table-cell",
  status: "hidden @2xl:table-cell",
};

const PAGE_SIZES = [10, 20, 50];

const AGENTS = [
  "Maya Ellis",
  "Noor Haddad",
  "Tom Brandt",
  "Amir Rahal",
  "Dev Sharma",
];

const STATUSES: { id: TicketStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "on-hold", label: "On hold" },
  { id: "solved", label: "Solved" },
  { id: "closed", label: "Closed" },
];

const PRIORITIES: { id: TicketPriority; label: string; bars: number }[] = [
  { bars: 3, id: "urgent", label: "Urgent" },
  { bars: 3, id: "high", label: "High" },
  { bars: 2, id: "medium", label: "Medium" },
  { bars: 1, id: "low", label: "Low" },
];

const CHANNELS: Record<TicketChannel, { label: string; icon: typeof Inbox }> = {
  chat: { icon: MessageCircle, label: "Chat" },
  email: { icon: Mail, label: "Email" },
  phone: { icon: Phone, label: "Phone" },
  web: { icon: Globe, label: "Web form" },
};

const statusOf = (id: TicketStatus) =>
  STATUSES.find((status) => status.id === id) ?? STATUSES[0];
const priorityOf = (id: TicketPriority) =>
  PRIORITIES.find((priority) => priority.id === id) ?? PRIORITIES[2];
const priorityRank = (id: TicketPriority) =>
  PRIORITIES.findIndex((priority) => priority.id === id);

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const buildMockTickets = (now: number): TicketRow[] => [
  {
    assignee: "Maya Ellis",
    channel: "email",
    createdAt: now - 3 * HOUR,
    id: "TCK-1048",
    preview:
      "We were charged twice for the October invoice and the second charge still shows on our card. Can you refund it?",
    priority: "urgent",
    replies: 3,
    requester: {
      company: "Northwind",
      email: "lena@northwind.io",
      name: "Lena Fischer",
    },
    slaDueAt: now - 25 * MINUTE,
    status: "open",
    subject: "Charged twice for the October invoice",
    tags: ["billing", "refund"],
    unread: true,
    updatedAt: now - 12 * MINUTE,
  },
  {
    assignee: null,
    channel: "chat",
    createdAt: now - 50 * MINUTE,
    id: "TCK-1047",
    preview:
      "After resetting my password, signing in with Okta just loops back to the login page.",
    priority: "high",
    replies: 1,
    requester: {
      company: "Acme Corp",
      email: "jordan@acme.com",
      name: "Jordan Lee",
    },
    slaDueAt: now + 35 * MINUTE,
    status: "open",
    subject: "SSO login loops after a password reset",
    tags: ["auth", "sso"],
    unread: true,
    updatedAt: now - 8 * MINUTE,
  },
  {
    assignee: "Noor Haddad",
    channel: "web",
    createdAt: now - 6 * HOUR,
    id: "TCK-1046",
    preview:
      "Exports over 50k rows time out after about 30 seconds. Smaller exports work fine.",
    priority: "high",
    replies: 4,
    requester: {
      company: "Globex",
      email: "priya@globex.com",
      name: "Priya Nair",
    },
    slaDueAt: now + 2 * HOUR + 10 * MINUTE,
    status: "pending",
    subject: "CSV export times out on large workspaces",
    tags: ["bug", "export"],
    unread: false,
    updatedAt: now - 40 * MINUTE,
  },
  {
    assignee: "Tom Brandt",
    channel: "email",
    createdAt: now - 1 * DAY,
    id: "TCK-1045",
    preview:
      "Is it possible to move our seats from the Team plan to Business mid-cycle without losing the annual discount?",
    priority: "medium",
    replies: 2,
    requester: {
      company: "Initech",
      email: "sam@initech.co",
      name: "Sam Ortiz",
    },
    slaDueAt: now + 5 * HOUR,
    status: "open",
    subject: "Upgrade seats mid-cycle on an annual plan",
    tags: ["billing", "sales"],
    unread: false,
    updatedAt: now - 2 * HOUR,
  },
  {
    assignee: "Maya Ellis",
    channel: "phone",
    createdAt: now - 2 * DAY,
    id: "TCK-1044",
    preview:
      "Our webhook endpoint returns 200 but the dashboard marks every delivery as failed.",
    priority: "high",
    replies: 6,
    requester: {
      company: "Umbrella",
      email: "kai@umbrella.dev",
      name: "Kai Tanaka",
    },
    slaDueAt: now + 45 * MINUTE,
    status: "open",
    subject: "Webhooks marked failed despite 200 responses",
    tags: ["api", "webhooks"],
    unread: false,
    updatedAt: now - 3 * HOUR,
  },
  {
    assignee: "Amir Rahal",
    channel: "chat",
    createdAt: now - 3 * DAY,
    id: "TCK-1043",
    preview:
      "Waiting on the customer's security team to approve the new DPA before we can enable data residency.",
    priority: "medium",
    replies: 5,
    requester: {
      company: "Stark Industries",
      email: "ava@stark.com",
      name: "Ava Morgan",
    },
    slaDueAt: now + 1 * DAY,
    status: "on-hold",
    subject: "Enable EU data residency for the workspace",
    tags: ["compliance"],
    unread: false,
    updatedAt: now - 1 * DAY,
  },
  {
    assignee: null,
    channel: "web",
    createdAt: now - 4 * HOUR,
    id: "TCK-1042",
    preview:
      "The mobile app shows a blank screen on Android 14 right after the splash screen.",
    priority: "urgent",
    replies: 0,
    requester: {
      company: "Hooli",
      email: "diego@hooli.xyz",
      name: "Diego Ramos",
    },
    slaDueAt: now - 1 * HOUR - 5 * MINUTE,
    status: "open",
    subject: "Blank screen on Android 14 after launch",
    tags: ["mobile", "bug", "android"],
    unread: true,
    updatedAt: now - 4 * HOUR,
  },
  {
    assignee: "Dev Sharma",
    channel: "email",
    createdAt: now - 5 * DAY,
    id: "TCK-1041",
    preview:
      "Thanks, the invoices now show our VAT number. Closing this out on our side.",
    priority: "low",
    replies: 4,
    requester: {
      company: "Wayne Enterprises",
      email: "chloe@wayne.com",
      name: "Chloe Park",
    },
    slaDueAt: now - 2 * DAY,
    status: "solved",
    subject: "Add our VAT number to invoices",
    tags: ["billing"],
    unread: false,
    updatedAt: now - 6 * HOUR,
  },
  {
    assignee: "Noor Haddad",
    channel: "chat",
    createdAt: now - 7 * HOUR,
    id: "TCK-1040",
    preview:
      "Can we get a sandbox API key for our staging environment? The docs mention test mode.",
    priority: "low",
    replies: 1,
    requester: {
      company: "Pied Piper",
      email: "omar@piedpiper.com",
      name: "Omar Haddad",
    },
    slaDueAt: now + 9 * HOUR,
    status: "pending",
    subject: "Sandbox API key for staging",
    tags: ["api"],
    unread: false,
    updatedAt: now - 5 * HOUR,
  },
  {
    assignee: "Tom Brandt",
    channel: "phone",
    createdAt: now - 9 * DAY,
    id: "TCK-1039",
    preview:
      "Confirmed the audit log export includes IP addresses. Nothing else needed.",
    priority: "medium",
    replies: 3,
    requester: {
      company: "Soylent",
      email: "nina@soylent.co",
      name: "Nina Brooks",
    },
    slaDueAt: now - 8 * DAY,
    status: "closed",
    subject: "Audit log export: does it include IP addresses?",
    tags: ["security"],
    unread: false,
    updatedAt: now - 7 * DAY,
  },
  {
    assignee: "Maya Ellis",
    channel: "web",
    createdAt: now - 2 * HOUR,
    id: "TCK-1038",
    preview:
      "Bulk-inviting 40 teammates from a CSV only sends invites to the first 25.",
    priority: "medium",
    replies: 1,
    requester: {
      company: "Vandelay",
      email: "art@vandelay.com",
      name: "Art Vandelay",
    },
    slaDueAt: now + 3 * HOUR + 20 * MINUTE,
    status: "open",
    subject: "Bulk invite stops after 25 teammates",
    tags: ["onboarding", "bug"],
    unread: true,
    updatedAt: now - 30 * MINUTE,
  },
  {
    assignee: null,
    channel: "email",
    createdAt: now - 26 * MINUTE,
    id: "TCK-1037",
    preview:
      "Is there a nonprofit discount? We're a registered charity with 12 staff.",
    priority: "low",
    replies: 0,
    requester: {
      company: "Open Food Bank",
      email: "grace@openfood.org",
      name: "Grace Kim",
    },
    slaDueAt: now + 7 * HOUR,
    status: "open",
    subject: "Nonprofit discount for a registered charity",
    tags: ["sales"],
    unread: true,
    updatedAt: now - 26 * MINUTE,
  },
  {
    assignee: "Amir Rahal",
    channel: "chat",
    createdAt: now - 3 * DAY,
    id: "TCK-1036",
    preview:
      "Dark mode is back to normal after the update. Thanks for the quick fix!",
    priority: "low",
    replies: 2,
    requester: {
      company: "Massive Dynamic",
      email: "eli@massive.io",
      name: "Eli Turner",
    },
    slaDueAt: now - 2 * DAY,
    status: "solved",
    subject: "Charts unreadable in dark mode",
    tags: ["ui"],
    unread: false,
    updatedAt: now - 1 * DAY,
  },
  {
    assignee: "Dev Sharma",
    channel: "email",
    createdAt: now - 1 * DAY,
    id: "TCK-1035",
    preview:
      "Rate limits hit at 600 requests/minute even though our plan says 1,000.",
    priority: "high",
    replies: 3,
    requester: {
      company: "Cyberdyne",
      email: "miles@cyberdyne.ai",
      name: "Miles Dyson",
    },
    slaDueAt: now + 1 * HOUR + 40 * MINUTE,
    status: "pending",
    subject: "Rate limited below the plan's quota",
    tags: ["api", "limits"],
    unread: false,
    updatedAt: now - 1 * HOUR,
  },
];

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const randomPart = (length: number): string =>
  Array.from(
    { length },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  ).join("");

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

const timeAgo = (timestamp: number, now: number): string => {
  const minutes = Math.max(0, Math.floor((now - timestamp) / MINUTE));
  if (minutes < 1) {
    return "just now";
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  return `${Math.floor(hours / 24)}d ago`;
};

// "1h 20m", "35m", "2d 4h": the two largest units.
const duration = (ms: number): string => {
  const minutes = Math.max(1, Math.round(ms / MINUTE));
  if (minutes < 60) {
    return `${minutes}m`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const rest = minutes % 60;
    return rest ? `${hours}h ${rest}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  return rest ? `${days}d ${rest}h` : `${days}d`;
};

type SlaTone = "ok" | "risk" | "breached" | "met" | "paused";

interface SlaState {
  label: string;
  tone: SlaTone;
  /** Minutes left (negative once overdue), for sorting. */
  sortKey: number;
}

// Where a ticket stands against its SLA right now.
const slaState = (row: TicketRow, now: number): SlaState => {
  if (row.status === "solved" || row.status === "closed") {
    return { label: "SLA met", sortKey: Number.POSITIVE_INFINITY, tone: "met" };
  }
  if (row.status === "on-hold") {
    return {
      label: "Paused",
      sortKey: Number.MAX_SAFE_INTEGER,
      tone: "paused",
    };
  }
  const left = row.slaDueAt - now;
  if (left < 0) {
    return {
      label: `Overdue ${duration(-left)}`,
      sortKey: left / MINUTE,
      tone: "breached",
    };
  }
  return {
    label: `${duration(left)} left`,
    sortKey: left / MINUTE,
    tone: left < HOUR ? "risk" : "ok",
  };
};

// The only colours in the table: red for overdue, amber within the hour.
const DUE_TONE: Record<SlaTone, string> = {
  breached: "font-medium text-red-600 dark:text-red-400",
  met: "text-muted-foreground",
  ok: "text-foreground",
  paused: "text-muted-foreground",
  risk: "font-medium text-amber-600 dark:text-amber-400",
};

type ViewId = "all" | "mine" | "unassigned" | "at-risk" | "solved";

const VIEWS: { id: ViewId; label: string }[] = [
  { id: "all", label: "All tickets" },
  { id: "mine", label: "Mine" },
  { id: "unassigned", label: "Unassigned" },
  { id: "at-risk", label: "At risk" },
  { id: "solved", label: "Solved" },
];

const isDone = (row: TicketRow) =>
  row.status === "solved" || row.status === "closed";

const inView = (
  row: TicketRow,
  view: ViewId,
  me: string,
  now: number
): boolean => {
  if (view === "mine") {
    return row.assignee === me && !isDone(row);
  }
  if (view === "unassigned") {
    return row.assignee === null && !isDone(row);
  }
  if (view === "at-risk") {
    const { tone } = slaState(row, now);
    return tone === "risk" || tone === "breached";
  }
  if (view === "solved") {
    return isDone(row);
  }
  return true;
};

type SortColumn = "priority" | "sla" | "updated";
interface SortState {
  column: SortColumn;
  direction: "asc" | "desc";
}

const SORTS: { id: SortColumn; label: string }[] = [
  { id: "updated", label: "Last updated" },
  { id: "priority", label: "Priority" },
  { id: "sla", label: "Due soonest" },
];

// Where each order starts: newest first; most urgent first.
const DEFAULT_DIRECTION: Record<SortColumn, SortState["direction"]> = {
  priority: "asc",
  sla: "asc",
  updated: "desc",
};

const compareRows = (
  a: TicketRow,
  b: TicketRow,
  sort: SortState,
  now: number
): number => {
  let diff = 0;
  if (sort.column === "priority") {
    diff = priorityRank(a.priority) - priorityRank(b.priority);
  } else if (sort.column === "sla") {
    diff = slaState(a, now).sortKey - slaState(b, now).sortKey;
  } else {
    diff = a.updatedAt - b.updatedAt;
  }
  return sort.direction === "asc" ? diff : -diff;
};

const csvCell = (value: string) => `"${value.replaceAll('"', '""')}"`;

// Downloads the rows as a CSV file (what Export does).
const downloadCsv = (rows: TicketRow[], now: number) => {
  const header = [
    "ID",
    "Subject",
    "Requester",
    "Email",
    "Company",
    "Status",
    "Priority",
    "Assignee",
    "Due",
    "Channel",
    "Tags",
    "Created",
    "Updated",
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.subject,
      row.requester.name,
      row.requester.email,
      row.requester.company,
      statusOf(row.status).label,
      priorityOf(row.priority).label,
      row.assignee ?? "Unassigned",
      slaState(row, now).label,
      CHANNELS[row.channel].label,
      row.tags.join(" "),
      new Date(row.createdAt).toISOString(),
      new Date(row.updatedAt).toISOString(),
    ]
      .map(csvCell)
      .join(",")
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tickets.csv";
  link.click();
  URL.revokeObjectURL(url);
};

// ─── Glyphs and small pieces ─────────────────────────────────────────────────

// Status as a Linear-style circle: empty (open), half (pending), paused (on
// hold), checked (solved), crossed (closed). Grey, so the table stays calm.
const StatusIcon = ({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) => {
  const ring = (
    <circle
      cx="7"
      cy="7"
      r="5.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  );
  let mark: React.ReactNode = null;
  if (status === "pending") {
    mark = <path d="M7 3.5a3.5 3.5 0 0 1 0 7z" fill="currentColor" />;
  } else if (status === "on-hold") {
    mark = (
      <path
        d="M5.75 5v4M8.25 5v4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    );
  } else if (status === "solved") {
    mark = (
      <>
        <circle cx="7" cy="7" r="6.25" fill="currentColor" />
        <path
          d="m4.5 7.1 1.7 1.7 3.3-3.4"
          fill="none"
          stroke="var(--background)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  } else if (status === "closed") {
    mark = (
      <path
        d="m5 5 4 4M9 5 5 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    );
  }
  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden
      className={cn("text-muted-foreground size-4 shrink-0", className)}
    >
      {status === "solved" ? null : ring}
      {mark}
    </svg>
  );
};

// Priority as signal bars; urgent is the one red mark.
const PriorityIcon = ({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) => {
  const config = priorityOf(priority);
  if (priority === "urgent") {
    return (
      <CircleAlert
        aria-hidden
        className={cn(
          "size-4 shrink-0 text-red-600 dark:text-red-400",
          className
        )}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 14 14"
      aria-hidden
      className={cn("text-muted-foreground size-4 shrink-0", className)}
    >
      {[4, 7, 10].map((height, index) => (
        <rect
          key={height}
          x={1.5 + index * 4}
          y={12 - height}
          width="2.5"
          height={height}
          rx="0.75"
          fill="currentColor"
          opacity={index < config.bars ? 1 : 0.3}
        />
      ))}
    </svg>
  );
};

// Initials on a muted circle: identity without colour.
const PersonAvatar = ({
  name,
  className,
}: {
  name: string;
  className?: string;
}) => (
  <Avatar className={cn("size-6", className)}>
    <AvatarFallback className="bg-muted text-muted-foreground text-[10px] font-medium">
      {initials(name)}
    </AvatarFallback>
  </Avatar>
);

// Priority as a word. Urgent is the one red one; high reads normally, and
// medium and low recede.
const PRIORITY_TONE: Record<TicketPriority, string> = {
  high: "text-foreground",
  low: "text-muted-foreground",
  medium: "text-muted-foreground",
  urgent: "font-medium text-red-600 dark:text-red-400",
};

const PriorityLabel = ({ priority }: { priority: TicketPriority }) => (
  <span className={cn("text-sm whitespace-nowrap", PRIORITY_TONE[priority])}>
    {priorityOf(priority).label}
  </span>
);

// The assignee's name as plain text; "Unassigned" recedes.
const AssigneeName = ({ assignee }: { assignee: string | null }) => (
  <span
    className={cn(
      "truncate text-sm",
      assignee ? "text-foreground" : "text-muted-foreground"
    )}
  >
    {assignee ?? "Unassigned"}
  </span>
);

const StatusLabel = ({ status }: { status: TicketStatus }) => (
  <span
    className={cn(
      "inline-flex items-center gap-2 text-sm whitespace-nowrap",
      status === "solved" || status === "closed"
        ? "text-muted-foreground"
        : "text-foreground"
    )}
  >
    <StatusIcon status={status} />
    {statusOf(status).label}
  </span>
);

const DueLabel = ({
  row,
  now,
  className,
}: {
  row: TicketRow;
  now: number;
  className?: string;
}) => {
  const sla = slaState(row, now);
  return (
    <span
      suppressHydrationWarning
      title={
        sla.tone === "met" || sla.tone === "paused"
          ? undefined
          : `Next response due ${new Date(row.slaDueAt).toLocaleString()}`
      }
      className={cn(
        "text-sm whitespace-nowrap tabular-nums",
        DUE_TONE[sla.tone],
        className
      )}
    >
      {sla.label}
    </span>
  );
};

// A cell value that opens a menu to change it, in place. The hover wash and
// chevron only appear on hover, so the table reads as plain text at rest.
const CellMenuTrigger = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <DropdownMenuTrigger
    className="group/cell hover:bg-muted focus-visible:ring-ring/50 data-[state=open]:bg-muted data-popup-open:bg-muted -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 outline-none focus-visible:ring-[3px]"
    aria-label={label}
  >
    {children}
    <ChevronDown
      aria-hidden
      className="text-muted-foreground size-3 opacity-0 transition-opacity group-hover/cell:opacity-100 group-data-[state=open]/cell:opacity-100 group-data-popup-open/cell:opacity-100"
    />
  </DropdownMenuTrigger>
);

const StatusItems = ({
  value,
  onChange,
}: {
  value: TicketStatus;
  onChange: (status: TicketStatus) => void;
}) => (
  <MenuRadioGroup
    value={value}
    onValueChange={(next) => onChange(next as TicketStatus)}
  >
    {STATUSES.map((status) => (
      <DropdownMenuRadioItem key={status.id} value={status.id}>
        <StatusIcon status={status.id} />
        {status.label}
      </DropdownMenuRadioItem>
    ))}
  </MenuRadioGroup>
);

const PriorityItems = ({
  value,
  onChange,
}: {
  value: TicketPriority;
  onChange: (priority: TicketPriority) => void;
}) => (
  <MenuRadioGroup
    value={value}
    onValueChange={(next) => onChange(next as TicketPriority)}
  >
    {PRIORITIES.map((priority) => (
      <DropdownMenuRadioItem key={priority.id} value={priority.id}>
        <PriorityIcon priority={priority.id} />
        {priority.label}
      </DropdownMenuRadioItem>
    ))}
  </MenuRadioGroup>
);

const UNASSIGNED = "__unassigned__";

const AssigneeItems = ({
  value,
  agents,
  onChange,
}: {
  value: string | null;
  agents: string[];
  onChange: (assignee: string | null) => void;
}) => (
  <MenuRadioGroup
    value={value ?? UNASSIGNED}
    onValueChange={(next) => onChange(next === UNASSIGNED ? null : next)}
  >
    <DropdownMenuRadioItem value={UNASSIGNED}>Unassigned</DropdownMenuRadioItem>
    {agents.map((agent) => (
      <DropdownMenuRadioItem key={agent} value={agent}>
        {agent}
      </DropdownMenuRadioItem>
    ))}
  </MenuRadioGroup>
);

// ─── Header and views ────────────────────────────────────────────────────────

const TicketsHeader = ({
  onExport,
  onNew,
}: {
  onExport: () => void;
  onNew: () => void;
}) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div>
      <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">
        <Inbox aria-hidden className="size-6 sm:size-7" />
        Support tickets
      </h2>
      <p className="text-muted-foreground mt-2 max-w-md text-sm text-pretty sm:text-base">
        Every customer conversation in one queue, triaged by priority and SLA.
      </p>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={onExport}>
        <Download aria-hidden className="size-4" />
        Export
        <Kbd>E</Kbd>
      </Button>
      <Button onClick={onNew}>
        <span aria-hidden className="text-base leading-none">
          +
        </span>
        New ticket
        <Kbd className="bg-primary-foreground/20 text-primary-foreground shadow-none dark:bg-primary-foreground/20">
          C
        </Kbd>
      </Button>
    </div>
  </div>
);

const ViewTabs = ({
  view,
  counts,
  onChange,
}: {
  view: ViewId;
  counts: Record<ViewId, number>;
  onChange: (view: ViewId) => void;
}) => (
  <Tabs
    value={view}
    onValueChange={(next) => onChange(next as ViewId)}
    className="mt-6"
  >
    {/* One row that scrolls sideways on small screens. Tabs keep their own
        width (flex-none overrides the shadcn trigger's flex-1), so nothing
        stretches or wraps; the scrollbar is hidden. */}
    <TabsList className="w-full justify-start overflow-x-auto [scrollbar-width:none] @xl:w-fit [&::-webkit-scrollbar]:hidden">
      {VIEWS.map((item) => (
        <TabsTrigger
          key={item.id}
          value={item.id}
          className="flex-none gap-1.5 px-3"
        >
          {item.label}
          <span className="text-muted-foreground text-xs tabular-nums">
            {counts[item.id]}
          </span>
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);

// ─── Toolbar: search, one Filter menu, View ──────────────────────────────────

interface Filters {
  status: Set<TicketStatus>;
  priority: Set<TicketPriority>;
  /** "all", UNASSIGNED, or an agent's name. */
  assignee: string;
}

const NO_FILTERS: Filters = {
  assignee: "all",
  priority: new Set(),
  status: new Set(),
};

const activeFilterCount = (filters: Filters) =>
  filters.status.size +
  filters.priority.size +
  (filters.assignee === "all" ? 0 : 1);

const assigneeLabel = (value: string) =>
  value === UNASSIGNED ? "Unassigned" : value;

const toggleIn = <T,>(set: Set<T>, value: T): Set<T> => {
  const next = new Set(set);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
};

interface FilterCounts {
  status: Record<TicketStatus, number>;
  priority: Record<TicketPriority, number>;
}

// One Filter button: Status, Priority and Assignee as submenus, each with
// counts for the current view. Several values at once within a group (OR).
const FilterMenu = ({
  filters,
  counts,
  agents,
  onChange,
}: {
  filters: Filters;
  counts: FilterCounts;
  agents: string[];
  onChange: (filters: Filters) => void;
}) => {
  const count = activeFilterCount(filters);
  return (
    <Menu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ variant: "outline" }))}
      >
        <ListFilter aria-hidden className="size-4" />
        Filter
        {count > 0 && (
          <span className="bg-muted text-foreground ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
            {count}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <StatusIcon status="pending" />
            Status
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44">
            {STATUSES.map((status) => (
              <DropdownMenuCheckboxItem
                key={status.id}
                checked={filters.status.has(status.id)}
                onCheckedChange={() =>
                  onChange({
                    ...filters,
                    status: toggleIn(filters.status, status.id),
                  })
                }
                onSelect={(event) => event.preventDefault()}
              >
                <StatusIcon status={status.id} />
                <span className="flex-1">{status.label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {counts.status[status.id]}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <PriorityIcon priority="high" />
            Priority
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44">
            {PRIORITIES.map((priority) => (
              <DropdownMenuCheckboxItem
                key={priority.id}
                checked={filters.priority.has(priority.id)}
                onCheckedChange={() =>
                  onChange({
                    ...filters,
                    priority: toggleIn(filters.priority, priority.id),
                  })
                }
                onSelect={(event) => event.preventDefault()}
              >
                <PriorityIcon priority={priority.id} />
                <span className="flex-1">{priority.label}</span>
                <span className="text-muted-foreground text-xs tabular-nums">
                  {counts.priority[priority.id]}
                </span>
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className="gap-2">
            <UserRound aria-hidden className="text-muted-foreground size-4" />
            Assignee
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-44">
            <MenuRadioGroup
              value={filters.assignee}
              onValueChange={(assignee) => onChange({ ...filters, assignee })}
            >
              <DropdownMenuRadioItem value="all">Anyone</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={UNASSIGNED}>
                Unassigned
              </DropdownMenuRadioItem>
              {agents.map((agent) => (
                <DropdownMenuRadioItem key={agent} value={agent}>
                  {agent}
                </DropdownMenuRadioItem>
              ))}
            </MenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {count > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(NO_FILTERS)}>
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </Menu>
  );
};

interface FilterChip {
  key: string;
  group: string;
  value: string;
  clear: Filters;
}

const filterChips = (filters: Filters): FilterChip[] => {
  const chips: FilterChip[] = [];
  if (filters.status.size > 0) {
    chips.push({
      clear: { ...filters, status: new Set() },
      group: "Status",
      key: "status",
      value: STATUSES.filter((status) => filters.status.has(status.id))
        .map((status) => status.label)
        .join(", "),
    });
  }
  if (filters.priority.size > 0) {
    chips.push({
      clear: { ...filters, priority: new Set() },
      group: "Priority",
      key: "priority",
      value: PRIORITIES.filter((priority) => filters.priority.has(priority.id))
        .map((priority) => priority.label)
        .join(", "),
    });
  }
  if (filters.assignee !== "all") {
    chips.push({
      clear: { ...filters, assignee: "all" },
      group: "Assignee",
      key: "assignee",
      value: assigneeLabel(filters.assignee),
    });
  }
  return chips;
};

// What's applied, as removable chips under the toolbar.
const FilterChips = ({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (filters: Filters) => void;
}) => {
  const chips = filterChips(filters);
  if (chips.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="bg-muted/50 inline-flex h-7 items-center gap-1.5 rounded-md border pr-1 pl-2.5 text-xs"
        >
          <span className="text-muted-foreground">{chip.group}</span>
          <span className="font-medium">{chip.value}</span>
          <button
            type="button"
            onClick={() => onChange(chip.clear)}
            aria-label={`Remove ${chip.group.toLowerCase()} filter`}
            className="text-muted-foreground hover:text-foreground hover:bg-muted rounded-sm p-0.5"
          >
            <X aria-hidden className="size-3.5" />
          </button>
        </span>
      ))}
      <Button
        variant="ghost"
        size="sm"
        className="text-muted-foreground h-7"
        onClick={() => onChange(NO_FILTERS)}
      >
        Clear all
      </Button>
    </div>
  );
};

const SearchBox = ({
  query,
  onQueryChange,
  searchRef,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) => (
  // Full width on phones (its own row above Filter / View), then shares the
  // toolbar from sm up.
  <div className="relative w-full min-w-0 @xl:w-auto @xl:max-w-xs @xl:flex-1">
    <Search
      aria-hidden
      className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
    />
    <Input
      ref={searchRef}
      value={query}
      onChange={(event) => onQueryChange(event.target.value)}
      placeholder="Search tickets, people, tags..."
      aria-label="Search tickets"
      className="pr-12 pl-8"
    />
    {query ? (
      <button
        type="button"
        onClick={() => {
          onQueryChange("");
          searchRef.current?.focus();
        }}
        aria-label="Clear search"
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2.5 -translate-y-1/2 rounded-sm p-0.5"
      >
        <X aria-hidden className="size-4" />
      </button>
    ) : (
      <Kbd className="absolute top-1/2 right-2.5 -translate-y-1/2">/</Kbd>
    )}
  </div>
);

// Order and columns in one menu, the way Linear's "Display" works.
const ViewMenu = ({
  sort,
  onSortColumn,
  visible,
  onToggleColumn,
  onShowAllColumns,
}: {
  sort: SortState;
  onSortColumn: (column: SortColumn) => void;
  visible: Record<ColumnId, boolean>;
  onToggleColumn: (id: ColumnId) => void;
  onShowAllColumns: () => void;
}) => (
  <Menu>
    <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline" }))}>
      <SlidersHorizontal aria-hidden className="size-4" />
      View
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-48">
      <DropdownMenuGroup>
        <DropdownMenuLabel>Order by</DropdownMenuLabel>
        <MenuRadioGroup
          value={sort.column}
          onValueChange={(column) => onSortColumn(column as SortColumn)}
        >
          {SORTS.map((item) => (
            <DropdownMenuRadioItem key={item.id} value={item.id}>
              {item.label}
            </DropdownMenuRadioItem>
          ))}
        </MenuRadioGroup>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuLabel>Columns</DropdownMenuLabel>
        {COLUMNS.map((col) => (
          <DropdownMenuCheckboxItem
            key={col.id}
            checked={visible[col.id]}
            onCheckedChange={() => onToggleColumn(col.id)}
            onSelect={(event) => event.preventDefault()}
          >
            {col.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onShowAllColumns}>
        Show all columns
      </DropdownMenuItem>
    </DropdownMenuContent>
  </Menu>
);

// ─── Table ───────────────────────────────────────────────────────────────────

// A sortable header: the arrows only show on hover, or when it's the order.
const SortHead = ({
  column,
  label,
  sort,
  onSort,
  className,
}: {
  column: SortColumn;
  label: string;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  className?: string;
}) => {
  const active = sort.column === column;
  let Icon = ArrowUpDown;
  if (active) {
    Icon = sort.direction === "asc" ? ArrowUp : ArrowDown;
  }
  return (
    <TableHead
      className={className}
      aria-sort={
        active
          ? (`${sort.direction}ending` as "ascending" | "descending")
          : undefined
      }
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="group/sort hover:text-foreground -ml-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1"
      >
        {label}
        <Icon
          aria-hidden
          className={cn(
            "size-3.5 transition-opacity",
            !active && "opacity-0 group-hover/sort:opacity-60"
          )}
        />
      </button>
    </TableHead>
  );
};

interface RowActions {
  onOpen: (row: TicketRow) => void;
  onUpdate: (ids: string[], patch: Partial<TicketRow>) => void;
  onDelete: (ids: string[]) => void;
  onCopyLink: (row: TicketRow) => void;
}

const RowMenu = ({
  row,
  agents,
  actions,
}: {
  row: TicketRow;
  agents: string[];
  actions: RowActions;
}) => (
  <Menu>
    <DropdownMenuTrigger
      className={cn(
        buttonVariants({
          className:
            "text-muted-foreground opacity-0 transition-opacity group-hover/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 data-popup-open:opacity-100",
          size: "icon-sm",
          variant: "ghost",
        })
      )}
      aria-label={`Actions for ${row.id}`}
    >
      <MoreHorizontal aria-hidden className="size-4" />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="min-w-48">
      <DropdownMenuItem onClick={() => actions.onOpen(row)}>
        <PanelRightOpen aria-hidden className="size-4" />
        Open ticket
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => actions.onCopyLink(row)}>
        <Link2 aria-hidden className="size-4" />
        Copy ticket link
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <PriorityIcon priority={row.priority} />
          Priority
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <PriorityItems
            value={row.priority}
            onChange={(priority) => actions.onUpdate([row.id], { priority })}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <StatusIcon status={row.status} />
          Status
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <StatusItems
            value={row.status}
            onChange={(status) => actions.onUpdate([row.id], { status })}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className="gap-2">
          <UserRound aria-hidden className="text-muted-foreground size-4" />
          Assign to
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <AssigneeItems
            value={row.assignee}
            agents={agents}
            onChange={(assignee) => actions.onUpdate([row.id], { assignee })}
          />
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        onClick={() => actions.onDelete([row.id])}
      >
        <Trash2 aria-hidden className="size-4" />
        Delete ticket
      </DropdownMenuItem>
    </DropdownMenuContent>
  </Menu>
);

// The ticket cell: the subject (bold while unread; opens the sheet), and
// under it the channel the customer wrote in on and the ticket number.
const TicketCell = ({
  row,
  now,
  onOpen,
}: {
  row: TicketRow;
  now: number;
  onOpen: (row: TicketRow) => void;
}) => {
  const channel = CHANNELS[row.channel];
  // relative + overflow-hidden: in a fixed-layout table, content wider than
  // the column (including the absolutely positioned sr-only labels) would
  // otherwise widen the scroll area instead of being clipped.
  return (
    <div className="relative flex min-w-0 flex-col gap-0.5 overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(row)}
        className={cn(
          "truncate text-left text-sm underline-offset-4 hover:underline",
          row.unread ? "font-semibold" : "font-normal"
        )}
      >
        {row.subject}
        {row.unread && <span className="sr-only"> (unread)</span>}
      </button>
      <span
        title={`Via ${channel.label}`}
        className="text-muted-foreground flex items-center gap-1.5 text-xs"
      >
        <channel.icon aria-hidden className="size-3.5 shrink-0" />
        <span className="sr-only">Via {channel.label},</span>
        <span className="font-mono">{row.id}</span>
        {/* Narrow boxes hide the Due column; the due time rides here. */}
        <DueLabel row={row} now={now} className="ml-1 text-xs @lg:hidden" />
      </span>
    </div>
  );
};

const RequesterCell = ({ requester }: { requester: TicketRequester }) => (
  <span className="flex min-w-0 flex-col gap-0.5">
    <span className="truncate text-sm">{requester.name}</span>
    <span className="text-muted-foreground truncate text-xs">
      {requester.company}
    </span>
  </span>
);

const AssigneeCell = ({
  row,
  agents,
  onChange,
}: {
  row: TicketRow;
  agents: string[];
  onChange: (assignee: string | null) => void;
}) => (
  <Menu>
    <CellMenuTrigger
      label={`Assignee of ${row.id}: ${row.assignee ?? "unassigned"}`}
    >
      <AssigneeName assignee={row.assignee} />
    </CellMenuTrigger>
    <DropdownMenuContent align="start">
      <AssigneeItems value={row.assignee} agents={agents} onChange={onChange} />
    </DropdownMenuContent>
  </Menu>
);

const TicketRowView = ({
  row,
  agents,
  visible,
  isSelected,
  onToggleRow,
  actions,
  now,
}: {
  row: TicketRow;
  agents: string[];
  visible: Record<ColumnId, boolean>;
  isSelected: boolean;
  onToggleRow: (id: string, checked: boolean) => void;
  actions: RowActions;
  now: number;
}) => {
  const update = (patch: Partial<TicketRow>) =>
    actions.onUpdate([row.id], patch);
  return (
    <TableRow
      data-state={isSelected ? "selected" : undefined}
      className="group/row"
    >
      <TableCell className="pt-3.5 pl-4 align-top">
        <Checkbox
          checked={isSelected}
          onCheckedChange={(value) => onToggleRow(row.id, value === true)}
          aria-label={`Select ${row.id}`}
        />
      </TableCell>
      <TableCell className="py-2.5">
        <TicketCell row={row} now={now} onOpen={actions.onOpen} />
      </TableCell>
      {visible.requester && (
        <TableCell className={SHOW_FROM.requester}>
          <RequesterCell requester={row.requester} />
        </TableCell>
      )}
      {visible.priority && (
        <TableCell className={SHOW_FROM.priority}>
          <Menu>
            <CellMenuTrigger label={`Priority of ${row.id}`}>
              <PriorityLabel priority={row.priority} />
            </CellMenuTrigger>
            <DropdownMenuContent align="start">
              <PriorityItems
                value={row.priority}
                onChange={(priority) => update({ priority })}
              />
            </DropdownMenuContent>
          </Menu>
        </TableCell>
      )}
      {visible.status && (
        <TableCell className={SHOW_FROM.status}>
          <Menu>
            <CellMenuTrigger label={`Status of ${row.id}`}>
              <StatusLabel status={row.status} />
            </CellMenuTrigger>
            <DropdownMenuContent align="start">
              <StatusItems
                value={row.status}
                onChange={(status) => update({ status })}
              />
            </DropdownMenuContent>
          </Menu>
        </TableCell>
      )}
      {visible.assignee && (
        <TableCell className={SHOW_FROM.assignee}>
          <AssigneeCell
            row={row}
            agents={agents}
            onChange={(assignee) => update({ assignee })}
          />
        </TableCell>
      )}
      {visible.due && (
        <TableCell className={SHOW_FROM.due}>
          <span className="flex flex-col gap-0.5">
            <DueLabel row={row} now={now} />
            <span
              suppressHydrationWarning
              title={new Date(row.updatedAt).toLocaleString()}
              className="text-muted-foreground text-xs whitespace-nowrap"
            >
              Updated {timeAgo(row.updatedAt, now)}
            </span>
          </span>
        </TableCell>
      )}
      <TableCell className="pr-4 text-right">
        <RowMenu row={row} agents={agents} actions={actions} />
      </TableCell>
    </TableRow>
  );
};

/* The select-all box. Its "some rows" state is drawn here rather than with
 * the checkbox's own indeterminate value, because the two shadcn styles
 * spell that differently (Radix: checked="indeterminate"; Base UI: an
 * indeterminate prop) and this block runs on either. Underneath it stays
 * unchecked, so a click selects every row; on top it's filled, marked with
 * a dash and announced as mixed. aria-checked is only passed while mixed:
 * passing undefined would override the checkbox's own value. */
const PageCheckbox = ({
  allSelected,
  label,
  onToggle,
  someSelected,
}: {
  allSelected: boolean;
  label: string;
  onToggle: (selected: boolean) => void;
  someSelected: boolean;
}) => {
  const mixed = someSelected && !allSelected;
  return (
    <span className="relative inline-flex">
      <Checkbox
        {...(mixed ? { "aria-checked": "mixed" as const } : {})}
        aria-label={label}
        checked={allSelected}
        className={cn(mixed && "border-primary bg-primary dark:bg-primary")}
        onCheckedChange={(value) => onToggle(value === true)}
      />
      {mixed ? (
        <Minus
          aria-hidden
          className="text-primary-foreground pointer-events-none absolute inset-0 m-auto size-3"
        />
      ) : null}
    </span>
  );
};

const EmptyState = ({
  hasTickets,
  onClearFilters,
  onNew,
}: {
  hasTickets: boolean;
  onClearFilters: () => void;
  onNew: () => void;
}) => (
  <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
    <span className="border-border bg-muted flex size-11 items-center justify-center rounded-full border">
      {hasTickets ? (
        <SearchX aria-hidden className="text-muted-foreground size-5" />
      ) : (
        <Inbox aria-hidden className="text-muted-foreground size-5" />
      )}
    </span>
    <p className="mt-2 font-medium">
      {hasTickets ? "No tickets match" : "Inbox zero"}
    </p>
    <p className="text-muted-foreground text-sm">
      {hasTickets
        ? "Nothing in this view matches the search or filters."
        : "No open conversations. New tickets land here as customers write in."}
    </p>
    {hasTickets ? (
      <Button variant="outline" onClick={onClearFilters} className="mt-2">
        Clear search and filters
      </Button>
    ) : (
      <Button onClick={onNew} className="mt-2">
        New ticket
      </Button>
    )}
  </div>
);

interface TableProps {
  rows: TicketRow[];
  hasTickets: boolean;
  loading: boolean;
  agents: string[];
  visible: Record<ColumnId, boolean>;
  visibleCount: number;
  selected: Set<string>;
  allPageSelected: boolean;
  somePageSelected: boolean;
  onTogglePage: (checked: boolean) => void;
  onToggleRow: (id: string, checked: boolean) => void;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  actions: RowActions;
  onClearFilters: () => void;
  onNew: () => void;
  now: number;
}

const TicketsTable = ({
  rows,
  hasTickets,
  loading,
  agents,
  visible,
  visibleCount,
  selected,
  allPageSelected,
  somePageSelected,
  onTogglePage,
  onToggleRow,
  sort,
  onSort,
  actions,
  onClearFilters,
  onNew,
  now,
}: TableProps) => {
  const colSpan = 3 + visibleCount;

  let body: React.ReactNode;
  if (loading) {
    body = Array.from({ length: 5 }, (_, index) => (
      <TableRow key={`skeleton-${index}`}>
        <TableCell className="pl-4" colSpan={colSpan}>
          <Skeleton className="h-10 w-full" />
        </TableCell>
      </TableRow>
    ));
  } else if (rows.length === 0) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colSpan} className="px-4 py-14 text-center">
          <EmptyState
            hasTickets={hasTickets}
            onClearFilters={onClearFilters}
            onNew={onNew}
          />
        </TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((row) => (
      <TicketRowView
        key={row.id}
        row={row}
        agents={agents}
        visible={visible}
        isSelected={selected.has(row.id)}
        onToggleRow={onToggleRow}
        actions={actions}
        now={now}
      />
    ));
  }

  // table-fixed: the Ticket column takes the room left by the fixed-width
  // columns, and its text truncates instead of pushing the table sideways.
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 pl-4">
            <PageCheckbox
              allSelected={allPageSelected}
              label="Select all tickets on this page"
              onToggle={onTogglePage}
              someSelected={somePageSelected}
            />
          </TableHead>
          <TableHead>Ticket</TableHead>
          {visible.requester && (
            <TableHead className={cn("w-40", SHOW_FROM.requester)}>
              Requester
            </TableHead>
          )}
          {visible.priority && (
            <SortHead
              column="priority"
              label="Priority"
              sort={sort}
              onSort={onSort}
              className={cn("w-24", SHOW_FROM.priority)}
            />
          )}
          {visible.status && (
            <TableHead className={cn("w-28", SHOW_FROM.status)}>
              Status
            </TableHead>
          )}
          {visible.assignee && (
            <TableHead className={cn("w-32", SHOW_FROM.assignee)}>
              Assignee
            </TableHead>
          )}
          {visible.due && (
            <SortHead
              column="sla"
              label="Due"
              sort={sort}
              onSort={onSort}
              className={cn("w-32", SHOW_FROM.due)}
            />
          )}
          <TableHead className="w-12 pr-4">
            <span className="sr-only">Row actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{body}</TableBody>
    </Table>
  );
};

// ─── Footer ──────────────────────────────────────────────────────────────────

interface FooterProps {
  selectedCount: number;
  totalCount: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  agents: string[];
  onAssignSelected: (assignee: string | null) => void;
  onSolveSelected: () => void;
  onDeleteSelected: () => void;
}

const BulkActions = ({
  agents,
  onAssignSelected,
  onSolveSelected,
  onDeleteSelected,
}: Pick<
  FooterProps,
  "agents" | "onAssignSelected" | "onSolveSelected" | "onDeleteSelected"
>) => (
  <span className="flex items-center gap-1">
    <Menu>
      <DropdownMenuTrigger
        className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
      >
        <UserRound aria-hidden className="size-3.5" />
        Assign
        <ChevronDown aria-hidden className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Assign selected to</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => onAssignSelected(null)}>
            Unassigned
          </DropdownMenuItem>
          {agents.map((agent) => (
            <DropdownMenuItem
              key={agent}
              onClick={() => onAssignSelected(agent)}
            >
              {agent}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </Menu>
    <Button variant="ghost" size="sm" onClick={onSolveSelected}>
      <CheckCheck aria-hidden className="size-3.5" />
      Mark solved
    </Button>
    <Button
      variant="ghost"
      size="sm"
      className="text-destructive hover:text-destructive"
      onClick={onDeleteSelected}
    >
      <Trash2 aria-hidden className="size-3.5" />
      Delete
    </Button>
  </span>
);

const TicketsFooter = ({
  selectedCount,
  totalCount,
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  onPageChange,
  ...bulk
}: FooterProps) => (
  <div className="border-border flex flex-col gap-3 border-t px-4 py-3 @xl:flex-row @xl:items-center @xl:justify-between">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-muted-foreground text-sm">
        {selectedCount} of {totalCount} ticket(s) selected.
      </p>
      <Menu>
        <DropdownMenuTrigger
          className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
          aria-label="Rows per page"
        >
          {pageSize}
          <ChevronDown aria-hidden className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Rows per page</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <MenuRadioGroup
              value={String(pageSize)}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              {PAGE_SIZES.map((size) => (
                <DropdownMenuRadioItem key={size} value={String(size)}>
                  {size}
                </DropdownMenuRadioItem>
              ))}
            </MenuRadioGroup>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </Menu>
      {selectedCount > 0 && <BulkActions {...bulk} />}
    </div>
    <div className="flex items-center gap-1">
      <p className="text-muted-foreground mr-2 text-sm whitespace-nowrap">
        Page {page} of {totalPages}
      </p>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        aria-label="Previous page"
      >
        <ChevronLeft aria-hidden className="size-4" />
      </Button>
      <Button
        variant="outline"
        size="icon-sm"
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page >= totalPages}
        aria-label="Next page"
      >
        <ChevronRight aria-hidden className="size-4" />
      </Button>
    </div>
  </div>
);

// ─── Dialogs and the detail sheet ────────────────────────────────────────────

interface NewTicketInput {
  subject: string;
  name: string;
  email: string;
  priority: TicketPriority;
  assignee: string | null;
  message: string;
}

const NewTicketDialog = ({
  open,
  onOpenChange,
  agents,
  currentUser,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: string[];
  currentUser: string;
  onCreate: (input: NewTicketInput) => void;
}) => {
  const empty = React.useCallback(
    (): NewTicketInput => ({
      assignee: currentUser,
      email: "",
      message: "",
      name: "",
      priority: "medium",
      subject: "",
    }),
    [currentUser]
  );
  const [form, setForm] = React.useState<NewTicketInput>(empty);
  const id = React.useId();

  React.useEffect(() => {
    if (open) {
      setForm(empty());
    }
  }, [open, empty]);

  const set = (patch: Partial<NewTicketInput>) =>
    setForm((prev) => ({ ...prev, ...patch }));
  const valid = form.subject.trim() !== "" && form.email.includes("@");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (valid) {
      onCreate(form);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New ticket</DialogTitle>
            <DialogDescription>
              Log a conversation on a customer&apos;s behalf. They get a copy by
              email.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`${id}-subject`}>Subject</Label>
              <Input
                id={`${id}-subject`}
                value={form.subject}
                onChange={(event) => set({ subject: event.target.value })}
                placeholder="Can't connect the Slack integration"
                maxLength={120}
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${id}-name`}>Requester</Label>
                <Input
                  id={`${id}-name`}
                  value={form.name}
                  onChange={(event) => set({ name: event.target.value })}
                  placeholder="Jordan Lee"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`${id}-email`}>Email</Label>
                <Input
                  id={`${id}-email`}
                  type="email"
                  value={form.email}
                  onChange={(event) => set({ email: event.target.value })}
                  placeholder="jordan@acme.com"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {/* *:w-full: the select's wrapper is w-fit; fill the column. */}
              <div className="grid gap-2 *:w-full">
                <Label htmlFor={`${id}-priority`}>Priority</Label>
                <NativeSelect
                  id={`${id}-priority`}
                  value={form.priority}
                  onChange={(event) =>
                    set({ priority: event.target.value as TicketPriority })
                  }
                  className="w-full"
                >
                  {PRIORITIES.map((priority) => (
                    <NativeSelectOption key={priority.id} value={priority.id}>
                      {priority.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
              <div className="grid gap-2 *:w-full">
                <Label htmlFor={`${id}-assignee`}>Assignee</Label>
                <NativeSelect
                  id={`${id}-assignee`}
                  value={form.assignee ?? UNASSIGNED}
                  onChange={(event) =>
                    set({
                      assignee:
                        event.target.value === UNASSIGNED
                          ? null
                          : event.target.value,
                    })
                  }
                  className="w-full"
                >
                  <NativeSelectOption value={UNASSIGNED}>
                    Unassigned
                  </NativeSelectOption>
                  {agents.map((agent) => (
                    <NativeSelectOption key={agent} value={agent}>
                      {agent}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`${id}-message`}>Message</Label>
              <Textarea
                id={`${id}-message`}
                value={form.message}
                onChange={(event) => set({ message: event.target.value })}
                placeholder="What did the customer write in about?"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!valid}>
              Create ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const DeleteTicketsDialog = ({
  ids,
  onClose,
  onConfirm,
}: {
  ids: string[] | null;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) => {
  const count = ids?.length ?? 0;
  const label = count === 1 ? (ids?.[0] ?? "") : `${count} tickets`;
  return (
    <Dialog
      open={ids !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {count === 1 ? "ticket" : "tickets"}</DialogTitle>
          <DialogDescription>
            This permanently removes{" "}
            <span className="text-foreground font-medium">{label}</span> and its
            conversation history. Customers are not notified. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => ids && onConfirm(ids)}
            autoFocus
          >
            Delete {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DetailRow = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-[7rem_1fr] items-center gap-3 py-1.5">
    <dt className="text-muted-foreground text-sm">{label}</dt>
    <dd className="min-w-0">{children}</dd>
  </div>
);

// The editable fields of the sheet: status, priority, assignee.
const SheetFields = ({
  row,
  agents,
  update,
}: {
  row: TicketRow;
  agents: string[];
  update: (patch: Partial<TicketRow>) => void;
}) => (
  <>
    <DetailRow label="Status">
      <Menu>
        <CellMenuTrigger label="Change status">
          <StatusLabel status={row.status} />
        </CellMenuTrigger>
        <DropdownMenuContent align="start">
          <StatusItems
            value={row.status}
            onChange={(status) => update({ status })}
          />
        </DropdownMenuContent>
      </Menu>
    </DetailRow>
    <DetailRow label="Priority">
      <Menu>
        <CellMenuTrigger label="Change priority">
          <PriorityLabel priority={row.priority} />
        </CellMenuTrigger>
        <DropdownMenuContent align="start">
          <PriorityItems
            value={row.priority}
            onChange={(priority) => update({ priority })}
          />
        </DropdownMenuContent>
      </Menu>
    </DetailRow>
    <DetailRow label="Assignee">
      <Menu>
        <CellMenuTrigger label="Change assignee">
          <AssigneeName assignee={row.assignee} />
        </CellMenuTrigger>
        <DropdownMenuContent align="start">
          <AssigneeItems
            value={row.assignee}
            agents={agents}
            onChange={(assignee) => update({ assignee })}
          />
        </DropdownMenuContent>
      </Menu>
    </DetailRow>
  </>
);

// Everything the table leaves out (tags, email, channel, the message) lives
// here, with status, priority and assignee editable.
const TicketSheet = ({
  row,
  agents,
  now,
  onClose,
  onUpdate,
}: {
  row: TicketRow | null;
  agents: string[];
  now: number;
  onClose: () => void;
  onUpdate: (ids: string[], patch: Partial<TicketRow>) => void;
}) => {
  const channel = row ? CHANNELS[row.channel] : CHANNELS.email;
  const update = (patch: Partial<TicketRow>) => {
    if (row) {
      onUpdate([row.id], patch);
    }
  };
  return (
    <Sheet
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        {row && (
          <>
            <SheetHeader className="border-b">
              <span className="text-muted-foreground font-mono text-xs">
                {row.id}
              </span>
              <SheetTitle className="text-lg leading-snug text-pretty">
                {row.subject}
              </SheetTitle>
              <SheetDescription>
                From {row.requester.name} at {row.requester.company}
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <StatusLabel status={row.status} />
                <span aria-hidden className="text-muted-foreground">
                  ·
                </span>
                <DueLabel row={row} now={now} />
              </div>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="flex gap-3">
                <PersonAvatar name={row.requester.name} className="size-8" />
                <div className="bg-muted/60 min-w-0 flex-1 rounded-xl rounded-tl-sm px-3.5 py-2.5">
                  <p className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium">{row.requester.name}</span>
                    <span
                      suppressHydrationWarning
                      className="text-muted-foreground"
                    >
                      {timeAgo(row.updatedAt, now)}
                    </span>
                  </p>
                  <p className="mt-1 text-sm text-pretty">{row.preview}</p>
                </div>
              </div>
              <dl className="mt-6 border-t pt-3">
                <SheetFields row={row} agents={agents} update={update} />
                <DetailRow label="Requester">
                  <span className="block truncate text-sm">
                    {row.requester.email}
                  </span>
                </DetailRow>
                <DetailRow label="Channel">
                  <span className="inline-flex items-center gap-1.5 text-sm">
                    <channel.icon
                      aria-hidden
                      className="text-muted-foreground size-4"
                    />
                    {channel.label}
                  </span>
                </DetailRow>
                <DetailRow label="Tags">
                  <span className="flex flex-wrap gap-1">
                    {row.tags.length === 0 && (
                      <span className="text-muted-foreground text-sm">
                        None
                      </span>
                    )}
                    {row.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="font-normal"
                      >
                        {tag}
                      </Badge>
                    ))}
                  </span>
                </DetailRow>
                <DetailRow label="Created">
                  <span
                    suppressHydrationWarning
                    className="inline-flex items-center gap-1.5 text-sm"
                  >
                    <CalendarDays
                      aria-hidden
                      className="text-muted-foreground size-4"
                    />
                    {new Date(row.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </DetailRow>
              </dl>
            </div>
            <SheetFooter className="border-t sm:flex-row sm:justify-end">
              {isDone(row) ? (
                <Button
                  variant="outline"
                  onClick={() => update({ status: "open" })}
                >
                  Reopen ticket
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => update({ status: "pending" })}
                  >
                    <Timer aria-hidden className="size-4" />
                    Mark pending
                  </Button>
                  <Button onClick={() => update({ status: "solved" })}>
                    <Check aria-hidden className="size-4" />
                    Mark solved
                  </Button>
                </>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

// ─── The section ─────────────────────────────────────────────────────────────

const countBy = <K extends string>(
  rows: TicketRow[],
  keys: K[],
  key: (row: TicketRow) => K
): Record<K, number> => {
  const counts = Object.fromEntries(keys.map((id) => [id, 0])) as Record<
    K,
    number
  >;
  for (const row of rows) {
    counts[key(row)] += 1;
  }
  return counts;
};

const matchesFilters = (
  row: TicketRow,
  filters: Filters,
  query: string
): boolean => {
  if (filters.status.size > 0 && !filters.status.has(row.status)) {
    return false;
  }
  if (filters.priority.size > 0 && !filters.priority.has(row.priority)) {
    return false;
  }
  if (filters.assignee === UNASSIGNED && row.assignee !== null) {
    return false;
  }
  if (
    filters.assignee !== "all" &&
    filters.assignee !== UNASSIGNED &&
    row.assignee !== filters.assignee
  ) {
    return false;
  }
  if (!query) {
    return true;
  }
  return [
    row.id,
    row.subject,
    row.requester.name,
    row.requester.company,
    row.requester.email,
    ...row.tags,
  ].some((text) => text.toLowerCase().includes(query));
};

// Keyboard shortcuts belong to one table at a time: the one with focus or
// the pointer over it, or the only one on the page. Without this, two tables
// on one page would both answer the same key.
const ownsShortcuts = (section: HTMLElement | null): boolean => {
  if (!section) {
    return false;
  }
  if (section.contains(document.activeElement) || section.matches(":hover")) {
    return true;
  }
  return document.querySelectorAll("[data-shortcuts]").length === 1;
};

export default function TablesSection02({
  initialTickets,
  agents = AGENTS,
  currentUser = AGENTS[0],
  className,
}: TicketsSectionProps = {}) {
  const [tickets, setTickets] = React.useState<TicketRow[]>(
    () => initialTickets ?? buildMockTickets(Date.now())
  );
  const [now, setNow] = React.useState(() => Date.now());
  const [view, setView] = React.useState<ViewId>("all");
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);
  // Most recently updated first.
  const [sort, setSort] = React.useState<SortState>({
    column: "updated",
    direction: "desc",
  });
  const [visible, setVisible] =
    React.useState<Record<ColumnId, boolean>>(ALL_COLUMNS);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null);
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [announcement, setAnnouncement] = React.useState("");

  const searchRef = React.useRef<HTMLInputElement>(null);
  const sectionRef = React.useRef<HTMLElement>(null);
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // SLA timers and "updated" times tick along.
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(
    () => () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
    },
    []
  );

  const viewCounts = React.useMemo(
    () =>
      Object.fromEntries(
        VIEWS.map((item) => [
          item.id,
          tickets.filter((row) => inView(row, item.id, currentUser, now))
            .length,
        ])
      ) as Record<ViewId, number>,
    [tickets, currentUser, now]
  );

  const inCurrentView = React.useMemo(
    () => tickets.filter((row) => inView(row, view, currentUser, now)),
    [tickets, view, currentUser, now]
  );

  const filterCounts = React.useMemo(
    () => ({
      priority: countBy(
        inCurrentView,
        PRIORITIES.map((priority) => priority.id),
        (row) => row.priority
      ),
      status: countBy(
        inCurrentView,
        STATUSES.map((status) => status.id),
        (row) => row.status
      ),
    }),
    [inCurrentView]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return inCurrentView
      .filter((row) => matchesFilters(row, filters, q))
      .toSorted((a, b) => compareRows(a, b, sort, now));
  }, [inCurrentView, query, filters, sort, now]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  React.useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const visibleCount = COLUMNS.filter((col) => visible[col.id]).length;
  const pageIds = pageRows.map((row) => row.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const somePageSelected = pageIds.some((id) => selected.has(id));

  const resetPage = () => setPage(1);

  const refresh = React.useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }
    setLoading(true);
    refreshTimer.current = setTimeout(() => setLoading(false), 700);
  }, []);

  const exportCsv = React.useCallback(() => {
    downloadCsv(filtered, now);
    setAnnouncement(`Exported ${filtered.length} tickets.`);
  }, [filtered, now]);

  const anyOverlayOpen = newOpen || deleteIds !== null || openId !== null;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target?.closest("input, textarea, select, [contenteditable='true']") ||
        anyOverlayOpen ||
        !ownsShortcuts(sectionRef.current)
      ) {
        return;
      }
      const pressed = event.key.toLowerCase();
      if (pressed === "c") {
        event.preventDefault();
        setNewOpen(true);
      } else if (pressed === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (pressed === "r") {
        event.preventDefault();
        refresh();
      } else if (pressed === "e") {
        event.preventDefault();
        exportCsv();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [anyOverlayOpen, refresh, exportCsv]);

  const togglePage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }
      return next;
    });
  };

  const toggleRow = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const updateTickets = (ids: string[], patch: Partial<TicketRow>) => {
    const at = Date.now();
    setTickets((prev) =>
      prev.map((row) =>
        ids.includes(row.id)
          ? { ...row, ...patch, unread: false, updatedAt: at }
          : row
      )
    );
  };

  const removeTickets = (ids: string[]) => {
    setTickets((prev) => prev.filter((row) => !ids.includes(row.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
    setDeleteIds(null);
    setAnnouncement(
      `Deleted ${ids.length} ticket${ids.length === 1 ? "" : "s"}.`
    );
  };

  const createTicket = (input: NewTicketInput) => {
    const at = Date.now();
    const row: TicketRow = {
      assignee: input.assignee,
      channel: "web",
      createdAt: at,
      id: `TCK-${randomPart(4)}`,
      preview: input.message.trim() || input.subject.trim(),
      priority: input.priority,
      replies: 0,
      requester: {
        company: input.email.split("@")[1] ?? "",
        email: input.email.trim(),
        name: input.name.trim() || input.email.split("@")[0],
      },
      slaDueAt: at + (input.priority === "urgent" ? 1 : 4) * HOUR,
      status: "open",
      subject: input.subject.trim(),
      tags: [],
      unread: false,
      updatedAt: at,
    };
    setTickets((prev) => [row, ...prev]);
    setView("all");
    resetPage();
    setNewOpen(false);
    setAnnouncement(`Created ${row.id}.`);
  };

  const copyLink = async (row: TicketRow) => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${window.location.pathname}#${row.id}`
      );
      setAnnouncement(`Copied a link to ${row.id}.`);
    } catch {
      setAnnouncement("Couldn't copy the link.");
    }
  };

  const changeFilters = (next: Filters) => {
    setFilters(next);
    resetPage();
  };

  const clearFilters = () => {
    setQuery("");
    changeFilters(NO_FILTERS);
  };

  // A header toggles direction when it's already the order; otherwise (and
  // from the View menu) it starts at that order's natural direction.
  const sortBy = (column: SortColumn) =>
    setSort((prev) => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { column, direction: DEFAULT_DIRECTION[column] };
    });

  const actions: RowActions = {
    onCopyLink: copyLink,
    onDelete: (ids) => setDeleteIds(ids),
    onOpen: (row) => {
      setOpenId(row.id);
      if (row.unread) {
        setTickets((prev) =>
          prev.map((item) =>
            item.id === row.id ? { ...item, unread: false } : item
          )
        );
      }
    },
    onUpdate: updateTickets,
  };

  const openRow = tickets.find((row) => row.id === openId) ?? null;

  return (
    <section
      ref={sectionRef}
      data-slot="tables-section-02"
      data-shortcuts=""
      className={cn(
        "bg-background text-foreground @container w-full",
        className
      )}
    >
      {/* Fills whatever it's placed in: the host page or app layout sets the
          width. Only side padding, so it never touches the edges. */}
      <div className="w-full px-4 py-6 @xl:px-6 @xl:py-8">
        <TicketsHeader onExport={exportCsv} onNew={() => setNewOpen(true)} />

        <ViewTabs
          view={view}
          counts={viewCounts}
          onChange={(next) => {
            setView(next);
            setSelected(new Set());
            resetPage();
          }}
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <SearchBox
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              resetPage();
            }}
            searchRef={searchRef}
          />
          <FilterMenu
            filters={filters}
            counts={filterCounts}
            agents={agents}
            onChange={changeFilters}
          />
          <div className="ml-auto flex items-center gap-2">
            <ViewMenu
              sort={sort}
              onSortColumn={(column) =>
                setSort({ column, direction: DEFAULT_DIRECTION[column] })
              }
              visible={visible}
              onToggleColumn={(id) =>
                setVisible((prev) => ({ ...prev, [id]: !prev[id] }))
              }
              onShowAllColumns={() => setVisible(ALL_COLUMNS)}
            />
            <Button
              variant="outline"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh tickets"
            >
              <RefreshCw
                aria-hidden
                className={cn("size-4", loading && "animate-spin")}
              />
              <Kbd>R</Kbd>
            </Button>
          </div>
        </div>
        <FilterChips filters={filters} onChange={changeFilters} />

        <div className="border-border bg-card mt-4 overflow-hidden rounded-xl border shadow-sm">
          <TicketsTable
            rows={pageRows}
            hasTickets={inCurrentView.length > 0}
            loading={loading}
            agents={agents}
            visible={visible}
            visibleCount={visibleCount}
            selected={selected}
            allPageSelected={allPageSelected}
            somePageSelected={somePageSelected}
            onTogglePage={togglePage}
            onToggleRow={toggleRow}
            sort={sort}
            onSort={sortBy}
            actions={actions}
            onClearFilters={clearFilters}
            onNew={() => setNewOpen(true)}
            now={now}
          />
          <TicketsFooter
            selectedCount={selected.size}
            totalCount={filtered.length}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              resetPage();
            }}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            agents={agents}
            onAssignSelected={(assignee) =>
              updateTickets([...selected], { assignee })
            }
            onSolveSelected={() =>
              updateTickets([...selected], { status: "solved" })
            }
            onDeleteSelected={() => setDeleteIds([...selected])}
          />
        </div>

        <p className="text-muted-foreground mt-4 text-xs">
          Shortcuts: <Kbd>C</Kbd> new ticket · <Kbd>/</Kbd> search ·{" "}
          <Kbd>R</Kbd> refresh · <Kbd>E</Kbd> export · <Kbd>Esc</Kbd> close
        </p>
      </div>

      <NewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        agents={agents}
        currentUser={currentUser}
        onCreate={createTicket}
      />
      <DeleteTicketsDialog
        ids={deleteIds}
        onClose={() => setDeleteIds(null)}
        onConfirm={removeTickets}
      />
      <TicketSheet
        row={openRow}
        agents={agents}
        now={now}
        onClose={() => setOpenId(null)}
        onUpdate={updateTickets}
      />

      <div aria-live="polite" className="sr-only">
        {loading ? "Refreshing tickets." : announcement}
      </div>
    </section>
  );
}
