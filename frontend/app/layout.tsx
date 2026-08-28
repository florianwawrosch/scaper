import type { Metadata } from "next";
import "./globals.css";
import { Header } from "./components/Header";
import { ToastProvider } from "./components/Toast";
import { StatusDashboard } from "./components/StatusDashboard";

export const metadata: Metadata = {
  title: "Lead Pipeline",
  description: "Scrape · Filter · Enrich · Export",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full bg-noir text-ink font-body antialiased flex flex-col">
        <ToastProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <StatusDashboard />
        </ToastProvider>
      </body>
    </html>
  );
}
