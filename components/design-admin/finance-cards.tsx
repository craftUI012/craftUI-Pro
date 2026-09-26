"use client";

import {
  ArrowLeftRight,
  AtSign,
  Bell,
  BookOpen,
  Briefcase,
  Calculator,
  Car,
  ChartPie,
  ChevronRight,
  CircleAlert,
  CircleHelp,
  Coffee,
  CreditCard,
  EllipsisVertical,
  FileText,
  FolderOpen,
  Globe,
  ImageUp,
  Landmark,
  LayoutDashboard,
  Lightbulb,
  LoaderCircle,
  Lock,
  Mail,
  Music,
  Palette,
  Plus,
  QrCode,
  Search,
  Shield,
  ShoppingCart,
  Sun,
  Target,
  Thermometer,
  TrendingUp,
  Tv,
  User,
  Volume2,
  Wallet,
  X,
} from "lucide-react";
import * as React from "react";

import {
  CardBalanceCard,
  ContributionHistoryCard,
  DividendIncomeCard,
  GoalProgressCard,
  PowerUsageCard,
  StockPerformanceCard,
} from "@/components/design-admin/chart-cards";
import {
  EmptyState,
  KitCard,
  StatRow,
} from "@/components/design-admin/kit-card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

const CloseButton = () => (
  <Button
    variant="ghost"
    size="icon-sm"
    aria-label="Close"
    className="relative after:absolute after:-inset-1.5"
  >
    <X />
  </Button>
);

const Field = ({
  children,
  className,
  hint,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  hint?: React.ReactNode;
  htmlFor?: string;
  label: React.ReactNode;
}) => (
  <div className={cn("flex flex-col gap-2", className)}>
    <div className="flex items-center justify-between gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint}
    </div>
    {children}
  </div>
);

const DistributeTrackCard = () => (
  <KitCard>
    <EmptyState
      icon={<Plus />}
      title="Distribute Track"
      description="Upload your first master to start reaching listeners on Spotify, Apple Music, and more."
      action={<Button size="sm">Create Release</Button>}
    />
  </KitCard>
);

const ScanDeviceCard = () => (
  <KitCard
    footer={
      <Button variant="secondary" className="w-full">
        Got it
      </Button>
    }
  >
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex size-36 items-center justify-center rounded-xl bg-white text-black shadow-border">
        <QrCode className="size-28" strokeWidth={1.25} />
      </div>
      <div className="flex flex-col gap-1">
        <p className={cn(TYPE.cardHeader, "text-balance")}>
          Scan to connect your mobile device
        </p>
        <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
          Open the Ledger mobile app and scan this code to link your device.
        </p>
      </div>
    </div>
  </KitCard>
);

const DollarCostCard = () => (
  <KitCard
    title="Dollar-Cost Averaging"
    description="A strategy for building wealth over time."
  >
    <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
      Over time, this smooths out the average cost of your investments. When
      prices drop, your fixed amount buys more shares. When prices rise, you buy
      fewer. The result is a lower average cost per share compared to lump-sum
      investing during volatile periods.
    </p>
  </KitCard>
);

const SyncingCard = () => (
  <KitCard>
    <EmptyState
      icon={
        <LoaderCircle className="animate-spin motion-reduce:animate-none" />
      }
      title="Syncing your accounts"
      description="We're pulling in your latest transactions. This usually takes a few seconds."
      action={
        <Button size="sm" variant="outline">
          Cancel
        </Button>
      }
    />
  </KitCard>
);

const PayoutThresholdCard = () => {
  const [amount, setAmount] = React.useState([2500]);

  return (
    <KitCard
      title="Payout Threshold"
      description="Set the minimum balance required before a payout is triggered."
      action={<CloseButton />}
      footer={<Button className="w-full">Save Threshold</Button>}
    >
      <div className="flex flex-col gap-5">
        <Field label="Preferred Currency" htmlFor="payout-currency">
          <NativeSelect
            id="payout-currency"
            defaultValue="usd"
            className="w-full"
          >
            <NativeSelectOption value="usd">
              USD — United States Dollar
            </NativeSelectOption>
            <NativeSelectOption value="eur">EUR — Euro</NativeSelectOption>
            <NativeSelectOption value="gbp">
              GBP — British Pound
            </NativeSelectOption>
          </NativeSelect>
        </Field>
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <Label>Minimum Payout Amount</Label>
            <span className={cn(TYPE.cardMetric, "tabular-nums")}>
              ${amount[0].toLocaleString("en-US")}.00
            </span>
          </div>
          <Slider
            value={amount}
            onValueChange={setAmount}
            min={50}
            max={10_000}
            step={50}
          />
          <div
            className={cn(
              TYPE.cardCaption,
              "text-muted-foreground flex justify-between tabular-nums"
            )}
          >
            <span>$50 (MIN)</span>
            <span>$10,000 (MAX)</span>
          </div>
        </div>
        <Field label="Notes" htmlFor="payout-notes">
          <Textarea
            id="payout-notes"
            placeholder="Add any notes for this payout configuration…"
          />
        </Field>
      </div>
    </KitCard>
  );
};

const ClaimableBalanceCard = () => (
  <KitCard>
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
          Claimable Balance
        </span>
        <span className={cn(TYPE.cardMetricHero, "tabular-nums")}>$0.00</span>
        <Badge variant="secondary" className="gap-1.5">
          <span className="size-1.5 rounded-full bg-amber-500" />
          Pending Setup
        </Badge>
      </div>
      <div className="bg-muted/50 flex flex-col gap-3 rounded-lg p-3">
        <StatRow label="Net Royalties" value="$0.00" />
        <StatRow label="Processing Fee" value="-$0.00" />
        <StatRow
          label="Total Ready to Claim"
          value="$0.00 USD"
          className="border-t pt-3"
        />
      </div>
      <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
        Once your bank is connected, balances over $10.00 are automatically
        eligible for monthly distribution on the 15th of each month.
      </p>
    </div>
  </KitCard>
);

const SwitchRow = ({
  defaultChecked,
  description,
  id,
  label,
}: {
  defaultChecked?: boolean;
  description: string;
  id: string;
  label: string;
}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="flex flex-col gap-1">
      <Label htmlFor={id}>{label}</Label>
      <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
        {description}
      </p>
    </div>
    <Switch id={id} defaultChecked={defaultChecked} />
  </div>
);

const PreferencesCard = () => (
  <KitCard
    title="Preferences"
    description="Manage your account settings and notifications."
    action={<CloseButton />}
    footer={
      <div className="flex w-full justify-between">
        <Button variant="outline">Reset</Button>
        <Button>Save Preferences</Button>
      </div>
    }
  >
    <div className="flex flex-col gap-5">
      <Field label="Default Currency" htmlFor="pref-currency">
        <NativeSelect id="pref-currency" defaultValue="usd" className="w-full">
          <NativeSelectOption value="usd">
            USD — United States Dollar
          </NativeSelectOption>
          <NativeSelectOption value="eur">EUR — Euro</NativeSelectOption>
        </NativeSelect>
      </Field>
      <SwitchRow
        id="pref-public"
        label="Public Statistics"
        description="Allow others to see your total stream count and listening activity"
        defaultChecked
      />
      <SwitchRow
        id="pref-email"
        label="Email Notifications"
        description="Monthly royalty reports and distribution updates"
        defaultChecked
      />
    </div>
  </KitCard>
);

const LightSlider = ({
  defaultValue,
  icon,
  label,
}: {
  defaultValue: number;
  icon: React.ReactNode;
  label: string;
}) => (
  <div className="bg-muted/50 flex items-center gap-3 rounded-lg px-3 py-2.5">
    <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>
    <span className={cn(TYPE.cardBody, "w-24 shrink-0")}>{label}</span>
    <Slider defaultValue={[defaultValue]} max={100} aria-label={label} />
  </div>
);

const KitchenIslandCard = () => (
  <KitCard
    title="Kitchen Island"
    description="Hue Color Ambient"
    action={<Switch defaultChecked aria-label="Kitchen Island power" />}
  >
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        defaultValue="cooking"
        variant="outline"
        size="sm"
      >
        <ToggleGroupItem value="cooking">Cooking</ToggleGroupItem>
        <ToggleGroupItem value="dining">Dining</ToggleGroupItem>
        <ToggleGroupItem value="nightlight">Nightlight</ToggleGroupItem>
        <ToggleGroupItem value="focus">Focus</ToggleGroupItem>
      </ToggleGroup>
      <LightSlider icon={<Sun />} label="Brightness" defaultValue={85} />
      <LightSlider
        icon={<Thermometer />}
        label="Color Temp"
        defaultValue={62}
      />
      <LightSlider icon={<Volume2 />} label="Volume" defaultValue={30} />
      <LightSlider icon={<Lightbulb />} label="Fade" defaultValue={0} />
    </div>
  </KitCard>
);

const SavingsTargetsCard = () => (
  <KitCard
    title="Savings Targets"
    description="Active milestones for 2024"
    action={
      <Button size="sm" variant="outline">
        New Goal
      </Button>
    }
    footer={
      <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
        You have not met your targets for this year.
      </p>
    }
  >
    <div className="flex flex-col gap-3">
      {[
        { goal: "$420,000", label: "Retirement", saved: "$273,000", value: 65 },
        { goal: "$85,000", label: "Real Estate", saved: "$27,200", value: 32 },
      ].map((target) => (
        <div
          key={target.label}
          className="bg-muted/50 flex flex-col gap-3 rounded-lg p-3"
        >
          <span
            className={cn(TYPE.cardEyebrow, "text-muted-foreground uppercase")}
          >
            {target.label}
          </span>
          <span className={cn(TYPE.cardMetric, "tabular-nums")}>
            {target.goal}
          </span>
          <Progress value={target.value} />
          <div
            className={cn(
              TYPE.cardBody,
              "text-muted-foreground flex justify-between tabular-nums"
            )}
          >
            <span>{target.value}% achieved</span>
            <span className="text-foreground font-medium">{target.saved}</span>
          </div>
        </div>
      ))}
    </div>
  </KitCard>
);

const transactions = [
  {
    amount: "-$6.50",
    category: "Food & Drink",
    icon: Coffee,
    name: "Blue Bottle Coffee",
    when: "Today, 10:24 AM",
  },
  {
    amount: "-$142.30",
    category: "Groceries",
    icon: ShoppingCart,
    name: "Whole Foods Market",
    when: "Yesterday",
  },
  {
    amount: "+$4,200.00",
    category: "Income",
    icon: Briefcase,
    name: "Stripe Payout",
    when: "Oct 12",
  },
  {
    amount: "-$24.10",
    category: "Transport",
    icon: Car,
    name: "Uber Technologies",
    when: "Oct 11",
  },
  {
    amount: "-$19.99",
    category: "Entertainment",
    icon: Tv,
    name: "Netflix Subscription",
    when: "Oct 10",
  },
];

const RecentTransactionsCard = () => (
  <KitCard
    title="Recent Transactions"
    description="Your latest account activity."
    action={
      <Button size="sm" variant="outline">
        View All
      </Button>
    }
  >
    <div className="flex flex-col">
      {transactions.map((tx) => (
        <div
          key={tx.name}
          className="flex items-center gap-3 border-b py-3 last:border-b-0"
        >
          <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-md">
            <tx.icon className="size-4" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={cn(TYPE.cardLabel, "truncate")}>{tx.name}</span>
            <span
              className={cn(TYPE.cardCaption, "text-muted-foreground truncate")}
            >
              {tx.category} · {tx.when}
            </span>
          </div>
          <span
            className={cn(
              TYPE.cardLabel,
              "shrink-0 text-right tabular-nums",
              tx.amount.startsWith("+") &&
                "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {tx.amount}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`More for ${tx.name}`}
          >
            <EllipsisVertical />
          </Button>
        </div>
      ))}
    </div>
  </KitCard>
);

const NavGroup = ({
  active,
  items,
  title,
}: {
  active?: string;
  items: { icon: React.ElementType; label: string }[];
  title: string;
}) => (
  <div className="flex flex-col gap-0.5">
    <span className={cn(TYPE.cardCaption, "text-muted-foreground px-2 pb-1")}>
      {title}
    </span>
    {items.map((item) => (
      <button
        key={item.label}
        type="button"
        data-active={item.label === active}
        className={cn(
          TYPE.cardBody,
          "hover:bg-accent data-[active=true]:bg-accent flex h-8 items-center gap-2 rounded-md px-2 text-left transition-colors [&_svg]:size-4"
        )}
      >
        <item.icon />
        {item.label}
      </button>
    ))}
  </div>
);

const NavigationCard = () => (
  <div className="grid grid-cols-2 gap-3">
    <Card className="gap-4 p-2">
      <NavGroup
        title="Overview"
        active="Dashboard"
        items={[
          { icon: LayoutDashboard, label: "Dashboard" },
          { icon: ArrowLeftRight, label: "Transactions" },
          { icon: TrendingUp, label: "Investments" },
          { icon: Wallet, label: "Accounts" },
          { icon: ChartPie, label: "Spending" },
        ]}
      />
      <NavGroup
        title="Planning"
        items={[
          { icon: Target, label: "Goals" },
          { icon: Calculator, label: "Budget" },
          { icon: FileText, label: "Reports" },
          { icon: FolderOpen, label: "Documents" },
        ]}
      />
    </Card>
    <Card className="gap-4 p-2">
      <NavGroup
        title="Account"
        active="Billing"
        items={[
          { icon: User, label: "Profile" },
          { icon: CreditCard, label: "Billing" },
          { icon: Bell, label: "Notifications" },
          { icon: Shield, label: "Security" },
          { icon: Palette, label: "Appearance" },
        ]}
      />
      <NavGroup
        title="Support"
        items={[
          { icon: CircleHelp, label: "Help Center" },
          { icon: Mail, label: "Contact Us" },
          { icon: BookOpen, label: "Documentation" },
        ]}
      />
    </Card>
  </div>
);

const FaqCard = () => (
  <KitCard
    footer={
      <Button variant="outline" className="w-full">
        Contact Support
      </Button>
    }
  >
    <div className="flex flex-col gap-2">
      <Tabs defaultValue="general">
        <TabsList className="w-full">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
        </TabsList>
      </Tabs>
      <Accordion type="single" collapsible defaultValue="security">
        <AccordionItem value="security">
          <AccordionTrigger>
            How secure is my financial data with Ledger?
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-pretty">
            We use bank-level AES-256 encryption, SOC 2 Type II certified
            infrastructure, and never store your credentials. All connections
            use read-only access tokens.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="connect">
          <AccordionTrigger>
            How do I connect my bank or investment accounts?
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            Head to Accounts and choose Connect. Most institutions link in under
            a minute.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="export">
          <AccordionTrigger>
            Can I export my data for tax purposes?
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground">
            Yes — Reports → Export gives you CSV and PDF statements per tax
            year.
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  </KitCard>
);

const positions = [
  {
    kind: "ETF",
    name: "Vanguard S&P 500 ETF",
    since: "112 SHARES · JAN 2021",
    ticker: "VOO",
    value: "$48,230.40",
  },
  {
    kind: "ETF",
    name: "Vanguard Dividend Appreciation",
    since: "450 SHARES · MAR 2022",
    ticker: "VIG",
    value: "$26,033.79",
  },
  {
    kind: "Stock",
    name: "Apple Inc.",
    since: "85 SHARES · NOV 2020",
    ticker: "AAPL",
    value: "$18,488.90",
  },
  {
    kind: "REIT",
    name: "Realty Income Corp",
    since: "320 SHARES · JUN 2023",
    ticker: "O",
    value: "$15,136.59",
  },
];

const HoldingsCard = () => (
  <KitCard>
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input placeholder="Search holdings or tickers…" className="pl-8" />
        </div>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          defaultValue={["etfs"]}
        >
          <ToggleGroupItem value="stocks">Stocks</ToggleGroupItem>
          <ToggleGroupItem value="etfs">ETFs</ToggleGroupItem>
          <ToggleGroupItem value="reits">REITs</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {positions.map((position) => (
        <div
          key={position.ticker}
          className="bg-muted/50 flex items-center gap-3 rounded-lg p-3"
        >
          <div
            className={cn(
              TYPE.cardCaption,
              "bg-background flex size-10 shrink-0 items-center justify-center rounded-md shadow-border"
            )}
          >
            {position.ticker}
          </div>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className={cn(TYPE.cardLabel, "truncate")}>
              {position.name}
            </span>
            <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
              {position.since}
            </span>
          </div>
          <Badge variant="outline">{position.kind}</Badge>
          <div className="flex w-24 flex-col items-end">
            <span
              className={cn(
                TYPE.cardEyebrow,
                "text-muted-foreground uppercase"
              )}
            >
              Value
            </span>
            <span className={cn(TYPE.cardLabel, "tabular-nums")}>
              {position.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  </KitCard>
);

const BuyInvestmentCard = () => (
  <KitCard
    title="Buy Investment"
    footer={
      <div className="flex w-full flex-col gap-3 text-center">
        <Button className="w-full">Review Order</Button>
        <p className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}>
          Trades are typically executed within minutes during market hours.
        </p>
      </div>
    }
  >
    <div className="flex flex-col gap-4">
      <Field label="Amount to Invest" htmlFor="buy-amount">
        <Input
          id="buy-amount"
          defaultValue="$ 1,000.00"
          className="tabular-nums"
        />
      </Field>
      <Field label="Order Type" htmlFor="buy-order">
        <NativeSelect id="buy-order" defaultValue="market" className="w-full">
          <NativeSelectOption value="market">Market Order</NativeSelectOption>
          <NativeSelectOption value="limit">Limit Order</NativeSelectOption>
        </NativeSelect>
      </Field>
      <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
        Market orders execute at the current price.
      </p>
      <div className="flex flex-col gap-2">
        <StatRow label="Estimated Shares" value="1.95" />
        <StatRow label="Buying Power" value="$12,450.00" />
      </div>
    </div>
  </KitCard>
);

const PaymentsListCard = () => (
  <KitCard>
    <div className="flex flex-col gap-3">
      <nav
        aria-label="Breadcrumb"
        className={cn(
          TYPE.cardBody,
          "text-muted-foreground flex items-center gap-2"
        )}
      >
        <span>Home</span>
        <ChevronRight className="size-3.5" />
        <span>…</span>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground">Payments</span>
      </nav>
      {[
        [
          "Change transfer limit",
          "Adjust how much you can send from your balance.",
        ],
        ["Scheduled transfers", "Set up a transfer to send at a later date."],
        ["Direct Debits", "Set up and manage regular payments."],
        ["Recurring card payments", "Manage your repeated card transactions."],
      ].map(([title, description]) => (
        <button
          key={title}
          type="button"
          className="hover:bg-accent/60 flex items-center gap-3 rounded-lg p-3 text-left shadow-border transition-[background-color,box-shadow] hover:shadow-border-hover"
        >
          <ArrowLeftRight className="text-muted-foreground size-4 shrink-0 self-start mt-0.5" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className={TYPE.cardLabel}>{title}</span>
            <span
              className={cn(TYPE.cardBody, "text-muted-foreground text-pretty")}
            >
              {description}
            </span>
          </span>
          <ChevronRight className="text-muted-foreground size-4 shrink-0" />
        </button>
      ))}
    </div>
  </KitCard>
);

const FrontDoorCard = () => (
  <KitCard
    title="Front Door"
    description="Smart Lock Pro"
    action={
      <span
        className={cn(
          TYPE.cardBody,
          "text-muted-foreground flex items-center gap-1.5"
        )}
      >
        Locked <Lock className="size-3.5" />
      </span>
    }
  >
    <div className="bg-muted relative flex aspect-video items-start justify-end rounded-lg p-2">
      <Badge variant="destructive">Live</Badge>
    </div>
  </KitCard>
);

const AccountAccessCard = () => (
  <KitCard
    title="Account Access"
    description="Update your credentials or re-authenticate."
  >
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <Field label="Email Address" htmlFor="access-email">
        <Input
          id="access-email"
          type="email"
          autoComplete="username"
          defaultValue="artist@studio.inc"
        />
      </Field>
      <Field
        label="Current Password"
        htmlFor="access-password"
        hint={
          <Button
            type="button"
            variant="link"
            size="sm"
            className={cn(
              TYPE.cardEyebrow,
              "text-muted-foreground h-auto p-0 uppercase"
            )}
          >
            Forgot?
          </Button>
        }
      >
        <Input
          id="access-password"
          type="password"
          autoComplete="current-password"
          defaultValue="supersecret"
        />
      </Field>
      <Button type="submit" className="w-full">
        <Lock />
        Update Security
      </Button>
      <button
        type="button"
        className="flex items-center gap-3 rounded-lg p-3 text-left shadow-border transition-[box-shadow] hover:shadow-border-hover"
      >
        <CircleAlert className="text-destructive size-4 shrink-0 self-start mt-0.5" />
        <span className="flex flex-1 flex-col gap-0.5">
          <span className={TYPE.cardLabel}>Danger Zone</span>
          <span className={cn(TYPE.cardBody, "text-muted-foreground")}>
            Archive account and remove catalog
          </span>
        </span>
        <ChevronRight className="text-muted-foreground size-4" />
      </button>
    </form>
  </KitCard>
);

const TransferFundsCard = () => (
  <KitCard
    title="Transfer Funds"
    description="Move money between your connected accounts."
    action={<CloseButton />}
    footer={<Button className="w-full">Confirm Transfer</Button>}
  >
    <div className="flex flex-col gap-4">
      <Field label="Amount to Transfer" htmlFor="transfer-amount">
        <Input
          id="transfer-amount"
          defaultValue="$ 1,200.00"
          className="tabular-nums"
        />
      </Field>
      <Field label="From Account" htmlFor="transfer-from">
        <NativeSelect id="transfer-from" className="w-full">
          <NativeSelectOption>
            Main Checking (-8402) — $12,450.00
          </NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field label="To Account" htmlFor="transfer-to">
        <NativeSelect id="transfer-to" className="w-full">
          <NativeSelectOption>
            High Yield Savings (-1192) — $42,100.00
          </NativeSelectOption>
        </NativeSelect>
      </Field>
      <div className="bg-muted/50 flex flex-col gap-3 rounded-lg p-3">
        <StatRow label="Estimated arrival" value="Today, Apr 14" />
        <StatRow label="Transaction fee" value="$0.00" />
        <StatRow
          label="Total amount"
          value="$1,200.00"
          className="border-t pt-3"
        />
      </div>
    </div>
  </KitCard>
);

const CoverArtCard = () => (
  <KitCard
    footer={
      <div className="flex w-full flex-col items-center gap-2">
        <Button variant="secondary" className="w-full">
          Upload Artwork
        </Button>
        <p
          className={cn(
            TYPE.cardCaption,
            "text-muted-foreground text-center text-pretty"
          )}
        >
          Minimum 3000 × 3000px · JPEG or PNG only
        </p>
      </div>
    }
  >
    <div className="flex flex-col gap-3">
      <span
        className={cn(
          TYPE.cardEyebrow,
          "text-muted-foreground text-center uppercase"
        )}
      >
        Cover Art
      </span>
      <div className="bg-muted/50 text-muted-foreground flex aspect-square items-center justify-center rounded-lg outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
        <ImageUp className="size-8" strokeWidth={1.5} />
      </div>
    </div>
  </KitCard>
);

const SkeletonCard = () => (
  <KitCard>
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-8" />
        <Skeleton className="h-8" />
      </div>
    </div>
  </KitCard>
);

const ReceivingMethodCard = () => (
  <KitCard
    title="Receiving Method"
    description="Payout Preferences"
    action={<CloseButton />}
    footer={<Button className="w-full">Save Payout Settings</Button>}
  >
    <div className="flex flex-col gap-4">
      <Field label="Account Holder Name" htmlFor="rm-holder">
        <Input id="rm-holder" defaultValue="Synthetic Horizons Music LLC" />
      </Field>
      <div className="flex flex-col gap-2">
        <Label>Receiving Method</Label>
        <RadioGroup defaultValue="bank" className="grid grid-cols-2 gap-2">
          {[
            { hint: "SWIFT / IBAN", label: "Bank Transfer", value: "bank" },
            { hint: "Instant Payout", label: "PayPal", value: "paypal" },
          ].map((option) => (
            <Label
              key={option.value}
              htmlFor={`rm-${option.value}`}
              className="has-data-[state=checked]:shadow-border-hover has-data-[state=checked]:bg-accent/50 flex cursor-pointer items-start gap-2 rounded-lg p-3 font-normal shadow-border transition-[background-color,box-shadow]"
            >
              <RadioGroupItem
                id={`rm-${option.value}`}
                value={option.value}
                className="mt-0.5"
              />
              <span className="flex flex-col gap-0.5">
                <span className={TYPE.cardLabel}>{option.label}</span>
                <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
                  {option.hint}
                </span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </div>
      <Field label="IBAN / Account Number" htmlFor="rm-iban">
        <Input id="rm-iban" placeholder="DE89 3704 0044 …" />
      </Field>
    </div>
  </KitCard>
);

const ConnectBankCard = () => (
  <KitCard>
    <EmptyState
      icon={<Landmark />}
      title="Connect Bank"
      description="Link your payout method to receive monthly royalty distributions automatically."
      action={
        <Button size="sm" variant="outline">
          Set Up Payouts
        </Button>
      }
    />
  </KitCard>
);

const UpcomingPaymentsCard = () => {
  const [date, setDate] = React.useState<Date | undefined>(
    new Date(2026, 8, 26)
  );

  return (
    <KitCard
      title="Upcoming Payments"
      description="Select a date to view scheduled payments."
    >
      <div className="flex flex-col gap-3">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          defaultMonth={new Date(2026, 8, 1)}
          className="w-full rounded-lg p-0 [--cell-size:--spacing(9)]"
        />
        {[
          ["Netflix Subscription", "Apr 15, 2024", "$19.99"],
          ["Rent Payment", "Apr 1, 2024", "$2,400.00"],
          ["Auto Insurance", "Apr 22, 2024", "$186.00"],
        ].map(([name, when, amount]) => (
          <div
            key={name}
            className="bg-muted/50 flex items-center justify-between rounded-lg p-3"
          >
            <div className="flex flex-col">
              <span className={TYPE.cardLabel}>{name}</span>
              <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
                {when}
              </span>
            </div>
            <span className={cn(TYPE.cardLabel, "tabular-nums")}>{amount}</span>
          </div>
        ))}
      </div>
    </KitCard>
  );
};

const LivingRoomCard = () => (
  <KitCard
    title="Living Room"
    description="Roller Shades"
    footer={
      <ToggleGroup
        type="single"
        defaultValue="half"
        variant="outline"
        className="w-full"
      >
        <ToggleGroupItem value="open" className="flex-1">
          Open
        </ToggleGroupItem>
        <ToggleGroupItem value="half" className="flex-1">
          Half
        </ToggleGroupItem>
        <ToggleGroupItem value="closed" className="flex-1">
          Closed
        </ToggleGroupItem>
      </ToggleGroup>
    }
  >
    <div className="flex flex-col gap-4">
      <div className="bg-muted relative aspect-[5/3] overflow-hidden rounded-lg">
        <div className="bg-muted-foreground/40 absolute inset-x-0 top-0 h-1/2" />
      </div>
      <div
        className={cn(
          TYPE.cardEyebrow,
          "text-muted-foreground flex items-center gap-3 uppercase"
        )}
      >
        <span>Open</span>
        <Slider defaultValue={[50]} max={100} aria-label="Shade position" />
        <span>Close</span>
      </div>
    </div>
  </KitCard>
);

const ExploreCatalogCard = () => (
  <KitCard>
    <EmptyState
      icon={<Music />}
      title="Explore Catalog"
      description="Check your ISRC codes, metadata, and visual assets before going live."
      action={
        <Button size="sm" variant="outline">
          View Catalog
        </Button>
      }
    />
  </KitCard>
);

const MilestoneCard = () => (
  <KitCard
    title="Set a new milestone"
    description="Define your financial target and we'll help you pace your savings."
    footer={
      <div className="flex w-full flex-col gap-2">
        <Button className="w-full">Create Goal</Button>
        <Button variant="outline" className="w-full">
          Cancel
        </Button>
      </div>
    }
  >
    <div className="flex flex-col gap-4">
      <Field label="Goal Name" htmlFor="goal-name">
        <Input id="goal-name" placeholder="e.g. New Car, Home Downpayment" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Target Amount" htmlFor="goal-amount">
          <Input
            id="goal-amount"
            defaultValue="$15,000"
            className="tabular-nums"
          />
        </Field>
        <Field label="Target Date" htmlFor="goal-date">
          <Input id="goal-date" defaultValue="Dec 2025" />
        </Field>
      </div>
    </div>
  </KitCard>
);

const IconInput = ({
  defaultValue,
  icon,
  id,
  placeholder,
}: {
  defaultValue?: string;
  icon: React.ReactNode;
  id: string;
  placeholder?: string;
}) => (
  <div className="relative">
    <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 [&_svg]:size-4">
      {icon}
    </span>
    <Input
      id={id}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="pl-8"
    />
  </div>
);

const SocialLinksCard = () => (
  <KitCard
    title="Social Links"
    footer={
      <div className="flex w-full justify-end gap-2">
        <Button variant="ghost">Discard</Button>
        <Button>Save Changes</Button>
      </div>
    }
  >
    <div className="flex flex-col gap-4">
      <Field label="Spotify Artist URL" htmlFor="social-spotify">
        <IconInput
          id="social-spotify"
          icon={<Music />}
          defaultValue="spotify.com/artist/3j…2k"
        />
      </Field>
      <Field label="Instagram Handle" htmlFor="social-ig">
        <IconInput
          id="social-ig"
          icon={<AtSign />}
          defaultValue="@juliandurya_music"
        />
      </Field>
      <Field label="SoundCloud URL" htmlFor="social-sc">
        <IconInput
          id="social-sc"
          icon={<Music />}
          placeholder="soundcloud.com/username"
        />
      </Field>
      <Field label="Website" htmlFor="social-web">
        <IconInput
          id="social-web"
          icon={<Globe />}
          placeholder="https://yoursite.com"
        />
      </Field>
    </div>
  </KitCard>
);

const notificationOptions = [
  {
    checked: true,
    description: "Deposits, withdrawals, and transfers.",
    id: "tx",
    label: "Transaction alerts",
  },
  {
    checked: true,
    description: "Login attempts and account changes.",
    id: "security",
    label: "Security alerts",
  },
  {
    checked: false,
    description: "Updates at 25%, 50%, 75%, and 100%.",
    id: "goals",
    label: "Goal milestones",
  },
  {
    checked: false,
    description: "Daily portfolio summary and price alerts.",
    id: "market",
    label: "Market updates",
  },
];

const NotificationsCard = () => {
  const [checked, setChecked] = React.useState<Record<string, boolean>>(
    Object.fromEntries(notificationOptions.map((o) => [o.id, o.checked]))
  );
  const values = Object.values(checked);
  let selectAll: boolean | "indeterminate" = values.some(Boolean)
    ? "indeterminate"
    : false;

  if (values.every(Boolean)) {
    selectAll = true;
  }

  return (
    <KitCard
      title="Notifications"
      description="Choose what you want to be notified about."
      footer={<Button className="w-full">Save Preferences</Button>}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="notify-all"
            checked={selectAll}
            onCheckedChange={(value) =>
              setChecked(
                Object.fromEntries(
                  notificationOptions.map((o) => [o.id, value === true])
                )
              )
            }
          />
          <Label htmlFor="notify-all">Select all</Label>
        </div>
        {notificationOptions.map((option) => (
          <div key={option.id} className="flex items-start gap-2">
            <Checkbox
              id={`notify-${option.id}`}
              checked={checked[option.id]}
              onCheckedChange={(value) =>
                setChecked((prev) => ({ ...prev, [option.id]: value === true }))
              }
            />
            <div className="flex flex-col gap-1">
              <Label htmlFor={`notify-${option.id}`}>{option.label}</Label>
              <p className={cn(TYPE.cardBody, "text-muted-foreground")}>
                {option.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </KitCard>
  );
};

// Order follows the Paper frame columns, top to bottom.
export const FINANCE_CARDS: { id: string; Component: React.ComponentType }[] = [
  { Component: ContributionHistoryCard, id: "contribution-history" },
  { Component: DistributeTrackCard, id: "distribute-track" },
  { Component: ScanDeviceCard, id: "scan-device" },
  { Component: DividendIncomeCard, id: "dividend-income" },
  { Component: DollarCostCard, id: "dollar-cost" },
  { Component: SyncingCard, id: "syncing" },
  { Component: PayoutThresholdCard, id: "payout-threshold" },
  { Component: ClaimableBalanceCard, id: "claimable-balance" },
  { Component: PreferencesCard, id: "preferences" },
  { Component: GoalProgressCard, id: "goal-progress" },
  { Component: KitchenIslandCard, id: "kitchen-island" },
  { Component: SavingsTargetsCard, id: "savings-targets" },
  { Component: RecentTransactionsCard, id: "recent-transactions" },
  { Component: NavigationCard, id: "navigation" },
  { Component: FaqCard, id: "faq" },
  { Component: HoldingsCard, id: "holdings" },
  { Component: BuyInvestmentCard, id: "buy-investment" },
  { Component: PaymentsListCard, id: "payments-list" },
  { Component: FrontDoorCard, id: "front-door" },
  { Component: AccountAccessCard, id: "account-access" },
  { Component: CardBalanceCard, id: "card-balance" },
  { Component: TransferFundsCard, id: "transfer-funds" },
  { Component: CoverArtCard, id: "cover-art" },
  { Component: SkeletonCard, id: "skeleton" },
  { Component: ReceivingMethodCard, id: "receiving-method" },
  { Component: PowerUsageCard, id: "power-usage" },
  { Component: ConnectBankCard, id: "connect-bank" },
  { Component: UpcomingPaymentsCard, id: "upcoming-payments" },
  { Component: LivingRoomCard, id: "living-room" },
  { Component: StockPerformanceCard, id: "stock-performance" },
  { Component: ExploreCatalogCard, id: "explore-catalog" },
  { Component: MilestoneCard, id: "milestone" },
  { Component: SocialLinksCard, id: "social-links" },
  { Component: NotificationsCard, id: "notifications" },
];
