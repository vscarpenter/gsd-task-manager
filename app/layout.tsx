import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemedToaster } from "@/components/ui/themed-toaster";
import "./globals.css";

import { PwaRegister } from "@/components/pwa-register";
import { WebMcpRegister } from "@/components/webmcp-register";
import { PwaUpdateToast } from "@/components/pwa-update-toast";
import { GlobalErrorListener } from "@/components/global-error-listener";
import { ClientLayout } from "@/components/client-layout";
import { FirstTimeRedirect } from "@/components/first-time-redirect";
import { OnboardingGate } from "@/components/onboarding/onboarding-gate";
import { ResetLockGate } from "@/components/reset-lock-gate";

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
      configuredPocketBaseOrigin,
    ].join(" ")
  : [
      "connect-src 'self'",
      "https://api.vinny.io",
      "https://accounts.google.com",
      "https://github.com",
    ].join(" ");

// Two-voice editorial type, shared with the iOS app and gsdtaskmanager.com.
// Apple's "New York" serif (used for display headlines) only exists on Apple
// devices; Newsreader is the cross-platform stand-in with near-identical
// proportions. Exposed as --font-newsreader, which the --serif token chain
// references; the working UI stays on the system sans stack for legibility at
// the 11-12px chip sizes the matrix leans on.
//
// app/fonts/newsreader holds the files next/font/google downloaded from Google
// Fonts during every build, a download that failed CI builds intermittently.
// Shipping them (OFL, see OFL.txt) keeps the build offline and self-hosted, so
// the CSP needs no change. They hold weights 400-600, upright only, since no
// serif text is italic. The optical-size axis stays pinned on purpose: a file
// with opsz carries the full weight range, 2.27x the size, for ~2% tighter titles.
//
// Google splits the font into three files, each with its own unicode-range,
// and next/font/local takes one range per call, so each file gets a call. The
// latin-ext and vietnamese calls join the latin call's family, which next/font
// names after its const ("newsreader"). Without the ranges, the latin file
// draws letters such as ź and ở as a base letter plus a separate accent. Where
// ranges overlap, the last rule wins, so the calls keep Google's order.
// tests/e2e/display-serif.spec.ts checks the ranges and the family join.
const _newsreaderVietnamese = localFont({
  src: [
    { path: "./fonts/newsreader/newsreader-vietnamese.woff2", weight: "400" },
    { path: "./fonts/newsreader/newsreader-vietnamese.woff2", weight: "500" },
    { path: "./fonts/newsreader/newsreader-vietnamese.woff2", weight: "600" },
  ],
  style: "normal",
  declarations: [
    { prop: "font-family", value: "newsreader" },
    {
      prop: "unicode-range",
      value: "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

const _newsreaderLatinExt = localFont({
  src: [
    { path: "./fonts/newsreader/newsreader-latin-ext.woff2", weight: "400" },
    { path: "./fonts/newsreader/newsreader-latin-ext.woff2", weight: "500" },
    { path: "./fonts/newsreader/newsreader-latin-ext.woff2", weight: "600" },
  ],
  style: "normal",
  declarations: [
    { prop: "font-family", value: "newsreader" },
    {
      prop: "unicode-range",
      value: "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF",
    },
  ],
  display: "swap",
  preload: false,
  adjustFontFallback: false,
});

const newsreader = localFont({
  src: [
    { path: "./fonts/newsreader/newsreader-latin.woff2", weight: "400" },
    { path: "./fonts/newsreader/newsreader-latin.woff2", weight: "500" },
    { path: "./fonts/newsreader/newsreader-latin.woff2", weight: "600" },
  ],
  style: "normal",
  declarations: [
    {
      prop: "unicode-range",
      value: "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
    },
  ],
  variable: "--font-newsreader",
  display: "swap",
  preload: false,
  adjustFontFallback: "Times New Roman",
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
          <TooltipProvider>
            {/* Anything that reads or writes task data stays inside the gate, so a pending reset keeps it unmounted. */}
            <ResetLockGate>
              <ClientLayout>{children}</ClientLayout>
              <FirstTimeRedirect />
              <OnboardingGate />
              <WebMcpRegister />
            </ResetLockGate>
            <PwaRegister />
            <PwaUpdateToast />
            <GlobalErrorListener />
            <ThemedToaster />
          </TooltipProvider>
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
