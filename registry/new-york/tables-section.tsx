"use client";

import {
  Activity,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleOff,
  CirclePlus,
  CodeXml,
  Copy,
  History,
  KeyRound,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  RotateCw,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  UserRound,
  X,
} from "lucide-react";
import * as React from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// API keys table, modelled on the Reloop dashboard's API keys page: header
// actions, search + filters toolbar, selectable rows with a per-row menu,
// pagination footer, and the full key lifecycle (create, rename, rotate,
// disable/enable, delete). Interactive demo state lives in this file so the
// block works the moment it is dropped into a page.

export type ApiKeyStatus = "active" | "disabled";

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  status: ApiKeyStatus;
  /** Null means the key was never used ("No Activity"). */
  lastUsedAt: number | null;
  createdBy: string;
  createdAt: number;
}

export interface ApiKeysSectionProps {
  initialKeys?: ApiKeyRow[];
  /** Shown as the author of keys created from this UI. */
  currentUser?: string;
  sdkHref?: string;
  docsHref?: string;
  className?: string;
}

type ColumnId = "prefix" | "lastUsed" | "status" | "createdBy" | "createdAt";

const COLUMNS: { id: ColumnId; label: string; icon: typeof KeyRound }[] = [
  { icon: KeyRound, id: "prefix", label: "Prefix" },
  { icon: History, id: "lastUsed", label: "Last Used" },
  { icon: Activity, id: "status", label: "Status" },
  { icon: UserRound, id: "createdBy", label: "Created By" },
  { icon: CalendarDays, id: "createdAt", label: "Created At" },
];

const PAGE_SIZES = [10, 20, 50];

const AVATAR_BG = [
  "bg-orange-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-rose-500",
  "bg-amber-500",
];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const buildMockKeys = (now: number): ApiKeyRow[] => [
  {
    createdAt: now - 2 * HOUR,
    createdBy: "pranavkpatel97",
    id: "key_production",
    lastUsedAt: null,
    name: "production",
    prefix: "rl_prod_fuaZQ0fdm",
    status: "active",
  },
  {
    createdAt: now - 8 * HOUR,
    createdBy: "pranavkpatel97",
    id: "key_uptime",
    lastUsedAt: null,
    name: "uptime",
    prefix: "rl_prod_RPCZLrBkh",
    status: "active",
  },
  {
    createdAt: now - 3 * DAY,
    createdBy: "sara-chen",
    id: "key_newsletter",
    lastUsedAt: now - 26 * 60_000,
    name: "newsletter",
    prefix: "rl_prod_9dKx2mQvRt",
    status: "active",
  },
  {
    createdAt: now - 6 * DAY,
    createdBy: "mike-dev",
    id: "key_staging_worker",
    lastUsedAt: now - 5 * 60_000,
    name: "staging-worker",
    prefix: "rl_test_4HsNw8bLcD",
    status: "active",
  },
  {
    createdAt: now - 12 * DAY,
    createdBy: "sara-chen",
    id: "key_ci_deploy",
    lastUsedAt: now - 2 * DAY,
    name: "ci-deploy",
    prefix: "rl_prod_Zq7tYp3VxN",
    status: "disabled",
  },
  {
    createdAt: now - 30 * DAY,
    createdBy: "pranavkpatel97",
    id: "key_transactional",
    lastUsedAt: now - 9 * DAY,
    name: "transactional",
    prefix: "rl_prod_mB2vC8nJ4s",
    status: "active",
  },
  {
    createdAt: now - 15 * DAY,
    createdBy: "mike-dev",
    id: "key_mobile_app",
    lastUsedAt: now - 3 * HOUR,
    name: "mobile-app",
    prefix: "rl_prod_tG6hK9dF2a",
    status: "active",
  },
  {
    createdAt: now - 45 * DAY,
    createdBy: "sara-chen",
    id: "key_analytics_ingest",
    lastUsedAt: null,
    name: "analytics-ingest",
    prefix: "rl_prod_wE3rT7yU1i",
    status: "disabled",
  },
  {
    createdAt: now - 60 * DAY,
    createdBy: "pranavkpatel97",
    id: "key_partner_sync",
    lastUsedAt: now - 6 * DAY,
    name: "partner-sync",
    prefix: "rl_prod_pL5oK8jH3g",
    status: "active",
  },
  {
    createdAt: now - 90 * DAY,
    createdBy: "mike-dev",
    id: "key_legacy_cron",
    lastUsedAt: now - 40 * DAY,
    name: "legacy-cron",
    prefix: "rl_prod_sD4fG7hJ2k",
    status: "disabled",
  },
  {
    createdAt: now - 5 * DAY,
    createdBy: "sara-chen",
    id: "key_support_tool",
    lastUsedAt: now - 12 * HOUR,
    name: "support-tool",
    prefix: "rl_test_aS9dF6gH1j",
    status: "active",
  },
  {
    createdAt: now - 20 * DAY,
    createdBy: "pranavkpatel97",
    id: "key_backup_worker",
    lastUsedAt: null,
    name: "backup-worker",
    prefix: "rl_prod_qW8eR5tY2u",
    status: "active",
  },
];

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const randomPart = (length: number): string =>
  Array.from(
    { length },
    () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
  ).join("");

const mintSecret = (): { prefix: string; secret: string } => {
  const prefix = `rl_prod_${randomPart(12)}`;
  return { prefix, secret: `${prefix}_${randomPart(24)}` };
};

const timeAgo = (timestamp: number, now: number): string => {
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) {
    return "Just now";
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
};

const avatarColor = (name: string): string => {
  let hash = 0;
  for (const char of name) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 997;
  }
  return AVATAR_BG[hash % AVATAR_BG.length];
};

const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      return true;
    } catch {
      return false;
    }
  }
};

const SecretReveal = ({
  secret,
  copied,
  onCopy,
}: {
  secret: string;
  copied: boolean;
  onCopy: () => void;
}) => (
  <div className="grid gap-3 py-2">
    <div className="border-border bg-muted flex items-center gap-2 rounded-md border px-3 py-2.5">
      <code className="min-w-0 flex-1 truncate font-mono text-sm">
        {secret}
      </code>
      <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
        {copied ? (
          <>
            <Check aria-hidden className="size-4" />
            Copied
          </>
        ) : (
          <>
            <Copy aria-hidden className="size-4" />
            Copy
          </>
        )}
      </Button>
    </div>
    <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      Copy the secret now. Only a secure hash is stored, so the full secret can
      never be shown again.
    </p>
  </div>
);

interface ToolbarProps {
  query: string;
  onQueryChange: (query: string) => void;
  statusFilter: "all" | ApiKeyStatus;
  onStatusFilterChange: (status: "all" | ApiKeyStatus) => void;
  userFilter: string;
  onUserFilterChange: (user: string) => void;
  users: string[];
  visible: Record<ColumnId, boolean>;
  onToggleColumn: (id: ColumnId) => void;
  onShowAllColumns: () => void;
  loading: boolean;
  onRefresh: () => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}

const KeysToolbar = ({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  userFilter,
  onUserFilterChange,
  users,
  visible,
  onToggleColumn,
  onShowAllColumns,
  loading,
  onRefresh,
  searchRef,
}: ToolbarProps) => (
  <div className="mt-6 flex flex-wrap items-center gap-2">
    <div className="relative min-w-0 flex-1 sm:max-w-xs">
      <Search
        aria-hidden
        className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
      />
      <Input
        ref={searchRef}
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search API keys..."
        aria-label="Search API keys"
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

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <CirclePlus aria-hidden className="size-4" />
          Status
          {statusFilter !== "all" && (
            <span className="bg-primary text-primary-foreground ml-1 inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
              1
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={statusFilter}
          onValueChange={(value) =>
            onStatusFilterChange(value as "all" | ApiKeyStatus)
          }
        >
          <DropdownMenuRadioItem value="all">All keys</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="active">Active</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="disabled">
            Disabled
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <CirclePlus aria-hidden className="size-4" />
          User
          {userFilter !== "all" && (
            <span className="bg-primary text-primary-foreground ml-1 inline-flex size-5 items-center justify-center rounded-full text-[11px] font-semibold">
              1
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Filter by user</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={userFilter}
          onValueChange={onUserFilterChange}
        >
          <DropdownMenuRadioItem value="all">All users</DropdownMenuRadioItem>
          {users.map((user) => (
            <DropdownMenuRadioItem key={user} value={user}>
              {user}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>

    <div className="ml-auto flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">
            <SlidersHorizontal aria-hidden className="size-4" />
            View
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {COLUMNS.map((col) => (
            <DropdownMenuCheckboxItem
              key={col.id}
              checked={visible[col.id]}
              onCheckedChange={() => onToggleColumn(col.id)}
            >
              {col.label}
            </DropdownMenuCheckboxItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onShowAllColumns}>
            Show all columns
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        onClick={onRefresh}
        disabled={loading}
        aria-label="Refresh API keys"
      >
        <RefreshCw
          aria-hidden
          className={cn("size-4", loading && "animate-spin")}
        />
        <Kbd>R</Kbd>
      </Button>
    </div>
  </div>
);

interface TableProps {
  rows: ApiKeyRow[];
  hasKeys: boolean;
  loading: boolean;
  visible: Record<ColumnId, boolean>;
  visibleCount: number;
  selected: Set<string>;
  allPageSelected: boolean;
  somePageSelected: boolean;
  onTogglePage: (checked: boolean) => void;
  onToggleRow: (id: string, checked: boolean) => void;
  copied: string | null;
  onCopy: (id: string, text: string) => void;
  onEdit: (row: ApiKeyRow) => void;
  onRotate: (row: ApiKeyRow) => void;
  onSetStatus: (ids: string[], status: ApiKeyStatus) => void;
  onDelete: (ids: string[]) => void;
  onClearFilters: () => void;
  onOpenCreate: () => void;
  now: number;
}

const pageCheckboxState = (
  allSelected: boolean,
  someSelected: boolean
): boolean | "indeterminate" => {
  if (allSelected) {
    return true;
  }
  if (someSelected) {
    return "indeterminate";
  }
  return false;
};

const KeysTable = ({
  rows,
  hasKeys,
  loading,
  visible,
  visibleCount,
  selected,
  allPageSelected,
  somePageSelected,
  onTogglePage,
  onToggleRow,
  copied,
  onCopy,
  onEdit,
  onRotate,
  onSetStatus,
  onDelete,
  onClearFilters,
  onOpenCreate,
  now,
}: TableProps) => {
  const colSpan = 3 + visibleCount + 1;

  const emptyState = hasKeys ? (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
      <span className="border-border bg-muted flex size-11 items-center justify-center rounded-full border">
        <SearchX aria-hidden className="text-muted-foreground size-5" />
      </span>
      <p className="mt-2 font-medium">No keys match</p>
      <p className="text-muted-foreground text-sm">
        Nothing matches this search or filter combination.
      </p>
      <Button variant="outline" onClick={onClearFilters} className="mt-2">
        Clear search and filters
      </Button>
    </div>
  ) : (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-2">
      <span className="border-border bg-muted flex size-11 items-center justify-center rounded-full border">
        <KeyRound aria-hidden className="text-muted-foreground size-5" />
      </span>
      <p className="mt-2 font-medium">No API keys yet</p>
      <p className="text-muted-foreground text-sm">
        Create your first key to start sending email over the API or SMTP.
      </p>
      <Button onClick={onOpenCreate} className="mt-2">
        <span aria-hidden className="text-base leading-none">
          +
        </span>
        Create API key
        <Kbd className="bg-primary-foreground/20 text-primary-foreground shadow-none dark:bg-primary-foreground/20">
          C
        </Kbd>
      </Button>
    </div>
  );

  let body: React.ReactNode;
  if (loading) {
    body = (
      <>
        {Array.from({ length: 4 }, (_, i) => (
          <TableRow key={`skeleton-${i}`}>
            <TableCell className="pl-4" colSpan={colSpan}>
              <Skeleton className="h-9 w-full" />
            </TableCell>
          </TableRow>
        ))}
      </>
    );
  } else if (rows.length === 0) {
    body = (
      <TableRow className="hover:bg-transparent">
        <TableCell colSpan={colSpan} className="px-4 py-14 text-center">
          {emptyState}
        </TableCell>
      </TableRow>
    );
  } else {
    body = rows.map((row) => {
      const isSelected = selected.has(row.id);
      const isDisabled = row.status === "disabled";
      return (
        <TableRow
          key={row.id}
          data-state={isSelected ? "selected" : undefined}
          className="group"
        >
          <TableCell className="pl-4">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(value) => onToggleRow(row.id, value === true)}
              aria-label={`Select ${row.name}`}
            />
          </TableCell>
          <TableCell>
            <button
              type="button"
              onClick={() => onEdit(row)}
              title={`Rename ${row.name}`}
              className="font-medium underline decoration-dotted underline-offset-4 hover:decoration-solid"
            >
              {row.name}
            </button>
          </TableCell>
          {visible.prefix && (
            <TableCell>
              <span className="inline-flex items-center gap-1">
                <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                  {row.prefix}
                </code>
                <button
                  type="button"
                  onClick={() => onCopy(`prefix-${row.id}`, row.prefix)}
                  aria-label={`Copy prefix of ${row.name}`}
                  title="Copy prefix"
                  className="text-muted-foreground hover:text-foreground rounded-sm p-1 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  {copied === `prefix-${row.id}` ? (
                    <Check aria-hidden className="size-3.5" />
                  ) : (
                    <Copy aria-hidden className="size-3.5" />
                  )}
                </button>
              </span>
            </TableCell>
          )}
          {visible.lastUsed && (
            <TableCell>
              {row.lastUsedAt === null ? (
                <span className="text-muted-foreground text-sm">
                  No Activity
                </span>
              ) : (
                <span
                  suppressHydrationWarning
                  title={new Date(row.lastUsedAt).toLocaleString()}
                  className="text-sm whitespace-nowrap"
                >
                  {timeAgo(row.lastUsedAt, now)}
                </span>
              )}
            </TableCell>
          )}
          {visible.status && (
            <TableCell>
              {isDisabled ? (
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
                  <CircleOff aria-hidden className="size-4" />
                  Disabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
                  <CircleCheck aria-hidden className="size-4" />
                  Active
                </span>
              )}
            </TableCell>
          )}
          {visible.createdBy && (
            <TableCell>
              <span className="inline-flex items-center gap-2">
                <Avatar className="size-6">
                  <AvatarFallback
                    className={cn(
                      "text-[11px] font-semibold text-white",
                      avatarColor(row.createdBy)
                    )}
                  >
                    {row.createdBy.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm whitespace-nowrap">
                  {row.createdBy}
                </span>
              </span>
            </TableCell>
          )}
          {visible.createdAt && (
            <TableCell>
              <span
                suppressHydrationWarning
                title={new Date(row.createdAt).toLocaleString()}
                className="text-sm whitespace-nowrap"
              >
                {timeAgo(row.createdAt, now)}
              </span>
            </TableCell>
          )}
          <TableCell className="pr-4 text-right">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${row.name}`}
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() => onCopy(`menu-${row.id}`, row.prefix)}
                >
                  <Copy aria-hidden className="size-4" />
                  Copy prefix
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(row)}>
                  <Pencil aria-hidden className="size-4" />
                  Edit API key
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onRotate(row)}>
                  <RotateCw aria-hidden className="size-4" />
                  Rotate key
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    onSetStatus([row.id], isDisabled ? "active" : "disabled")
                  }
                >
                  {isDisabled ? (
                    <>
                      <CircleCheck aria-hidden className="size-4" />
                      Enable key
                    </>
                  ) : (
                    <>
                      <CircleOff aria-hidden className="size-4" />
                      Disable key
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => onDelete([row.id])}
                >
                  <Trash2 aria-hidden className="size-4" />
                  Delete API key
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
      );
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-10 pl-4">
            <Checkbox
              checked={pageCheckboxState(allPageSelected, somePageSelected)}
              onCheckedChange={(value) => onTogglePage(value === true)}
              aria-label="Select all rows on this page"
            />
          </TableHead>
          <TableHead>Name</TableHead>
          {visible.prefix && <TableHead>Prefix</TableHead>}
          {visible.lastUsed && <TableHead>Last Used</TableHead>}
          {visible.status && <TableHead>Status</TableHead>}
          {visible.createdBy && <TableHead>Created By</TableHead>}
          {visible.createdAt && <TableHead>Created At</TableHead>}
          <TableHead className="w-12 pr-4">
            <span className="sr-only">Row actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{body}</TableBody>
    </Table>
  );
};

interface FooterProps {
  selectedCount: number;
  totalCount: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEnableSelected: () => void;
  onDisableSelected: () => void;
  onDeleteSelected: () => void;
}

const KeysFooter = ({
  selectedCount,
  totalCount,
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  onPageChange,
  onEnableSelected,
  onDisableSelected,
  onDeleteSelected,
}: FooterProps) => (
  <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-muted-foreground text-sm">
        {selectedCount} of {totalCount} row(s) selected.
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="Rows per page">
            {pageSize}
            <ChevronDown aria-hidden className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Rows per page</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            {PAGE_SIZES.map((size) => (
              <DropdownMenuRadioItem key={size} value={String(size)}>
                {size}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {selectedCount > 0 && (
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onEnableSelected}>
            <CircleCheck aria-hidden className="size-3.5" />
            Enable
          </Button>
          <Button variant="ghost" size="sm" onClick={onDisableSelected}>
            <CircleOff aria-hidden className="size-3.5" />
            Disable
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
      )}
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

interface CreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => { name: string; secret: string };
}

const CreateKeyDialog = ({
  open,
  onOpenChange,
  onCreate,
}: CreateDialogProps) => {
  const [name, setName] = React.useState("");
  const [result, setResult] = React.useState<{
    name: string;
    secret: string;
  } | null>(null);
  const [copiedSecret, setCopiedSecret] = React.useState(false);
  const inputId = React.useId();

  React.useEffect(() => {
    if (open) {
      setName("");
      setResult(null);
      setCopiedSecret(false);
    }
  }, [open]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setResult(onCreate(trimmed));
  };

  const copySecret = async () => {
    if (!result) {
      return;
    }
    const ok = await copyToClipboard(result.secret);
    setCopiedSecret(ok);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Key created</DialogTitle>
              <DialogDescription>
                {result.name} is ready. Copy the secret now.
              </DialogDescription>
            </DialogHeader>
            <SecretReveal
              secret={result.secret}
              copied={copiedSecret}
              onCopy={copySecret}
            />
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                Give the key a descriptive name, like “Production Server”.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor={inputId}>Key name</Label>
              <Input
                id={inputId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Production Server"
                maxLength={60}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!name.trim()}>
                Create API key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface EditDialogProps {
  row: ApiKeyRow | null;
  onClose: () => void;
  onSave: (name: string) => void;
}

const EditKeyDialog = ({ row, onClose, onSave }: EditDialogProps) => {
  const [name, setName] = React.useState(row?.name ?? "");
  const inputId = React.useId();

  React.useEffect(() => {
    setName(row?.name ?? "");
  }, [row]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    onSave(trimmed);
  };

  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Edit API key</DialogTitle>
            <DialogDescription>
              Only the name can be changed. To get a new secret, rotate the key
              instead.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor={inputId}>Key name</Label>
            <Input
              id={inputId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || name.trim() === row?.name}
            >
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

interface RotateDialogProps {
  row: ApiKeyRow | null;
  onClose: () => void;
  onRotate: (id: string) => { name: string; secret: string };
}

const RotateKeyDialog = ({ row, onClose, onRotate }: RotateDialogProps) => {
  const [confirm, setConfirm] = React.useState("");
  const [result, setResult] = React.useState<{
    name: string;
    secret: string;
  } | null>(null);
  const [copiedSecret, setCopiedSecret] = React.useState(false);
  const inputId = React.useId();

  React.useEffect(() => {
    setConfirm("");
    setResult(null);
    setCopiedSecret(false);
  }, [row]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!row || confirm !== row.name) {
      return;
    }
    setResult(onRotate(row.id));
  };

  const copySecret = async () => {
    if (!result) {
      return;
    }
    const ok = await copyToClipboard(result.secret);
    setCopiedSecret(ok);
  };

  return (
    <Dialog
      open={row !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent>
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Key rotated</DialogTitle>
              <DialogDescription>
                {result.name} has a new secret. The old one no longer works.
              </DialogDescription>
            </DialogHeader>
            <SecretReveal
              secret={result.secret}
              copied={copiedSecret}
              onCopy={copySecret}
            />
            <DialogFooter>
              <Button onClick={onClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Rotate key</DialogTitle>
              <DialogDescription>
                Rotating issues a new secret and immediately revokes the old
                one. Request logs and usage history stay intact. Type the key
                name to confirm.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-4">
              <Label htmlFor={inputId}>
                Key name:{" "}
                <span className="font-mono font-medium">{row?.name}</span>
              </Label>
              <Input
                id={inputId}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                placeholder={row?.name ?? ""}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!row || confirm !== row.name}>
                Rotate key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

interface DeleteDialogProps {
  ids: string[] | null;
  names: Map<string, string>;
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

const DeleteKeysDialog = ({
  ids,
  names,
  onClose,
  onConfirm,
}: DeleteDialogProps) => {
  const [confirm, setConfirm] = React.useState("");
  const inputId = React.useId();

  React.useEffect(() => {
    setConfirm("");
  }, [ids]);

  const isBulk = (ids?.length ?? 0) > 1;
  const label = isBulk
    ? `${ids?.length ?? 0} keys`
    : (names.get(ids?.[0] ?? "") ?? "the key");
  const expected = isBulk ? String(ids?.length ?? 0) : label;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ids || confirm !== expected) {
      return;
    }
    onConfirm(ids);
  };

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
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Delete {isBulk ? "keys" : "key"}</DialogTitle>
            <DialogDescription>
              This permanently removes {label || "the key"}. Requests using it
              will fail, and this cannot be undone.{" "}
              {isBulk ? (
                <>
                  Type <span className="font-mono font-medium">{expected}</span>{" "}
                  to confirm.
                </>
              ) : (
                <>Type the key name to confirm.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-4">
            <Label htmlFor={inputId}>
              {isBulk ? (
                <>
                  Number of keys:{" "}
                  <span className="font-mono font-medium">{expected}</span>
                </>
              ) : (
                <>
                  Key name:{" "}
                  <span className="font-mono font-medium">{label}</span>
                </>
              )}
            </Label>
            <Input
              id={inputId}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder={expected}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!ids || confirm !== expected}
            >
              Delete {isBulk ? `${ids?.length ?? 0} keys` : "API key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default function TablesSection({
  initialKeys,
  currentUser = "you",
  sdkHref = "#",
  docsHref = "#",
  className,
}: ApiKeysSectionProps = {}) {
  const [keys, setKeys] = React.useState<ApiKeyRow[]>(
    () => initialKeys ?? buildMockKeys(Date.now())
  );
  const [now, setNow] = React.useState(() => Date.now());
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | ApiKeyStatus>(
    "all"
  );
  const [userFilter, setUserFilter] = React.useState<string>("all");
  const [visible, setVisible] = React.useState<Record<ColumnId, boolean>>({
    createdAt: true,
    createdBy: true,
    lastUsed: true,
    prefix: true,
    status: true,
  });
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZES[0]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [rotateId, setRotateId] = React.useState<string | null>(null);
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null);

  const searchRef = React.useRef<HTMLInputElement>(null);
  const sdkRef = React.useRef<HTMLAnchorElement>(null);
  const docsRef = React.useRef<HTMLAnchorElement>(null);
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  React.useEffect(
    () => () => {
      if (refreshTimer.current) {
        clearTimeout(refreshTimer.current);
      }
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    },
    []
  );

  const users = React.useMemo(
    () => [...new Set(keys.map((key) => key.createdBy))].toSorted(),
    [keys]
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return keys.filter((key) => {
      if (statusFilter !== "all" && key.status !== statusFilter) {
        return false;
      }
      if (userFilter !== "all" && key.createdBy !== userFilter) {
        return false;
      }
      if (q) {
        return (
          key.name.toLowerCase().includes(q) ||
          key.prefix.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [keys, query, statusFilter, userFilter]);

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
  const names = React.useMemo(
    () => new Map(keys.map((key) => [key.id, key.name])),
    [keys]
  );

  const resetPage = () => setPage(1);

  const refresh = React.useCallback(() => {
    if (refreshTimer.current) {
      clearTimeout(refreshTimer.current);
    }
    setLoading(true);
    refreshTimer.current = setTimeout(() => setLoading(false), 700);
  }, []);

  const openCreate = React.useCallback(() => setCreateOpen(true), []);

  const anyDialogOpen =
    createOpen || editId !== null || rotateId !== null || deleteIds !== null;

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (anyDialogOpen) {
        return;
      }
      const pressed = event.key.toLowerCase();
      if (pressed === "c") {
        event.preventDefault();
        openCreate();
      } else if (pressed === "/") {
        event.preventDefault();
        searchRef.current?.focus();
      } else if (pressed === "r") {
        event.preventDefault();
        refresh();
      } else if (pressed === "s") {
        event.preventDefault();
        sdkRef.current?.click();
      } else if (pressed === "d") {
        event.preventDefault();
        docsRef.current?.click();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [anyDialogOpen, openCreate, refresh]);

  const handleCopy = async (id: string, text: string) => {
    const ok = await copyToClipboard(text);
    if (!ok) {
      return;
    }
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    setCopied(id);
    copyTimer.current = setTimeout(() => setCopied(null), 1600);
  };

  const togglePage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        for (const id of pageIds) {
          next.add(id);
        }
      } else {
        for (const id of pageIds) {
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

  const setStatusMany = (ids: string[], status: ApiKeyStatus) => {
    setKeys((prev) =>
      prev.map((key) => (ids.includes(key.id) ? { ...key, status } : key))
    );
  };

  const removeKeys = (ids: string[]) => {
    setKeys((prev) => prev.filter((key) => !ids.includes(key.id)));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
  };

  const createKey = (name: string): { name: string; secret: string } => {
    const { prefix, secret } = mintSecret();
    const row: ApiKeyRow = {
      createdAt: Date.now(),
      createdBy: currentUser,
      id: `key_${randomPart(10)}`,
      lastUsedAt: null,
      name,
      prefix,
      status: "active",
    };
    setKeys((prev) => [row, ...prev]);
    resetPage();
    return { name, secret };
  };

  const rotateKey = (id: string): { name: string; secret: string } => {
    const { prefix, secret } = mintSecret();
    setKeys((prev) =>
      prev.map((key) => (key.id === id ? { ...key, prefix } : key))
    );
    const row = keys.find((key) => key.id === id);
    return { name: row?.name ?? "", secret };
  };

  const clearFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setUserFilter("all");
    resetPage();
  };

  const editRow = keys.find((key) => key.id === editId) ?? null;
  const rotateRow = keys.find((key) => key.id === rotateId) ?? null;

  return (
    <section
      data-slot="tables-section"
      className={cn("bg-background text-foreground w-full", className)}
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              <KeyRound aria-hidden className="size-6 sm:size-7" />
              API Keys
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md text-sm text-pretty sm:text-base">
              Create keys to send email from your app over the API or SMTP.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <a ref={sdkRef} href={sdkHref}>
                <CodeXml aria-hidden className="size-4" />
                SDK
                <Kbd>S</Kbd>
              </a>
            </Button>
            <Button asChild variant="outline">
              <a ref={docsRef} href={docsHref}>
                <BookOpen aria-hidden className="size-4" />
                Documentation
                <Kbd>D</Kbd>
              </a>
            </Button>
            <Button onClick={openCreate}>
              <span aria-hidden className="text-base leading-none">
                +
              </span>
              Create API key
              <Kbd className="bg-primary-foreground/20 text-primary-foreground shadow-none dark:bg-primary-foreground/20">
                C
              </Kbd>
            </Button>
          </div>
        </div>

        <KeysToolbar
          query={query}
          onQueryChange={(value) => {
            setQuery(value);
            resetPage();
          }}
          statusFilter={statusFilter}
          onStatusFilterChange={(value) => {
            setStatusFilter(value);
            resetPage();
          }}
          userFilter={userFilter}
          onUserFilterChange={(value) => {
            setUserFilter(value);
            resetPage();
          }}
          users={users}
          visible={visible}
          onToggleColumn={(id) =>
            setVisible((prev) => ({ ...prev, [id]: !prev[id] }))
          }
          onShowAllColumns={() =>
            setVisible({
              createdAt: true,
              createdBy: true,
              lastUsed: true,
              prefix: true,
              status: true,
            })
          }
          loading={loading}
          onRefresh={refresh}
          searchRef={searchRef}
        />

        <div className="border-border bg-card mt-4 overflow-hidden rounded-xl border shadow-sm">
          <KeysTable
            rows={pageRows}
            hasKeys={keys.length > 0}
            loading={loading}
            visible={visible}
            visibleCount={visibleCount}
            selected={selected}
            allPageSelected={allPageSelected}
            somePageSelected={somePageSelected}
            onTogglePage={togglePage}
            onToggleRow={toggleRow}
            copied={copied}
            onCopy={handleCopy}
            onEdit={(row) => setEditId(row.id)}
            onRotate={(row) => setRotateId(row.id)}
            onSetStatus={setStatusMany}
            onDelete={(ids) => setDeleteIds(ids)}
            onClearFilters={clearFilters}
            onOpenCreate={openCreate}
            now={now}
          />
          <KeysFooter
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
            onEnableSelected={() => setStatusMany([...selected], "active")}
            onDisableSelected={() => setStatusMany([...selected], "disabled")}
            onDeleteSelected={() => setDeleteIds([...selected])}
          />
        </div>

        <p className="text-muted-foreground mt-4 text-xs">
          Shortcuts: <Kbd>C</Kbd> create · <Kbd>/</Kbd> search · <Kbd>R</Kbd>{" "}
          refresh · <Kbd>S</Kbd> SDK · <Kbd>D</Kbd> docs · <Kbd>Enter</Kbd>{" "}
          confirm in dialogs
        </p>
      </div>

      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createKey}
      />
      <EditKeyDialog
        row={editRow}
        onClose={() => setEditId(null)}
        onSave={(name) => {
          if (editId) {
            setKeys((prev) =>
              prev.map((key) => (key.id === editId ? { ...key, name } : key))
            );
          }
          setEditId(null);
        }}
      />
      <RotateKeyDialog
        row={rotateRow}
        onClose={() => setRotateId(null)}
        onRotate={rotateKey}
      />
      <DeleteKeysDialog
        ids={deleteIds}
        names={names}
        onClose={() => setDeleteIds(null)}
        onConfirm={removeKeys}
      />

      <div aria-live="polite" className="sr-only">
        {loading ? "Refreshing API keys." : ""}
      </div>
    </section>
  );
}
