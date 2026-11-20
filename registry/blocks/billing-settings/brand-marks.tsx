import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────
 * BRAND MARKS: small coloured payment logos, drawn inline (no images).
 * Cards are 36×24 tiles; wallets are 18px glyphs. Light tiles carry a
 * 1px black/10 edge (white/10 in dark), never a tinted one.
 * ───────────────────────────────────────────────────────── */

export type CardBrand = "visa" | "mastercard" | "amex";

export const BRAND_NAME: Record<CardBrand, string> = {
  amex: "Amex",
  mastercard: "Mastercard",
  visa: "Visa",
};

const Tile = ({
  bare,
  children,
  className,
  fill,
  label,
}: {
  bare?: boolean;
  children: React.ReactNode;
  className?: string;
  fill?: string;
  label: string;
}) => (
  <svg
    viewBox="0 0 36 24"
    role="img"
    aria-label={label}
    className={cn("h-6 w-9 shrink-0", className)}
  >
    {bare ? null : (
      <rect
        x="0.5"
        y="0.5"
        width="35"
        height="23"
        rx="4"
        fill={fill}
        className={cn(
          !fill && "fill-white dark:fill-zinc-800",
          "stroke-black/10 dark:stroke-white/10"
        )}
      />
    )}
    {children}
  </svg>
);

export const CardMark = ({
  bare = false,
  brand,
  className,
}: {
  /** No tile: the mark alone, for use on the brand's gradient card. */
  bare?: boolean;
  brand: CardBrand;
  className?: string;
}) => {
  if (brand === "visa") {
    return (
      <Tile bare={bare} label="Visa" fill="#1A1F71" className={className}>
        <text
          x="18"
          y="15.5"
          textAnchor="middle"
          fill="#fff"
          fontSize="9"
          fontStyle="italic"
          fontWeight="700"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          VISA
        </text>
      </Tile>
    );
  }
  if (brand === "amex") {
    return (
      <Tile
        bare={bare}
        label="American Express"
        fill="#006FCF"
        className={className}
      >
        <text
          x="18"
          y="15"
          textAnchor="middle"
          fill="#fff"
          fontSize="8"
          fontWeight="700"
          fontFamily="Arial, Helvetica, sans-serif"
        >
          AMEX
        </text>
      </Tile>
    );
  }
  // Mastercard: two circles and the orange lens where they overlap.
  return (
    <Tile bare={bare} label="Mastercard" className={className}>
      <circle cx="14.5" cy="12" r="6" fill="#EB001B" />
      <circle cx="21.5" cy="12" r="6" fill="#F79E1B" />
      <path
        d="M18 7.127A6 6 0 0 1 18 16.873A6 6 0 0 1 18 7.127Z"
        fill="#FF5F00"
      />
    </Tile>
  );
};

export const GoogleMark = () => (
  <svg viewBox="0 0 18 18" aria-hidden className="size-4 shrink-0">
    <path
      fill="#4285F4"
      d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
    />
    <path
      fill="#34A853"
      d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
    />
    <path
      fill="#FBBC05"
      d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
    />
    <path
      fill="#EA4335"
      d="M9 3.58c1.321 0 2.508.454 3.345 1.346l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
    />
  </svg>
);
