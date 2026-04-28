import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solana DevFix AI",
  description: "Rule-based Solana and Anchor security scanner dashboard"
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
