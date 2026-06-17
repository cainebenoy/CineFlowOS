import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import OfflineIndicator from "@/components/OfflineIndicator";
import AuthProvider from "@/app/components/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CineFlow OS — Film Production Platform",
  description: "End-to-end operating system for Indian film and AVGC productions.",
  manifest: "/manifest.json",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <OfflineIndicator />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
