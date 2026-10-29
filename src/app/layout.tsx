import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OM CMMS · Störungsmanagement",
  description:
    "Lokaler Pilot zur Erfassung und Bearbeitung von Störungsmeldungen.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
