import {
  Caveat,
  Geist_Mono as FontMono,
  Geist as FontSans,
  Inter,
} from "next/font/google";

import { cn } from "@/lib/utils";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = FontMono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400"],
});

const fontInter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// Handwriting, for annotations only (margin notes beside arrows on marketing
// pages, e.g. /skills/isometrics). Never for UI text or body copy.
const fontHand = Caveat({
  subsets: ["latin"],
  variable: "--font-hand",
  weight: ["500", "600"],
});

export const fontVariables = cn(
  fontSans.variable,
  fontMono.variable,
  fontInter.variable,
  fontHand.variable
);
