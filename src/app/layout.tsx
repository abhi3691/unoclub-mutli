import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#284d3b",
};

export const metadata: Metadata = {
  title: "Uno Club | Your table. Your people.",
  description:
    "Play an Uno-style card game with 2–8 friends, public tables, private room codes, and optional voice chat.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
