import type { Metadata, Viewport } from "next";
import { DM_Mono, Instrument_Sans } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const description =
  "Seaworthy scans AI-built apps for exposed secrets, missing auth, unsafe Supabase rules, and other launch risks before you charge money.";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: "Seaworthy — Security checks for AI-built apps",
  description,
  applicationName: site.name,
  alternates: { canonical: "/" },
  openGraph: {
    url: site.url,
    siteName: site.name,
    title: "Seaworthy — Security checks for AI-built apps",
    description:
      "A pre-launch security check for AI-built apps. Find critical issues, get evidence, and fix them before customers do.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Seaworthy — Security checks for AI-built apps",
    description:
      "A pre-launch security check for AI-built apps. Find critical issues, get evidence, and fix them before customers do.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#121614",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${dmMono.variable}`}>
      <body>
        <a className="skip-link" href="#top">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
