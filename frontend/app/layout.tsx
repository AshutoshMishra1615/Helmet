import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";
import AuthGuard from "@/components/AuthGuard";

export const metadata: Metadata = {
  title: "Safety Monitor",
  description: "Real-time industrial worker safety monitoring",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Safety Monitor",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-background text-slate-100 flex flex-col h-screen overflow-hidden">
        <AuthGuard>
          {/* Sticky header */}
          <Header />

          {/* Scrollable content area — padded to avoid nav overlap */}
          <main className="flex-1 overflow-y-auto pb-20">
            <div className="max-w-2xl mx-auto px-4 py-4">{children}</div>
          </main>

          {/* Fixed bottom navigation */}
          <BottomNav />
        </AuthGuard>
      </body>
    </html>
  );
}
