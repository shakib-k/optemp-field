import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OPTemp Field",
  description:
    "Field data collection for thermal state and value-based decision-making.",
};

/**
 * Field-use viewport: no user zoom (a stray pinch mid-task loses the layout),
 * and `viewportFit: cover` so the iOS safe-area insets are available to CSS.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
