import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getConfig } from "@/lib/config";

export function generateMetadata(): Metadata {
  const cfg = getConfig();
  return {
    title: `${cfg.boothName} — ${cfg.eventName}`,
    description: `Sign up at the ${cfg.boothName} at ${cfg.eventName} to get your photos.`,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0a0e1a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
