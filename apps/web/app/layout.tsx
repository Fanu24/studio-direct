import { Outfit, IBM_Plex_Mono } from "next/font/google";
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

const SITE_NAME = "Studio Direct";
const DEFAULT_TITLE = "Studio Direct: gaming jobs from studio career pages";

const SOCIAL_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Studio Direct. Gaming jobs, straight from the studio.",
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
  /* No title or description here: Next fills og:title and og:description from each page's own
     title and description, so a shared link previews the page it points at. */
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
    <html className={`${sans.variable} ${mono.variable}`} lang="en">
      <body>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
