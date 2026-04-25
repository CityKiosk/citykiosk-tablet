import type { Metadata, Viewport } from "next";
import { Fira_Sans, Fira_Code } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";
import { I18nProvider } from "@/components/I18nProvider";
import SkipLink from "@/components/SkipLink";
import SwRegister from "@/components/SwRegister";

const firaSans = Fira_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-fira-sans",
  display: "swap",
});

const firaCode = Fira_Code({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-fira-code",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    template: "%s · Souvenirs Berlin",
    default: "Souvenirs Berlin",
  },
  description: "Souvenirs Berlin ürün katalog ve sipariş yönetim paneli · Souvenirs Berlin Katalog & Bestellverwaltung",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.png",
    // iOS shows transparent pixels as black on the home screen, so point
    // apple-touch-icon at the solid-bg variant that has a built-in safe zone.
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Souvenirs Berlin",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${firaSans.variable} ${firaCode.variable}`}>
      <head>
        <script src="/theme-init.js" />
      </head>
      <body className="bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen antialiased">
        <I18nProvider>
          <SkipLink />
          <ToastProvider>
            {children}
            <SwRegister />
          </ToastProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
