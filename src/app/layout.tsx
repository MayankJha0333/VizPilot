import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { RouteProgress } from "@/components/ui/misc";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { THEME_BOOT_SCRIPT } from "@/components/theme/boot";

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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eceefa" },
    { media: "(prefers-color-scheme: dark)", color: "#11131f" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the boot script sets data-theme on <html> before React loads.
    <html lang="en" data-scroll-behavior="smooth" className={`${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <RouteProgress />
              {children}
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
