import type { Metadata } from "next";
import { AboutNav } from "@/components/about/about-nav";
import { HeroSection } from "@/components/about/hero-section";
import { MatrixSection } from "@/components/about/matrix-section";
import { FeaturesSection } from "@/components/about/features-section";
import { PrivacySection } from "@/components/about/privacy-section";
import { McpSection } from "@/components/about/mcp-section";
import { FooterCta } from "@/components/about/footer-cta";
import packageJson from "@/package.json";

export const metadata: Metadata = {
  title: "About GSD Task Manager — Eisenhower Matrix Productivity",
  description:
    "GSD Task Manager is a privacy-first, offline-capable task manager built on the Eisenhower Matrix. No account required. Your data stays in your browser.",
  openGraph: {
    title: "GSD Task Manager",
    description: "Stop juggling. Start finishing.",
    url: "https://gsd.vinny.dev/about",
    siteName: "GSD Task Manager",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "GSD Task Manager",
    description: "Stop juggling. Start finishing.",
    creator: "@vscarpenter",
  },
};

export default function AboutPage() {
  return (
    <>
      <AboutNav />
      <main>
        <HeroSection />
        <MatrixSection />
        <FeaturesSection />
        <PrivacySection />
        <McpSection />
        <FooterCta version={packageJson.version} />
      </main>
    </>
  );
}
