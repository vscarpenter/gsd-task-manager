import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Manrope, Newsreader } from "next/font/google";
import type { ReactNode } from "react";

import "./design-lab.css";
import "./refined-evolution.css";
import "./editorial-planner.css";
import "./precision-utility.css";
import "./spatial-focus.css";
import "./native-calm.css";

const editorialSerif = Newsreader({
  subsets: ["latin"],
  variable: "--font-editorial",
  display: "swap",
});

const precisionSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-precision-sans",
  display: "swap",
});

const precisionMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-precision-mono",
  display: "swap",
});

const spatialSans = Manrope({
  subsets: ["latin"],
  variable: "--font-spatial",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GSD Design Lab",
  description: "Five isolated visual and usability directions for GSD Task Manager.",
  robots: { index: false, follow: false },
};

export default function DesignLabLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className={`${editorialSerif.variable} ${precisionSans.variable} ${precisionMono.variable} ${spatialSans.variable}`}>
      {children}
    </div>
  );
}
