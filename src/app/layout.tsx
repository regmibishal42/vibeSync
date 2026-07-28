import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

import { ServiceWorkerRegister } from "@/components/pwa/sw-register";
import { OfflineSync } from "@/components/pwa/offline-sync";
import { Toaster } from "@/components/ui/sonner";

// Warm geometric-humanist sans (soft curve terminals, still crisp tabular
// figures for currency/reps) — replaces Geist Sans, which reads as a cold
// engineering-tool grotesque wrong for a cozy identity. Keeps the
// --font-geist-sans variable name so globals.css needs no edit beyond here.
const geistSans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "VibeSync",
    template: "%s · VibeSync",
  },
  description:
    "Dual-user income, expense, job, and loan tracker for two.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "VibeSync",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#fdf3eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        {children}
        <Toaster />
        <ServiceWorkerRegister />
        <OfflineSync />
      </body>
    </html>
  );
}
