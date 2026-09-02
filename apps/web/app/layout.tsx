import { Outfit, IBM_Plex_Mono } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteChrome } from "./_components/site-chrome";
import "./globals.css";

const sans = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Studio Direct",
  description:
    "Jobs from studio career pages, including roles not posted on LinkedIn.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${sans.variable} ${mono.variable}`} lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
