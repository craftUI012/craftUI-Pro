"use client";

import { Bar, BarChart, XAxis } from "recharts";

import { Button } from "@/components/ui/button";
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer } from "@/components/ui/chart";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TYPE } from "@/constants/typography";
import { cn } from "@/lib/utils";

// One small, real-size example per strip tile. Each fits the 12rem piece
// width in strip-tile.tsx and uses only the component it names (plus Label),
// so the tile shows the piece itself, not a whole block shrunk to fit.

const labelClass = cn(TYPE.cardLabel, "font-normal");

const ButtonPiece = () => (
  <div className="flex flex-col gap-2">
    <Button>Send invite</Button>
    <Button variant="outline">Cancel</Button>
  </div>
);

const InputPiece = () => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="strip-input" className={labelClass}>
      Email
    </Label>
    <Input id="strip-input" type="email" placeholder="name@example.com" />
  </div>
);

const SelectPiece = () => (
  <div className="flex flex-col gap-2">
    <Label htmlFor="strip-select" className={labelClass}>
      Role
    </Label>
    <NativeSelect id="strip-select" defaultValue="editor" className="w-48">
      <NativeSelectOption value="viewer">Viewer</NativeSelectOption>
      <NativeSelectOption value="editor">Editor</NativeSelectOption>
      <NativeSelectOption value="admin">Admin</NativeSelectOption>
    </NativeSelect>
  </div>
);

const SWITCHES = [
  { checked: true, id: "strip-switch-email", label: "Email alerts" },
  { checked: false, id: "strip-switch-push", label: "Push alerts" },
] as const;

const SwitchPiece = () => (
  <div className="flex flex-col gap-3">
    {SWITCHES.map((item) => (
      <div key={item.id} className="flex items-center justify-between gap-3">
        <Label htmlFor={item.id} className={labelClass}>
          {item.label}
        </Label>
        <Switch id={item.id} defaultChecked={item.checked} />
      </div>
    ))}
  </div>
);

const SliderPiece = () => (
  <div className="flex flex-col gap-3">
    <Label id="strip-slider-label" className={labelClass}>
      Brightness
    </Label>
    <Slider
      defaultValue={[70]}
      max={100}
      aria-labelledby="strip-slider-label"
    />
  </div>
);

const ToggleGroupPiece = () => (
  <ToggleGroup
    type="single"
    defaultValue="week"
    variant="outline"
    size="sm"
    aria-label="Date range"
    className="w-full"
  >
    <ToggleGroupItem value="day">Day</ToggleGroupItem>
    <ToggleGroupItem value="week">Week</ToggleGroupItem>
    <ToggleGroupItem value="month">Month</ToggleGroupItem>
  </ToggleGroup>
);

const CHECKBOXES = [
  { checked: true, id: "strip-check-deposits", label: "Deposits" },
  { checked: true, id: "strip-check-security", label: "Security alerts" },
  { checked: false, id: "strip-check-news", label: "Product news" },
] as const;

const CheckboxPiece = () => (
  <div className="flex flex-col gap-3">
    {CHECKBOXES.map((item) => (
      <div key={item.id} className="flex items-center gap-2">
        <Checkbox id={item.id} defaultChecked={item.checked} />
        <Label htmlFor={item.id} className={labelClass}>
          {item.label}
        </Label>
      </div>
    ))}
  </div>
);

const RadioGroupPiece = () => (
  <RadioGroup defaultValue="bank" aria-label="Payout method" className="gap-3">
    <div className="flex items-center gap-2">
      <RadioGroupItem value="bank" id="strip-radio-bank" />
      <Label htmlFor="strip-radio-bank" className={labelClass}>
        Bank transfer
      </Label>
    </div>
    <div className="flex items-center gap-2">
      <RadioGroupItem value="paypal" id="strip-radio-paypal" />
      <Label htmlFor="strip-radio-paypal" className={labelClass}>
        PayPal
      </Label>
    </div>
  </RadioGroup>
);

const GOALS = [
  { label: "Emergency fund", value: 72 },
  { label: "New laptop", value: 35 },
] as const;

const ProgressPiece = () => (
  <div className="flex flex-col gap-4">
    {GOALS.map((goal) => (
      <div key={goal.label} className="flex flex-col gap-2">
        <div className={cn(TYPE.cardLabel, "flex justify-between")}>
          <span>{goal.label}</span>
          <span className="text-muted-foreground tabular-nums">
            {goal.value}%
          </span>
        </div>
        <Progress value={goal.value} aria-label={goal.label} />
      </div>
    ))}
  </div>
);

const chartData = [
  { month: "Jan", value: 42 },
  { month: "Feb", value: 58 },
  { month: "Mar", value: 36 },
  { month: "Apr", value: 64 },
  { month: "May", value: 51 },
  { month: "Jun", value: 72 },
];

const chartConfig = {
  value: { color: "var(--chart-2)", label: "Saved" },
} satisfies ChartConfig;

const BarChartPiece = () => (
  <ChartContainer config={chartConfig} className="aspect-auto h-36 w-full">
    <BarChart data={chartData} margin={{ left: 0, right: 0 }}>
      <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
      <Bar dataKey="value" fill="var(--color-value)" radius={4} />
    </BarChart>
  </ChartContainer>
);

export const STRIP_PIECES: Record<string, React.ComponentType> = {
  "bar-chart": BarChartPiece,
  button: ButtonPiece,
  checkbox: CheckboxPiece,
  input: InputPiece,
  progress: ProgressPiece,
  "radio-group": RadioGroupPiece,
  select: SelectPiece,
  slider: SliderPiece,
  switch: SwitchPiece,
  "toggle-group": ToggleGroupPiece,
};
