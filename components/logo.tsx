import { useId } from "react";

import { cn } from "@/lib/utils";

// The craftUI mark: a solid squircle behind a frosted glass one. Drawn from
// public/logo/glass-squircle-pair.svg (the master), framed square so it sits
// like an icon at any size. It's in full colour in both themes.
//
// The gradient, blur and clip ids are per instance (useId), so several marks
// on one page don't share, or break, each other's defs.
export const LogoMark = ({
  className,
  ...props
}: React.ComponentProps<"svg">) => {
  const id = useId();
  const fill = `${id}-fill`;
  const blur = `${id}-blur`;
  const clip = `${id}-clip`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="16 7.5 60 60"
      fill="none"
      aria-hidden
      className={cn("size-4", className)}
      {...props}
    >
      <defs>
        <linearGradient id={fill} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#A8B8FF" stopOpacity="0.9" />
          <stop offset="1" stopColor="#A8B8FF" stopOpacity="0.28" />
        </linearGradient>
        <filter id={blur} x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <clipPath id={clip}>
          <rect x="17" y="18" width="45" height="46" rx="12" />
        </clipPath>
      </defs>
      <rect x="30" y="11" width="45" height="46" rx="12" fill="#1F3BFF" />
      <g clipPath={`url(#${clip})`}>
        <rect
          x="30"
          y="11"
          width="45"
          height="46"
          rx="12"
          fill="#1F3BFF"
          filter={`url(#${blur})`}
        />
      </g>
      <rect
        x="17"
        y="18"
        width="45"
        height="46"
        rx="12"
        fill={`url(#${fill})`}
      />
      <rect
        x="17.4"
        y="18.4"
        width="44.2"
        height="45.2"
        rx="11.6"
        stroke="#FFFFFF"
        strokeOpacity="0.5"
        strokeWidth="0.8"
      />
    </svg>
  );
};

// The mark as a standalone SVG file, for "Copy / Download as SVG" in the
// brand menu. Same drawing as LogoMark and public/favicon.svg.
export const LOGO_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="16 7.5 60 60" fill="none">
  <defs>
    <linearGradient id="glassFill" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#A8B8FF" stop-opacity="0.9"/>
      <stop offset="1" stop-color="#A8B8FF" stop-opacity="0.28"/>
    </linearGradient>
    <filter id="backdropBlur" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <clipPath id="glassShape">
      <rect x="17" y="18" width="45" height="46" rx="12"/>
    </clipPath>
  </defs>
  <rect x="30" y="11" width="45" height="46" rx="12" fill="#1F3BFF"/>
  <g clip-path="url(#glassShape)">
    <rect x="30" y="11" width="45" height="46" rx="12" fill="#1F3BFF" filter="url(#backdropBlur)"/>
  </g>
  <rect x="17" y="18" width="45" height="46" rx="12" fill="url(#glassFill)"/>
  <rect x="17.4" y="18.4" width="44.2" height="45.2" rx="11.6" stroke="#FFFFFF" stroke-opacity="0.5" stroke-width="0.8"/>
</svg>
`;
