import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bunga Books — Talaan ng Negosyong Prutas",
  description: "Madaling pagtatala ng benta, bili, puhunan at imbentaryo para sa nagtitinda ng prutas.",
  applicationName: "Fruit Vendor Digital Bookkeeping System",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Bunga Books", statusBarStyle: "default" },
};

export const viewport = {
  themeColor: "#f5faf6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fil">
      <body className="bg-[#f5f8f5] text-[#183b2b] antialiased">{children}</body>
    </html>
  );
}
