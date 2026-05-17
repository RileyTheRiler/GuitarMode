import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "GuitarMode",
  description:
    "Play your guitar, hear your scale. Real-time note and mode detection with a fretboard visualization.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-zinc-950 text-zinc-100 antialiased font-sans">{children}</body>
    </html>
  );
}
