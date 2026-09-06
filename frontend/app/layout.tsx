import type { Metadata } from "next";
import "./globals.css";
import { Header } from "./components/Header";
import { ToastProvider } from "./components/Toast";
import { ThemeProvider } from "./components/ThemeProvider";
import { StoreGate } from "./components/StoreGate";

export const metadata: Metadata = {
  title: "Lead Pipeline",
  description: "Scrape · Filter · Enrich · Export",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="h-full antialiased flex flex-col">
        <ThemeProvider />
        <ToastProvider>
          <Header />
          <main className="flex-1"><StoreGate>{children}</StoreGate></main>
        </ToastProvider>
      </body>
    </html>
  );
}
