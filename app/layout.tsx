import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Newsreader } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemedToaster } from "@/components/ui/themed-toaster";
import "./globals.css";

import { PwaRegister } from "@/components/pwa-register";
import { SentryInit } from "@/components/sentry-init";
import { WebMcpRegister } from "@/components/webmcp-register";
import { PwaUpdateToast } from "@/components/pwa-update-toast";
import { GlobalErrorListener } from "@/components/global-error-listener";
import { ClientLayout } from "@/components/client-layout";
import { QueryProvider } from "@/components/query-provider";
import { FirstTimeRedirect } from "@/components/first-time-redirect";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";

// Development needs React's eval diagnostics and Next's inline bootstrap. The
// production static export omits this meta policy: build post-processing moves
// its bootstrap blocks to same-origin files and the hosting layer supplies the
// strict response-header policy.
const isDevelopment = process.env.NODE_ENV !== "production";
const scriptSrc = "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:8400";
const configuredPocketBaseOrigin = (() => {
  const configuredUrl = process.env.NEXT_PUBLIC_POCKETBASE_URL;
  if (!configuredUrl) return null;
  try {
    const parsed = new URL(configuredUrl);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.origin
      : null;
  } catch {
    return null;
  }
})();

const connectSrc = process.env.NODE_ENV === "development"
  ? [
      "connect-src 'self'",
      "http://localhost:8400",
      "http://127.0.0.1:8090",
      "http://localhost:8090",
      "ws://127.0.0.1:8090",
      "ws://localhost:8090",
      "https://api.vinny.io",
      "https://accounts.google.com",
      "https://github.com",
      "https://*.ingest.us.sentry.io",
      configuredPocketBaseOrigin,
    ].join(" ")
  : [
      "connect-src 'self'",
      "https://api.vinny.io",
      "https://accounts.google.com",
      "https://github.com",
      "https://*.ingest.us.sentry.io",
    ].join(" ");

// Two-voice editorial type, shared with the iOS app and gsdtaskmanager.com.
// Apple's "New York" serif (used for display headlines) only exists on Apple
// devices; Newsreader is the cross-platform stand-in with near-identical
// proportions. next/font self-hosts it (no runtime Google Fonts request, so no
// CSP/connect-src change) and emits the @font-face at build time under
// output:export. Exposed as --font-newsreader, which the --serif token chain
// references; the working UI stays on the system sans stack for legibility at
// the 11-12px chip sizes the matrix leans on.
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

const developmentContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  connectSrc,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

function DevelopmentCspMeta() {
  if (!isDevelopment) return null;
  return (
    <meta
      httpEquiv="Content-Security-Policy"
      content={developmentContentSecurityPolicy}
    />
  );
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F1E9" },
    { media: "(prefers-color-scheme: dark)", color: "#17150F" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://gsd.vinny.dev"),
  title: "GSD Task Manager",
  description: "Prioritize what matters with a privacy-first Eisenhower matrix.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }
  },
  openGraph: {
    title: "GSD Task Manager",
    description: "Prioritize what matters with a privacy-first Eisenhower matrix.",
    url: "https://gsd.vinny.dev",
    siteName: "GSD Task Manager",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "GSD Task Manager - Eisenhower Matrix"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: "GSD Task Manager",
    description: "Prioritize what matters with a privacy-first Eisenhower matrix.",
    images: ["/og-image.png"]
  }
};

function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <QueryProvider>
            <TooltipProvider>
              <ClientLayout>{children}</ClientLayout>
              <FirstTimeRedirect />
              <OnboardingGate />
              <PwaRegister />
              <WebMcpRegister />
              <PwaUpdateToast />
              <GlobalErrorListener />
              <SentryInit />
              <ThemedToaster />
            </TooltipProvider>
          </QueryProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={newsreader.variable}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <DevelopmentCspMeta />
        <link rel="preconnect" href="https://api.vinny.io" />
      </head>
      <body className="font-sans bg-background text-foreground antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
