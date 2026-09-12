import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/layout/Shell";

export const metadata: Metadata = {
  title: "FORK & FIRE | Commercial Restaurant POS",
  description:
    "Fast-food restaurant point-of-sale, order management, kitchen display, and reporting system.",
  icons: {
    icon: "/logo.PNG",
    shortcut: "/logo.PNG",
    apple: "/logo.PNG",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased bg-[#0c0d10] text-zinc-100 overflow-hidden">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
