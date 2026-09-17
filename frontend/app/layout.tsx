import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import ServiceWorkerRegistrar from "../components/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aalim — Qur'an & Sunnah AI",
  description:
    "An AI companion for Muslims, grounded in the Qur'an and authentic Hadith.",
  manifest: "/manifest.webmanifest",
  applicationName: "Aalim",
  appleWebApp: {
    capable: true,
    title: "Aalim",
    // Cream rather than black so the status bar blends with the app.
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
  other: {
    // Next emits the modern `mobile-web-app-capable`. Older iOS versions
    // only honour the apple-prefixed name, and without it the app opens
    // in a Safari tab from the home screen instead of standalone.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the app paint into the notch and home-indicator areas; the
  // safe-area padding in globals.css keeps content clear of them.
  viewportFit: "cover",
  themeColor: "#065f46",
  // Deliberately NOT setting maximumScale/userScalable: blocking pinch
  // zoom is an accessibility failure. iOS auto-zoom on focus is avoided
  // by giving every input a 16px font size instead.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
