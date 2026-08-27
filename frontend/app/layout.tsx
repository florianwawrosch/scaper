import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Pipeline",
  description: "Scrape · Filter · Enrich · Export",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full bg-noir text-ink font-body antialiased">
        {children}
      </body>
    </html>
  );
}
