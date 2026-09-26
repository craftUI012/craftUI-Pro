"use client";

import {
  CircleCheck,
  CloudUpload,
  Copy,
  Ellipsis,
  Plus,
  Search,
  Server,
  UserPlus,
} from "lucide-react";
import * as React from "react";

import {
  AnalyticsCard,
  BrowserShareCard,
  SleepReportCard,
  TrafficChannelsCard,
  VisitorsCard,
} from "@/components/design-admin/chart-cards";
import {
  EmptyState,
  KitCard,
  StatRow,
} from "@/components/design-admin/kit-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

const Field = ({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  label: string;
}) => (
  <div className="flex flex-col gap-2">
    <Label htmlFor={htmlFor}>{label}</Label>
    {children}
  </div>
);

const RhythmCard = () => (
  <KitCard
    footer={
      <Button variant="outline" className="w-full">
        Share Feedback
      </Button>
    }
  >
    <div className="flex flex-col gap-3">
      <span className={cn(TYPE.cardEyebrow, "text-muted-foreground uppercase")}>
        Inherit · Geist
      </span>
      <h3 className={cn(TYPE.cardMetric, "text-balance")}>
        Designing with rhythm and hierarchy.
      </h3>
      <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
        A strong body style keeps long-form content readable and balances the
        visual weight of headings.
      </p>
      <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
        Thoughtful spacing and cadence help paragraphs scan quickly without
        feeling dense.
      </p>
    </div>
  </KitCard>
);

const CodespacesCard = () => (
  <KitCard
    footer={
      <p className={cn(TYPE.cardCaption, "text-muted-foreground")}>
        Codespace usage for this repository is paid for by shadcn.
      </p>
    }
  >
    <Tabs defaultValue="codespaces">
      <TabsList className="w-full">
        <TabsTrigger value="codespaces">Codespaces</TabsTrigger>
        <TabsTrigger value="local">Local</TabsTrigger>
      </TabsList>
      <TabsContent value="codespaces" className="flex flex-col gap-4 pt-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className={TYPE.cardLabel}>Codespaces</span>
            <span className={cn(TYPE.cardBody, "text-muted-foreground")}>
              Your workspaces in the cloud
            </span>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="New codespace">
              <Plus />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="More">
              <Ellipsis />
            </Button>
          </div>
        </div>
        <EmptyState
          icon={<Server />}
          title="No codespaces"
          description="You don't have any codespaces with this repository checked out"
          action={
            <div className="flex flex-col items-center gap-2">
              <Button size="sm">Create Codespace</Button>
              <Button
                variant="link"
                size="sm"
                className={cn(
                  TYPE.cardCaption,
                  "text-muted-foreground h-auto p-0"
                )}
              >
                Learn more about codespaces
              </Button>
            </div>
          }
        />
      </TabsContent>
      <TabsContent
        value="local"
        className={cn(TYPE.cardBody, "text-muted-foreground pt-2")}
      >
        Clone the repository to work locally.
      </TabsContent>
    </Tabs>
  </KitCard>
);

const invoiceItems = [
  { item: "Design System License", qty: 1, rate: 499 },
  { item: "Priority Support", qty: 12, rate: 99 },
  { item: "Custom Components", qty: 3, rate: 250 },
];

const currency = (value: number) =>
  value.toLocaleString("en-US", { currency: "USD", style: "currency" });

const InvoiceCard = () => {
  const subtotal = invoiceItems.reduce(
    (sum, row) => sum + row.qty * row.rate,
    0
  );

  return (
    <KitCard
      title="Invoice #INV-2847"
      description="Due March 30, 2026"
      action={<Badge variant="secondary">Pending</Badge>}
      footer={
        <div className="flex w-full justify-between">
          <Button size="sm" variant="outline">
            Download PDF
          </Button>
          <Button size="sm">Pay Now</Button>
        </div>
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoiceItems.map((row) => (
            <TableRow key={row.item}>
              <TableCell>{row.item}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.qty}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {currency(row.qty * row.rate)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={2}>Total Due</TableCell>
            <TableCell className="text-right tabular-nums">
              {currency(subtotal)}
            </TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </KitCard>
  );
};

const EnvVarsCard = () => (
  <KitCard
    title="Environment Variables"
    description="Production · 8 variables"
    footer={
      <div className="flex w-full justify-between">
        <Button size="sm" variant="outline">
          Edit
        </Button>
        <Button size="sm">Deploy</Button>
      </div>
    }
  >
    <div className="flex flex-col gap-2">
      {[
        ["DATABASE_URL", "••••••••"],
        ["NEXT_PUBLIC_API", "https://api.example.com"],
        ["STRIPE_SECRET", "••••••••"],
      ].map(([key, value]) => (
        <div
          key={key}
          className={cn(
            TYPE.cardCaption,
            "bg-muted/50 flex items-center justify-between gap-3 rounded-md px-3 py-2 font-mono"
          )}
        >
          <span>{key}</span>
          <span className="text-muted-foreground truncate">{value}</span>
        </div>
      ))}
    </div>
  </KitCard>
);

const InviteTeamCard = () => (
  <KitCard
    title="Invite Team"
    description="Add members to your workspace"
    footer={<Button className="w-full">Send Invites</Button>}
  >
    <div className="flex flex-col gap-3">
      {[
        ["alex@example.com", "editor"],
        ["sam@example.com", "viewer"],
      ].map(([email, role]) => (
        <div key={email} className="flex gap-2">
          <Input defaultValue={email} aria-label="Email" className="flex-1" />
          <NativeSelect defaultValue={role} aria-label="Role" className="w-28">
            <NativeSelectOption value="editor">Editor</NativeSelectOption>
            <NativeSelectOption value="viewer">Viewer</NativeSelectOption>
          </NativeSelect>
        </div>
      ))}
      <Button variant="outline" className="w-full">
        <Plus />
        Add another
      </Button>
      <Field label="Or share invite link" htmlFor="invite-link">
        <div className="flex gap-2">
          <Input
            id="invite-link"
            readOnly
            defaultValue="https://app.co/invite/x8f2k"
          />
          <Button variant="outline" size="icon" aria-label="Copy invite link">
            <Copy />
          </Button>
        </div>
      </Field>
    </div>
  </KitCard>
);

const AgentCard = () => (
  <KitCard
    title="Ship faster & safer with Code Agent"
    description="Your use is subject to the Public Beta Agreement and AI Product Terms."
    footer={
      <div className="flex w-full justify-end gap-2">
        <Button variant="outline">Cancel</Button>
        <Button>Enable with $100 credits</Button>
      </div>
    }
  >
    <div className="flex flex-col gap-3">
      {[
        "Code reviews with full codebase context to catch hard-to-find bugs.",
        "Code suggestions validated in sandboxes before you merge.",
        "Root-cause analysis for production issues with deployment context.",
      ].map((line) => (
        <div key={line} className={cn(TYPE.cardBody, "flex items-start gap-2")}>
          <CircleCheck className="text-primary mt-0.5 size-4 shrink-0" />
          <span className="text-muted-foreground text-pretty">{line}</span>
        </div>
      ))}
      <div
        className={cn(
          TYPE.cardBody,
          "bg-muted/50 text-muted-foreground rounded-lg p-3 text-pretty"
        )}
      >
        Pro teams get $100 in Code Agent trial credit for 2 weeks after
        activation.
      </div>
    </div>
  </KitCard>
);

const LoadingCard = () => (
  <KitCard>
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-1 flex-col gap-2">
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  </KitCard>
);

const initials = [
  "SC",
  "JD",
  "MK",
  "AL",
  "RP",
  "TN",
  "EV",
  "OB",
  "HW",
  "LG",
  "PK",
  "DM",
  "YS",
  "CF",
];

const NoTeamCard = () => (
  <KitCard>
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <div className="flex -space-x-2">
        {initials.slice(0, 3).map((name) => (
          <Avatar key={name} className="ring-card size-10 ring-2">
            <AvatarFallback>{name}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <div className="flex flex-col gap-1">
        <p className={TYPE.cardLabel}>No Team Members</p>
        <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
          Invite your team to collaborate on this project.
        </p>
      </div>
      <Button size="sm" variant="outline">
        <UserPlus />
        Invite Members
      </Button>
    </div>
  </KitCard>
);

const ReportBugCard = () => (
  <KitCard
    title="Report Bug"
    description="Help us fix issues faster."
    footer={
      <div className="flex w-full justify-end gap-2">
        <Button variant="outline">Attach File</Button>
        <Button>Submit Bug</Button>
      </div>
    }
  >
    <div className="flex flex-col gap-4">
      <Field label="Title" htmlFor="bug-title">
        <Input id="bug-title" placeholder="Brief description of the issue" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Severity" htmlFor="bug-severity">
          <NativeSelect
            id="bug-severity"
            defaultValue="medium"
            className="w-full"
          >
            <NativeSelectOption value="low">Low</NativeSelectOption>
            <NativeSelectOption value="medium">Medium</NativeSelectOption>
            <NativeSelectOption value="high">High</NativeSelectOption>
          </NativeSelect>
        </Field>
        <Field label="Component" htmlFor="bug-component">
          <NativeSelect
            id="bug-component"
            defaultValue="dashboard"
            className="w-full"
          >
            <NativeSelectOption value="dashboard">Dashboard</NativeSelectOption>
            <NativeSelectOption value="billing">Billing</NativeSelectOption>
          </NativeSelect>
        </Field>
      </div>
      <Field label="Steps to reproduce" htmlFor="bug-steps">
        <Textarea
          id="bug-steps"
          placeholder={"1. Go to\n2. Click on\n3. Observe…"}
        />
      </Field>
    </div>
  </KitCard>
);

const ContributorsCard = () => (
  <KitCard
    title="Contributors 312"
    footer={
      <Button variant="link" size="sm" className="h-auto p-0">
        + 810 contributors
      </Button>
    }
  >
    <div className="flex flex-wrap gap-2">
      {initials.map((name) => (
        <Avatar key={name} className="size-8">
          <AvatarFallback className={TYPE.cardCaption}>{name}</AvatarFallback>
        </Avatar>
      ))}
    </div>
  </KitCard>
);

const FeedbackCard = () => (
  <KitCard footer={<Button size="sm">Submit</Button>}>
    <div className="flex flex-col gap-4">
      <Field label="Topic" htmlFor="feedback-topic">
        <NativeSelect id="feedback-topic" defaultValue="" className="w-full">
          <NativeSelectOption value="" disabled>
            Select a topic
          </NativeSelectOption>
          <NativeSelectOption value="bug">Bug</NativeSelectOption>
          <NativeSelectOption value="idea">Idea</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="Feedback" htmlFor="feedback-body">
        <Textarea
          id="feedback-body"
          placeholder="Your feedback helps us improve…"
        />
      </Field>
    </div>
  </KitCard>
);

const BookAppointmentCard = () => (
  <KitCard
    title="Book Appointment"
    description="Dr. Sarah Chen · Cardiology"
    footer={<Button className="w-full">Book Appointment</Button>}
  >
    <div className="flex flex-col gap-3">
      <span className={TYPE.cardLabel}>Available on March 18, 2026</span>
      <ToggleGroup
        type="single"
        defaultValue="9:00"
        variant="outline"
        size="sm"
        className="w-full"
      >
        {["9:00", "10:30", "11:00", "1:30"].map((time) => (
          <ToggleGroupItem
            key={time}
            value={time}
            className="flex-1 tabular-nums"
          >
            {time} {time === "1:30" ? "PM" : "AM"}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-col gap-0.5 rounded-lg p-3 shadow-border">
        <span className={TYPE.cardLabel}>New patient?</span>
        <span className={cn(TYPE.cardBody, "text-muted-foreground")}>
          Please arrive 15 minutes early.
        </span>
      </div>
    </div>
  </KitCard>
);

const ProfileCard = () => (
  <KitCard
    title="Profile"
    description="Manage your profile information."
    footer={<Button size="sm">Save Profile</Button>}
  >
    <div className="flex flex-col gap-4">
      <Field label="Name" htmlFor="profile-name">
        <Input id="profile-name" defaultValue="shadcn" />
      </Field>
      <p
        className={cn(TYPE.cardBody, "text-muted-foreground -mt-2 text-pretty")}
      >
        Your name may appear around GitHub where you contribute or are
        mentioned. You can remove it at any time.
      </p>
      <Field label="Public Email" htmlFor="profile-email">
        <NativeSelect id="profile-email" defaultValue="m" className="w-full">
          <NativeSelectOption value="m">m@shadcn.com</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="Bio" htmlFor="profile-bio">
        <Textarea
          id="profile-bio"
          placeholder="Tell us a little bit about yourself"
        />
      </Field>
      <p className={cn(TYPE.cardBody, "text-muted-foreground -mt-2")}>
        You can @mention other users and organizations to link to them.
      </p>
    </div>
  </KitCard>
);

const WeeklyFitnessCard = () => (
  <KitCard
    title="Weekly Fitness Summary"
    description="Calories and workout load by day"
    footer={<Button className="w-full">View details</Button>}
  >
    <div className="grid grid-cols-7 gap-1.5">
      {[
        ["M", 70, 45],
        ["T", 55, 40],
        ["W", 80, 60],
        ["T", 60, 55],
        ["F", 90, 70],
        ["S", 45, 35],
        ["S", 75, 50],
      ].map(([day, total, load], index) => (
        <div
          key={`${day}-${index}`}
          className="flex flex-col items-center gap-1.5"
        >
          <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
            {day}
          </span>
          <div className="bg-muted relative flex h-20 w-full items-end overflow-hidden rounded-md">
            <div
              className="bg-chart-1/40 absolute inset-x-0 bottom-0"
              style={{ height: `${total}%` }}
            />
            <div
              className="bg-chart-2 relative w-full rounded-sm"
              style={{ height: `${load}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  </KitCard>
);

const FileUploadCard = () => (
  <KitCard title="File Upload" description="Drag and drop or browse">
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-6 text-center">
      <CloudUpload className="text-muted-foreground size-5" />
      <div className="flex flex-col gap-1">
        <span className={TYPE.cardLabel}>Upload files</span>
        <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
          PNG, JPG, PDF up to 10MB
        </span>
      </div>
      <Button size="sm" variant="outline">
        Browse Files
      </Button>
    </div>
  </KitCard>
);

const UsageCard = () => (
  <KitCard
    title={<span className={TYPE.cardBody}>5 days remaining in cycle</span>}
  >
    <div className="flex flex-col gap-3">
      {[
        ["Edge Requests", "$1.83K"],
        ["Fast Data Transfer", "$952.51"],
        ["Monitoring data points", "$901.20"],
        ["Web Analytics Events", "$603.71"],
        ["ISR Writes", "524.52K / 2M"],
        ["Function Duration", "5.11 GB Hrs / 1K GB Hrs"],
      ].map(([label, value]) => (
        <StatRow
          key={label}
          label={label}
          value={
            <span className={cn(TYPE.cardCaption, "font-mono")}>{value}</span>
          }
        />
      ))}
    </div>
  </KitCard>
);

const ShortcutsCard = () => (
  <KitCard title="Shortcuts">
    <div className="flex flex-col">
      {[
        ["Search", "K"],
        ["Quick Actions", "J"],
        ["New File", "N"],
        ["Save", "S"],
        ["Toggle Sidebar", "B"],
      ].map(([label, key]) => (
        <div
          key={label}
          className={cn(
            TYPE.cardBody,
            "flex items-center justify-between border-b py-2.5 last:border-b-0"
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          <KbdGroup>
            <Kbd>⌘</Kbd>
            <Kbd>{key}</Kbd>
          </KbdGroup>
        </div>
      ))}
    </div>
  </KitCard>
);

const AnomaliesCard = () => (
  <KitCard>
    <div className="flex flex-col items-center gap-3 py-4 text-center">
      <p className={TYPE.cardLabel}>Get alerted for anomalies</p>
      <p
        className={cn(
          TYPE.cardBody,
          "text-muted-foreground max-w-60 text-pretty"
        )}
      >
        Automatically monitor your projects for anomalies and get notified.
      </p>
      <Button size="sm">Upgrade to Observability Plus</Button>
    </div>
  </KitCard>
);

const waveform = Array.from({ length: 48 }, (_, index) =>
  Math.round(20 + 60 * Math.abs(Math.sin(index * 0.7) * Math.cos(index * 0.23)))
);

const LiveAudioCard = () => (
  <KitCard
    title="Live Audio Waveform"
    description="Real-time microphone input visualization with audio reactivity"
    footer={
      <ToggleGroup
        type="single"
        defaultValue="processing"
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="listening">Start Listening</ToggleGroupItem>
        <ToggleGroupItem value="processing">Stop Processing</ToggleGroupItem>
        <ToggleGroupItem value="static">Static</ToggleGroupItem>
      </ToggleGroup>
    }
  >
    <div className="flex h-12 items-center gap-[3px]">
      {waveform.map((height, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: static decorative bars
          key={index}
          className="bg-muted-foreground/60 w-full rounded-full"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  </KitCard>
);

const ActivityCard = () => (
  <KitCard
    title="Contributions & Activity"
    description="Manage your contributions and activity visibility."
    footer={<Button size="sm">Save Changes</Button>}
  >
    <div className="flex items-start gap-2">
      <Checkbox id="activity-private" />
      <div className="flex flex-col gap-1">
        <Label htmlFor="activity-private">
          Make profile private and hide activity
        </Label>
        <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
          Enabling this will hide your contributions and activity from your
          profile and from social features like followers, stars, feeds and
          releases.
        </p>
      </div>
    </div>
  </KitCard>
);

const NotFoundCard = () => (
  <KitCard>
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className={TYPE.cardLabel}>404 - Not Found</p>
      <p
        className={cn(
          TYPE.cardBody,
          "text-muted-foreground max-w-64 text-pretty"
        )}
      >
        The page you're looking for doesn't exist. Try searching for what you
        need below.
      </p>
      <div className="relative w-full max-w-60">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input placeholder="Try searching for pages…" className="pr-8 pl-8" />
        <Kbd className="absolute top-1/2 right-2 -translate-y-1/2">/</Kbd>
      </div>
      <Button variant="link" size="sm">
        Go to homepage
      </Button>
    </div>
  </KitCard>
);

// Order follows the Paper frame columns, top to bottom.
export const APP_CARDS: { id: string; Component: React.ComponentType }[] = [
  { Component: RhythmCard, id: "rhythm" },
  { Component: CodespacesCard, id: "codespaces" },
  { Component: InvoiceCard, id: "invoice" },
  { Component: EnvVarsCard, id: "env-vars" },
  { Component: TrafficChannelsCard, id: "traffic-channels" },
  { Component: InviteTeamCard, id: "invite-team" },
  { Component: AgentCard, id: "agent" },
  { Component: LoadingCard, id: "loading" },
  { Component: BrowserShareCard, id: "browser-share" },
  { Component: NoTeamCard, id: "no-team" },
  { Component: ReportBugCard, id: "report-bug" },
  { Component: ContributorsCard, id: "contributors" },
  { Component: FeedbackCard, id: "feedback" },
  { Component: BookAppointmentCard, id: "book-appointment" },
  { Component: SleepReportCard, id: "sleep-report" },
  { Component: ProfileCard, id: "profile" },
  { Component: WeeklyFitnessCard, id: "weekly-fitness" },
  { Component: FileUploadCard, id: "file-upload" },
  { Component: AnalyticsCard, id: "analytics" },
  { Component: UsageCard, id: "usage" },
  { Component: ShortcutsCard, id: "shortcuts" },
  { Component: AnomaliesCard, id: "anomalies" },
  { Component: LiveAudioCard, id: "live-audio" },
  { Component: VisitorsCard, id: "visitors" },
  { Component: ActivityCard, id: "activity" },
  { Component: NotFoundCard, id: "not-found" },
];
