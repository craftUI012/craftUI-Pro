"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarRadiusAxis,
  RadialBar,
  RadialBarChart,
  XAxis,
} from "recharts";

import { KitCard, StatRow } from "@/components/design-admin/kit-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChartConfig } from "@/components/ui/chart";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Frame 01 — finance kit
// ---------------------------------------------------------------------------

const contributionData = [
  { amount: 1600, month: "Dec" },
  { amount: 2200, month: "Jan" },
  { amount: 1800, month: "Feb" },
  { amount: 2600, month: "Mar" },
  { amount: 1500, month: "Apr" },
  { amount: 2800, month: "May" },
];

const contributionConfig = {
  amount: { color: "var(--chart-2)", label: "Contribution" },
} satisfies ChartConfig;

export const ContributionHistoryCard = () => (
  <KitCard
    title="Contribution History"
    description="Last 6 months of activity"
    footer={
      <Button variant="outline" className="w-full">
        View Full Report
      </Button>
    }
  >
    <div className="flex flex-col gap-4">
      <ChartContainer config={contributionConfig} className="aspect-auto h-44">
        <BarChart data={contributionData} margin={{ left: 0, right: 0 }}>
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="amount" fill="var(--color-amount)" radius={6} />
        </BarChart>
      </ChartContainer>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-muted/50 flex flex-col gap-1 rounded-lg p-3">
          <span
            className={cn(TYPE.cardEyebrow, "text-muted-foreground uppercase")}
          >
            Upcoming
          </span>
          <span className={cn(TYPE.cardMetric, "tabular-nums")}>
            May 25, 2024
          </span>
          <span
            className={cn(TYPE.cardBody, "text-muted-foreground tabular-nums")}
          >
            $1,000 scheduled
          </span>
        </div>
        <div className="bg-muted/50 flex flex-col gap-1 rounded-lg p-3">
          <span
            className={cn(TYPE.cardEyebrow, "text-muted-foreground uppercase")}
          >
            Auto-save plan
          </span>
          <span className={TYPE.cardMetric}>Accelerated</span>
          <span className={cn(TYPE.cardBody, "text-muted-foreground")}>
            Recurring weekly
          </span>
        </div>
      </div>
    </div>
  </KitCard>
);

const sparkConfig = {
  value: { color: "var(--chart-3)", label: "Payout" },
} satisfies ChartConfig;

const DividendSpark = ({ values }: { values: number[] }) => (
  <ChartContainer config={sparkConfig} className="aspect-auto h-8 w-24">
    <BarChart
      data={values.map((value, index) => ({ index, value }))}
      margin={{ bottom: 0, left: 0, right: 0, top: 0 }}
    >
      <Bar dataKey="value" fill="var(--color-value)" radius={2} />
    </BarChart>
  </ChartContainer>
);

const holdings = [
  {
    amount: "$1,842.10",
    name: "Vanguard VIG",
    shares: "450 Shares",
    values: [9, 10, 9.5, 14],
  },
  {
    amount: "$928.40",
    name: "S&P 500 VOO",
    shares: "112 Shares",
    values: [8, 9, 14, 10],
  },
  {
    amount: "$340.00",
    name: "Apple AAPL",
    shares: "85 Shares",
    values: [7, 8, 14, 11],
  },
  {
    amount: "$1,139.50",
    name: "Realty Income",
    shares: "320 Shares",
    values: [9, 10, 11, 14],
  },
];

export const DividendIncomeCard = () => (
  <KitCard
    title="Q2 Dividend Income"
    description="Quarterly dividend payouts across your portfolio holdings."
  >
    <div className="flex flex-col gap-2">
      {holdings.map((holding) => (
        <div
          key={holding.name}
          className="bg-muted/50 flex items-center justify-between gap-3 rounded-lg p-3"
        >
          <div className="flex min-w-0 flex-col">
            <span className={cn(TYPE.cardLabel, "truncate")}>
              {holding.name}
            </span>
            <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
              {holding.shares}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <DividendSpark values={holding.values} />
            <span
              className={cn(TYPE.cardLabel, "w-20 text-right tabular-nums")}
            >
              {holding.amount}
            </span>
          </div>
        </div>
      ))}
    </div>
  </KitCard>
);

const goalConfig = {
  saved: { color: "var(--primary)", label: "Saved" },
} satisfies ChartConfig;

export const GoalProgressCard = () => (
  <KitCard
    footer={
      <div className="flex w-full flex-col gap-3">
        <StatRow label="Projected Finish" value="October 2024" />
        <StatRow label="Monthly Average" value="$1,250" />
        <StatRow label="Top Contributor" value="Auto-Transfer" />
      </div>
    }
  >
    <ChartContainer config={goalConfig} className="mx-auto aspect-square h-52">
      <RadialBarChart
        data={[{ fill: "var(--color-saved)", saved: 80 }]}
        startAngle={90}
        endAngle={90 - 360 * 0.8}
        innerRadius={72}
        outerRadius={96}
      >
        <RadialBar
          dataKey="saved"
          background={{ fill: "var(--muted)" }}
          cornerRadius={12}
        />
        <PolarRadiusAxis tick={false} tickLine={false} axisLine={false}>
          <Label
            content={({ viewBox }) => {
              if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
                return null;
              }

              return (
                <text
                  x={viewBox.cx}
                  y={viewBox.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy}
                    className={cn(TYPE.cardMetric, "fill-foreground")}
                  >
                    $24,000
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 22}
                    className={cn(TYPE.cardCaption, "fill-muted-foreground")}
                  >
                    80% of $30,000
                  </tspan>
                </text>
              );
            }}
          />
        </PolarRadiusAxis>
      </RadialBarChart>
    </ChartContainer>
  </KitCard>
);

const yearlyData = [4, 6, 3.5, 7, 5, 5.5, 7.5, 4, 6, 8, 5, 9].map(
  (value, index) => ({
    month: "JFMAMJJASOND"[index],
    value,
  })
);

const yearlyConfig = {
  value: { color: "var(--chart-2)", label: "Spend" },
} satisfies ChartConfig;

export const CardBalanceCard = () => (
  <div className="flex flex-col gap-3">
    <div className="grid grid-cols-2 gap-3">
      <KitCard className="gap-2">
        <div className="flex flex-col gap-1">
          <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
            Card Balance
          </span>
          <span className={cn(TYPE.cardMetric, "tabular-nums")}>US$12.94</span>
          <span
            className={cn(
              TYPE.cardCaption,
              "text-muted-foreground tabular-nums"
            )}
          >
            US$11,337.06 Available
          </span>
        </div>
      </KitCard>
      <KitCard className="gap-2">
        <div className="flex flex-col gap-2">
          <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
            Payment Due
          </span>
          <span className={cn(TYPE.cardMetric, "tabular-nums")}>1 Apr</span>
          <Button size="sm" variant="secondary">
            Pay Early
          </Button>
        </div>
      </KitCard>
    </div>
    <KitCard
      title={
        <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
          Yearly Activity
        </span>
      }
      action={<Badge variant="secondary">+US$0.25 Daily Cash</Badge>}
      className="gap-2"
    >
      <ChartContainer config={yearlyConfig} className="aspect-auto h-24">
        <BarChart data={yearlyData} margin={{ left: 0, right: 0 }}>
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <Bar dataKey="value" fill="var(--color-value)" radius={3} />
        </BarChart>
      </ChartContainer>
    </KitCard>
  </div>
);

const powerData = [
  ["6a", 1.2],
  ["8a", 2.6],
  ["10a", 2.9],
  ["12p", 2.3],
  ["2p", 3.2],
  ["4p", 2.7],
  ["6p", 3.6],
  ["8p", 3],
].map(([hour, kw]) => ({ hour, kw }));

const powerConfig = {
  kw: { color: "var(--chart-2)", label: "kW" },
} satisfies ChartConfig;

export const PowerUsageCard = () => (
  <KitCard title="Power Usage" description="Whole Home">
    <div className="flex flex-col gap-4">
      <ChartContainer config={powerConfig} className="aspect-auto h-36">
        <BarChart data={powerData} margin={{ left: 0, right: 0 }}>
          <XAxis dataKey="hour" tickLine={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar dataKey="kw" fill="var(--color-kw)" radius={4} />
        </BarChart>
      </ChartContainer>
      <div className="grid grid-cols-2 gap-4 border-t pt-4">
        <div className="flex flex-col gap-1">
          <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
            Currently Using
          </span>
          <span className={cn(TYPE.cardMetric, "tabular-nums")}>3.4 kW</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
            Solar Gen
          </span>
          <span className={cn(TYPE.cardMetric, "tabular-nums")}>+1.2 kW</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t pt-4">
        <StatRow label="Battery Level" value="85%" />
        <Progress value={85} />
      </div>
    </div>
  </KitCard>
);

const stockData = [
  402, 398, 405, 401, 396, 403, 410, 407, 404, 412, 409, 415, 418, 414, 420,
].map((price, day) => ({ day, price }));

const stockConfig = {
  price: { color: "var(--chart-3)", label: "Price" },
} satisfies ChartConfig;

export const StockPerformanceCard = () => (
  <KitCard title="Stock Performance" description="6-month price history.">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span className={TYPE.cardLabel}>Ticker</span>
        <NativeSelect defaultValue="voo" className="w-full">
          <NativeSelectOption value="voo">VOO</NativeSelectOption>
          <NativeSelectOption value="vig">VIG</NativeSelectOption>
          <NativeSelectOption value="aapl">AAPL</NativeSelectOption>
        </NativeSelect>
      </div>
      <ChartContainer config={stockConfig} className="aspect-auto h-36">
        <LineChart data={stockData} margin={{ left: 4, right: 4 }}>
          <CartesianGrid vertical={false} />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent hideLabel />}
          />
          <Line
            dataKey="price"
            type="monotone"
            stroke="var(--color-price)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ChartContainer>
    </div>
  </KitCard>
);

// ---------------------------------------------------------------------------
// Frame 02 — app kit
// ---------------------------------------------------------------------------

const trafficData = [
  { desktop: 186, mobile: 80, month: "Jan" },
  { desktop: 305, mobile: 200, month: "Feb" },
  { desktop: 237, mobile: 120, month: "Mar" },
  { desktop: 73, mobile: 190, month: "Apr" },
  { desktop: 209, mobile: 130, month: "May" },
  { desktop: 214, mobile: 140, month: "Jun" },
];

const trafficConfig = {
  desktop: { color: "var(--chart-1)", label: "Desktop" },
  mobile: { color: "var(--chart-3)", label: "Mobile" },
} satisfies ChartConfig;

export const TrafficChannelsCard = () => (
  <KitCard
    title="Traffic channels"
    description="Monthly desktop and mobile traffic for the last six months."
    footer={
      <Button variant="outline" className="w-full">
        View report
      </Button>
    }
  >
    <div className="flex flex-col gap-4">
      <ChartContainer config={trafficConfig} className="aspect-auto h-44">
        <BarChart data={trafficData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="month"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
          />
          <ChartTooltip
            cursor={false}
            content={<ChartTooltipContent indicator="dashed" />}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
          <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
        </BarChart>
      </ChartContainer>
      <div className="grid grid-cols-3 text-center">
        {[
          ["Desktop", "1,224"],
          ["Mobile", "860"],
          ["Mix delta", "+42%"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span
              className={cn(
                TYPE.cardEyebrow,
                "text-muted-foreground uppercase"
              )}
            >
              {label}
            </span>
            <span className={cn(TYPE.cardLabel, "tabular-nums")}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  </KitCard>
);

const browserData = [
  { browser: "chrome", fill: "var(--color-chrome)", visitors: 420 },
  { browser: "edge", fill: "var(--color-edge)", visitors: 220 },
  { browser: "firefox", fill: "var(--color-firefox)", visitors: 180 },
  { browser: "safari", fill: "var(--color-safari)", visitors: 115 },
];

const browserConfig = {
  chrome: { color: "var(--chart-1)", label: "Chrome" },
  edge: { color: "var(--chart-2)", label: "Edge" },
  firefox: { color: "var(--chart-3)", label: "Firefox" },
  safari: { color: "var(--chart-4)", label: "Safari" },
  visitors: { label: "Visitors" },
} satisfies ChartConfig;

export const BrowserShareCard = () => (
  <KitCard
    title="Browser Share"
    description="January - June 2026"
    action={<Badge variant="outline">Firefox</Badge>}
    footer={
      <div className="flex w-full flex-col gap-2">
        <StatRow label="Firefox" value="31%" />
        <Progress value={31} />
      </div>
    }
  >
    <ChartContainer
      config={browserConfig}
      className="mx-auto aspect-square h-48"
    >
      <PieChart>
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent hideLabel />}
        />
        <Pie
          data={browserData}
          dataKey="visitors"
          nameKey="browser"
          innerRadius={58}
          strokeWidth={4}
          stroke="var(--card)"
        >
          <Label
            content={({ viewBox }) => {
              if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
                return null;
              }

              return (
                <text
                  x={viewBox.cx}
                  y={viewBox.cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  <tspan
                    x={viewBox.cx}
                    y={viewBox.cy}
                    className={cn(TYPE.cardMetric, "fill-foreground")}
                  >
                    935
                  </tspan>
                  <tspan
                    x={viewBox.cx}
                    y={(viewBox.cy ?? 0) + 20}
                    className={cn(TYPE.cardCaption, "fill-muted-foreground")}
                  >
                    Visitors
                  </tspan>
                </text>
              );
            }}
          />
        </Pie>
        <ChartLegend content={<ChartLegendContent nameKey="browser" />} />
      </PieChart>
    </ChartContainer>
  </KitCard>
);

const sleepData = [
  { deep: 2.1, light: 3.2, night: "Mon", rem: 1.2 },
  { deep: 1.8, light: 3.6, night: "Tue", rem: 1.5 },
  { deep: 2.4, light: 3.1, night: "Wed", rem: 1.1 },
  { deep: 1.6, light: 3.8, night: "Thu", rem: 1.4 },
  { deep: 2.2, light: 3.3, night: "Fri", rem: 1.6 },
  { deep: 2.5, light: 3.4, night: "Sat", rem: 1.3 },
  { deep: 2.2, light: 3.8, night: "Sun", rem: 1.4 },
];

const sleepConfig = {
  deep: { color: "var(--chart-4)", label: "Deep" },
  light: { color: "var(--chart-1)", label: "Light" },
  rem: { color: "var(--chart-2)", label: "REM" },
} satisfies ChartConfig;

export const SleepReportCard = () => (
  <KitCard
    title="Sleep Report"
    description="Last night · 7h 24m"
    footer={
      <div className="flex w-full items-center justify-between">
        <Badge variant="secondary">Good</Badge>
        <Button size="sm" variant="outline">
          Details
        </Button>
      </div>
    }
  >
    <div className="flex flex-col gap-4">
      <ChartContainer config={sleepConfig} className="aspect-auto h-32">
        <BarChart data={sleepData}>
          <XAxis dataKey="night" tickLine={false} axisLine={false} />
          <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
          <Bar
            dataKey="deep"
            stackId="a"
            fill="var(--color-deep)"
            radius={[0, 0, 4, 4]}
          />
          <Bar dataKey="rem" stackId="a" fill="var(--color-rem)" />
          <Bar
            dataKey="light"
            stackId="a"
            fill="var(--color-light)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
      <div className="grid grid-cols-4 text-center">
        {[
          ["2h 10m", "Deep"],
          ["3h 48m", "Light"],
          ["1h 26m", "REM"],
          ["84", "Score"],
        ].map(([value, label]) => (
          <div key={label} className="flex flex-col">
            <span className={cn(TYPE.cardLabel, "tabular-nums")}>{value}</span>
            <span className={cn(TYPE.cardCaption, "text-muted-foreground")}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  </KitCard>
);

const areaConfig = {
  visitors: { color: "var(--chart-2)", label: "Visitors" },
} satisfies ChartConfig;

const analyticsData = [42, 58, 51, 66, 55, 38, 47, 61, 64].map(
  (visitors, index) => ({ index, visitors })
);

export const AnalyticsCard = () => (
  <KitCard
    title="Analytics"
    description="418.2K Visitors +10%"
    action={
      <Button size="sm" variant="outline">
        View Analytics
      </Button>
    }
    contentClassName="px-0"
    className="pb-0"
  >
    <ChartContainer config={areaConfig} className="aspect-auto h-32 w-full">
      <AreaChart
        data={analyticsData}
        margin={{ bottom: 0, left: 0, right: 0, top: 4 }}
      >
        <Area
          dataKey="visitors"
          type="linear"
          fill="var(--color-visitors)"
          fillOpacity={0.3}
          stroke="var(--color-visitors)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  </KitCard>
);

const visitorsData = [
  { month: "Jan", visitors: 186 },
  { month: "Feb", visitors: 305 },
  { month: "Mar", visitors: 237 },
  { month: "Apr", visitors: 73 },
  { month: "May", visitors: 209 },
  { month: "Jun", visitors: 314 },
];

export const VisitorsCard = () => (
  <KitCard
    title="Visitors"
    description="Last 6 months"
    action={<Badge variant="outline">+2% vs last month</Badge>}
  >
    <ChartContainer config={areaConfig} className="aspect-auto h-44">
      <AreaChart data={visitorsData} margin={{ left: 8, right: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="line" />}
        />
        <Area
          dataKey="visitors"
          type="natural"
          fill="var(--color-visitors)"
          fillOpacity={0.15}
          stroke="var(--color-visitors)"
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  </KitCard>
);
