import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuitarMode",
  description:
    "Play your guitar, hear your scale. Real-time note and mode detection with a fretboard visualization.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
