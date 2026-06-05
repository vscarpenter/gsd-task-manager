import type { Metadata } from "next";
import { AppShell } from "@/components/matrix-simplified/app-shell";
import { PrivacyPolicy } from "@/components/privacy/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy — GSD Task Manager",
  description:
    "How GSD Task Manager handles your data: local-first by default, no account required, and optional cloud sync that is encrypted in transit. Your tasks stay yours.",
  openGraph: {
    title: "Privacy Policy — GSD Task Manager",
    description: "Privacy-first by design. Your tasks stay on your device.",
    url: "https://gsd.vinny.dev/privacy",
    siteName: "GSD Task Manager",
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <AppShell title="Privacy">
      <PrivacyPolicy />
    </AppShell>
  );
}
