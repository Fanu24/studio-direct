import { Bricolage_Grotesque, Figtree, JetBrains_Mono } from "next/font/google";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteChrome } from "./_components/site-chrome";
import { HOMEPAGE_CLAIM } from "../lib/copy";
import "./globals.css";
import "./styles/theaters.css";
import "./styles/home.css";
import "./styles/jobs.css";
import "./styles/job-detail.css";
import "./styles/pricing.css";
import "./styles/account.css";
import "./styles/nodework.css";
import "./styles/board.css";
import "./styles/learn.css";
import "./styles/marketing.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Figtree({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_NAME = "Nodework";
const DEFAULT_TITLE = "Nodework: Web3, blockchain and crypto jobs";

const SOCIAL_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Nodework. Web3 jobs, salaries and companies.",
};

function metadataBase(): URL | undefined {
  const siteUrl = process.env.SITE_URL?.trim();
  if (!siteUrl) return undefined;
  try {
    return new URL(siteUrl);
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: metadataBase(),
  applicationName: SITE_NAME,
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: HOMEPAGE_CLAIM,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    images: [SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    images: [SOCIAL_IMAGE],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html className={`${display.variable} ${sans.variable} ${mono.variable}`} lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
