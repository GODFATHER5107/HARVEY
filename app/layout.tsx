import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HARVEY | InfoDart Global",
  description:
    "AI-powered B2B lead generation and sales intelligence platform for InfoDart Global."
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
