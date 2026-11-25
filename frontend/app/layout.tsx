import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Cabinet } from "./cabinet";
import "./globals.css";

const geistSans = Geist({
  fallback: ["Arial", "sans-serif"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Истинный интеллект",
  description: "Аналитический кабинет",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      className={`${geistSans.className} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Cabinet>{children}</Cabinet>
      </body>
    </html>
  );
}
