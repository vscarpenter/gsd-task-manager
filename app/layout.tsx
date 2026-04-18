import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { ToastProvider } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";
import { cn } from "@/lib/utils";
import { PwaRegister } from "@/components/pwa-register";
import { InstallPwaPrompt } from "@/components/install-pwa-prompt";
import { PwaUpdateToast } from "@/components/pwa-update-toast";
import { ClientLayout } from "@/components/client-layout";
import { QueryProvider } from "@/components/query-provider";
import { FirstTimeRedirect } from "@/components/first-time-redirect";

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

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  display: "swap",
});

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
      <body className={cn(inter.variable, jetbrainsMono.variable, geist.variable, geistMono.variable, instrumentSerif.variable, "font-sans bg-canvas text-foreground antialiased")}>
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
                  <InstallPwaPrompt />
                  <PwaUpdateToast />
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
