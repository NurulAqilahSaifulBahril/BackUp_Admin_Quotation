import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EE Admin | Modern ERP Solution",
  description: "Professional Enterprise Resource Planning System",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Root layout is now a pass-through
  // Specific layouts are handled by route groups
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
