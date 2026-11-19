"use client";

import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { FLOAT, RING } from "./surface";

/* ─────────────────────────────────────────────────────────
 * PHONE FIELD: the country code and the number, as one field.
 *
 *   [🇮🇳 +91 ⌄ | 98765 43210]
 *
 * The code opens a searchable list. It is origin-aware: the list grows
 * out of the code button that opened it (transform-origin follows Radix's
 * --radix-popover-content-transform-origin), never from its own centre.
 *
 *   open    scale 0.95 → 1 + fade, 150ms ease-out (0.23, 1, 0.32, 1)
 *   close   scale 1 → 0.95 + fade, 100ms (exits faster than entrances)
 *   reduced motion: the fade only
 *
 * Picking a country puts focus in the number. Flags are emoji (no image
 * files); systems without flag emoji show the two-letter code instead.
 * ───────────────────────────────────────────────────────── */

/** A country the code list offers. */
export interface PhoneCountry {
  /** ISO 3166 two-letter code, e.g. "IN". Also gives the flag and name. */
  code: string;
  /** International dialling code, e.g. "+91". */
  dial: string;
}

export const DEFAULT_PHONE_COUNTRIES: PhoneCountry[] = [
  { code: "US", dial: "+1" },
  { code: "CA", dial: "+1" },
  { code: "GB", dial: "+44" },
  { code: "IN", dial: "+91" },
  { code: "AU", dial: "+61" },
  { code: "NZ", dial: "+64" },
  { code: "IE", dial: "+353" },
  { code: "DE", dial: "+49" },
  { code: "FR", dial: "+33" },
  { code: "ES", dial: "+34" },
  { code: "IT", dial: "+39" },
  { code: "NL", dial: "+31" },
  { code: "BE", dial: "+32" },
  { code: "CH", dial: "+41" },
  { code: "AT", dial: "+43" },
  { code: "SE", dial: "+46" },
  { code: "NO", dial: "+47" },
  { code: "DK", dial: "+45" },
  { code: "FI", dial: "+358" },
  { code: "PT", dial: "+351" },
  { code: "PL", dial: "+48" },
  { code: "TR", dial: "+90" },
  { code: "IL", dial: "+972" },
  { code: "AE", dial: "+971" },
  { code: "SA", dial: "+966" },
  { code: "EG", dial: "+20" },
  { code: "NG", dial: "+234" },
  { code: "KE", dial: "+254" },
  { code: "ZA", dial: "+27" },
  { code: "BR", dial: "+55" },
  { code: "MX", dial: "+52" },
  { code: "AR", dial: "+54" },
  { code: "JP", dial: "+81" },
  { code: "KR", dial: "+82" },
  { code: "CN", dial: "+86" },
  { code: "HK", dial: "+852" },
  { code: "SG", dial: "+65" },
  { code: "MY", dial: "+60" },
  { code: "ID", dial: "+62" },
  { code: "PH", dial: "+63" },
  { code: "TH", dial: "+66" },
  { code: "VN", dial: "+84" },
  { code: "PK", dial: "+92" },
  { code: "BD", dial: "+880" },
];

// Country names through Intl ("India", "United Kingdom"), not a table.
const REGION_NAMES = new Intl.DisplayNames(["en"], { type: "region" });
const nameOf = (code: string) => REGION_NAMES.of(code) ?? code;

// The flag emoji for a two-letter code: each letter as a regional indicator.
// "A" (65) maps to U+1F1E6 (127462), REGIONAL INDICATOR SYMBOL LETTER A.
const REGIONAL_A = 127_462;
const flagOf = (code: string) =>
  String.fromCodePoint(
    ...[...code.toUpperCase()].map(
      (letter) => REGIONAL_A + (letter.codePointAt(0) ?? 65) - 65
    )
  );

// Origin-aware entrance and exit (see the header). The shadow is the
// block's float, so the list matches its other menus. The reduced-motion
// overrides carry the same data-[state] as shadcn's zoom and slide, so
// they're as specific and win.
const LIST_MOTION =
  "origin-(--radix-popover-content-transform-origin) ease-[cubic-bezier(0.23,1,0.32,1)] data-[state=open]:duration-150 data-[state=closed]:duration-100 motion-reduce:data-[state=open]:[--tw-enter-scale:1] motion-reduce:data-[state=closed]:[--tw-exit-scale:1] motion-reduce:data-[state=open]:[--tw-enter-translate-y:0] motion-reduce:data-[state=closed]:[--tw-exit-translate-y:0]";

export const PhoneField = ({
  countries,
  country,
  describedBy,
  id,
  invalid,
  number,
  onCountryChange,
  onNumberChange,
}: {
  countries: PhoneCountry[];
  country: string;
  describedBy?: string;
  id: string;
  invalid?: boolean;
  number: string;
  onCountryChange: (code: string) => void;
  onNumberChange: (value: string) => void;
}) => {
  const [open, setOpen] = useState(false);
  const numberRef = useRef<HTMLInputElement>(null);
  const current =
    countries.find((item) => item.code === country) ?? countries[0];

  return (
    <div
      className={cn(
        RING,
        "dark:bg-input/30 focus-within:border-ring focus-within:ring-ring/50 flex h-9 items-center rounded-md bg-transparent transition-[color,box-shadow] focus-within:ring-[3px]",
        invalid && "border-destructive"
      )}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Country code: ${nameOf(current.code)} (${current.dial})`}
            // No divider: a light tint marks the country code as its own button.
            className="bg-muted/60 hover:bg-accent focus-visible:bg-accent flex h-full shrink-0 items-center gap-1.5 rounded-l-[calc(var(--radius-md)-1px)] pr-2 pl-3 text-sm outline-none"
          >
            <span aria-hidden className="text-base leading-none">
              {flagOf(current.code)}
            </span>
            <span className="tabular-nums">{current.dial}</span>
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              strokeWidth={1.75}
              className="text-muted-foreground size-3.5"
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          // Overrides: no padding (the list fills it), the block's float
          // shadow, and the origin-aware motion above.
          className={cn(
            FLOAT,
            LIST_MOTION,
            "w-64 overflow-hidden rounded-lg p-0"
          )}
        >
          {/* Override: no rule under the search field; space separates it. */}
          <Command className="[&_[data-slot=command-input-wrapper]]:border-b-0">
            <CommandInput placeholder="Search country or code" />
            <CommandList className="max-h-72 overscroll-contain">
              <CommandEmpty>No country found.</CommandEmpty>
              <CommandGroup>
                {countries.map((item) => (
                  <CommandItem
                    key={item.code}
                    value={`${nameOf(item.code)} ${item.dial} ${item.code}`}
                    onSelect={() => {
                      onCountryChange(item.code);
                      setOpen(false);
                      // The number is what comes next.
                      requestAnimationFrame(() => numberRef.current?.focus());
                    }}
                  >
                    <span aria-hidden className="text-base leading-none">
                      {flagOf(item.code)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {nameOf(item.code)}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {item.dial}
                    </span>
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2}
                      className={cn(
                        "size-4",
                        item.code === current.code ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Input
        ref={numberRef}
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="98765 43210"
        value={number}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(event) => onNumberChange(event.target.value)}
        // Override: the box around it draws the ring and focus.
        className="h-full min-w-0 flex-1 border-0 bg-transparent pl-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
      />
    </div>
  );
};
