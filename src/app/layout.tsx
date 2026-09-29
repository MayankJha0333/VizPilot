import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { RouteProgress } from "@/components/ui/misc";

export const metadata: Metadata = {
  title: {
    default: "VizPilot — Turn data into reports people actually read",
    template: "%s · VizPilot",
  },
  description:
    "Upload a CSV, paste a table or start from a sample. VizPilot turns it into clean charts and a shareable report in minutes.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b0f1e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <ToastProvider>
            <RouteProgress />
            {children}
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
