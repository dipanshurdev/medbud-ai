import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MediGuard AI",
  description: "Safety-first home pharmacy inventory and guidance agent"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
