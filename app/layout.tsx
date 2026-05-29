import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

import { PwaRegister } from "@/components/pwa-register";
import { SentryInit } from "@/components/sentry-init";
import { WebMcpRegister } from "@/components/webmcp-register";
import { InstallPwaPrompt } from "@/components/install-pwa-prompt";
import { PwaUpdateToast } from "@/components/pwa-update-toast";
import { GlobalErrorListener } from "@/components/global-error-listener";
import { ClientLayout } from "@/components/client-layout";
import { QueryProvider } from "@/components/query-provider";
import { FirstTimeRedirect } from "@/components/first-time-redirect";

// The current static Next export emits inline hydration/RSC scripts. Keep
// production inline script allowance until a deploy-time hash pipeline exists.
const scriptSrc = process.env.NODE_ENV === "development"
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'";

const connectSrc = process.env.NODE_ENV === "development"
  ? [
      "connect-src 'self'",
      "http://127.0.0.1:8090",
      "http://localhost:8090",
      "ws://127.0.0.1:8090",
      "ws://localhost:8090",
      "https://api.vinny.io",
      "https://accounts.google.com",
      "https://github.com",
      "https://*.ingest.us.sentry.io",
    ].join(" ")
  : [
      "connect-src 'self'",
      "https://api.vinny.io",
      "https://accounts.google.com",
      "https://github.com",
      "https://*.ingest.us.sentry.io",
    ].join(" ");

const contentSecurityPolicy = [
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || "https://gsd.vinny.dev"),
  title: "GSD Task Manager",
  description: "Prioritize what matters with a privacy-first Eisenhower matrix.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" }
    ],
    apple: { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }
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

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta httpEquiv="Content-Security-Policy" content={contentSecurityPolicy} />
        <link rel="preconnect" href="https://api.vinny.io" />
      </head>
      <body className="font-sans bg-background text-foreground antialiased">
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <QueryProvider>
                <TooltipProvider>
                  <ClientLayout>
                    {children}
                  </ClientLayout>
                  <FirstTimeRedirect />
                  <PwaRegister />
                  <WebMcpRegister />
                  <InstallPwaPrompt />
                  <PwaUpdateToast />
                  <GlobalErrorListener />
                  <SentryInit />
                  <Toaster richColors position="top-center" />
                </TooltipProvider>
              </QueryProvider>
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
