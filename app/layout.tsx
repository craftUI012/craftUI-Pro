import { SpeedInsights } from "@vercel/speed-insights/next";
import { SoundProvider } from "@web-kits/audio/react";
import type { Metadata } from "next";
import Script from "next/script";

import { Analytics } from "@/components/analytics";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { META_THEME_COLORS } from "@/constants/site";
import { fontVariables } from "@/lib/fonts";
import { cn } from "@/lib/utils";
import { JsonLdScripts } from "@/seo/json-ld";

import "@/styles/globals.css";
import { baseMetadata } from "@/seo/metadata";

export const metadata: Metadata = baseMetadata;

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html lang="en" suppressHydrationWarning>
    <head>
      <JsonLdScripts />
      <script
        dangerouslySetInnerHTML={{
          __html: `
              try {
                if (localStorage.theme === 'dark' || ((!('theme' in localStorage) || localStorage.theme === 'system') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.querySelector('meta[name="theme-color"]').setAttribute('content', '${META_THEME_COLORS.dark}')
                }
              } catch (_) {}
            `,
        }}
      />
      <meta name="theme-color" content={META_THEME_COLORS.light} />
    </head>
    <body
      className={cn(
        "text-foreground group/body overscroll-none font-sans antialiased [--footer-height:--spacing(14)] [--header-height:--spacing(14)] xl:[--footer-height:--spacing(24)]",
        fontVariables
      )}
    >
      <SoundProvider>
        <ThemeProvider>
          {children}
          <Toaster position="top-center" />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </SoundProvider>
      {/* Umami analytics. next/script's default strategy (afterInteractive)
          loads it once the page is interactive, so it never blocks
          rendering. Production builds only, so local visits don't count. */}
      {process.env.NODE_ENV === "production" ? (
        <Script
          data-website-id="d4ba3a77-4ab2-4a15-bd56-5abd94afe5f5"
          src="https://cloud.umami.is/script.js"
          strategy="afterInteractive"
        />
      ) : null}
    </body>
  </html>
);

export default RootLayout;
