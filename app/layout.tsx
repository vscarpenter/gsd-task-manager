import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { Toaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";
import { PwaRegister } from "@/components/pwa-register";
import { InstallPwaPrompt } from "@/components/install-pwa-prompt";
import { PwaUpdateToast } from "@/components/pwa-update-toast";
import { ClientLayout } from "@/components/client-layout";
import { SyncDebugInstaller } from "@/components/sync-debug-installer";

// Local fonts for better offline PWA support and reliability
const inter = localFont({
  src: "../fonts/Inter-Variable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "100 900",
});

const jetbrainsMono = localFont({
  src: "../fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-mono",
  display: "swap",
  weight: "100 800",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" // iOS safe area support
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
      <body className={cn(inter.variable, jetbrainsMono.variable, "font-sans bg-canvas text-foreground antialiased")}>
        <ErrorBoundary>
          <ThemeProvider>
            <ToastProvider>
              <ClientLayout>
                {children}
              </ClientLayout>
              <PwaRegister />
              <InstallPwaPrompt />
              <PwaUpdateToast />
              <SyncDebugInstaller />
              <Toaster richColors position="top-center" />
            </ToastProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
