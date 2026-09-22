import localFont from "next/font/local";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { SiteChrome } from "./_components/site-chrome";
import { HOMEPAGE_CLAIM } from "../lib/copy";
// Every stylesheet is imported here and nowhere else. globals.css is the only
// :root; motion.css is the only @keyframes. Chunk order is the bundler's, so a
// component-level import anywhere would reorder the emitted CSS and revert tokens.
import "./globals.css";
import "./styles/motion.css";
import "./styles/chrome.css";
import "./styles/footer.css";
import "./styles/home.css";
import "./styles/jobs.css";
import "./styles/job-detail.css";
import "./styles/pricing.css";
import "./styles/account.css";
import "./styles/nodework.css";
import "./styles/board.css";
import "./styles/learn.css";
import "./styles/marketing.css";
import "./styles/commerce.css";
import "./styles/salary.css";
import "./faq/faq.css";
import "./hire/hire.css";

const display = localFont({
  src: "./fonts/bricolage-grotesque.ttf",
  weight: "200 800",
  variable: "--font-display",
  display: "swap",
});

const sans = localFont({
  src: "./fonts/figtree.ttf",
  weight: "300 900",
  variable: "--font-sans",
  display: "swap",
});

const mono = localFont({
  src: "./fonts/jetbrains-mono.ttf",
  weight: "100 800",
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
