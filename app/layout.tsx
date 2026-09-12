import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedBud AI",
  description: "Safety-first home pharmacy inventory and guidance agent",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
