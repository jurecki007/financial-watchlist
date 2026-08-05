import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";
import { SITE_URL } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Numerals need to align in columns across watchlist rows and chart axes,
// so the mono face is load-bearing here rather than decorative.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Every page sets its own relative `alternates.canonical`; this is what makes
  // those resolve to absolute production URLs. Without it Next.js emits nothing
  // absolute and canonical tags cannot be expressed at all.
  //
  // Note this is NOT given an `alternates.canonical` of its own: metadata is
  // inherited, so a canonical here would make every page in the tree claim to be
  // the homepage.
  metadataBase: SITE_URL,
  title: "Financial Watchlist",
  description:
    "Track companies, watch prices and charts, read the news that moves them.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        {/*
          Runs before first paint. Applying the stored theme in an effect would
          show one frame of the wrong theme on every load — a white flash on a
          dark-led product is worse than having no toggle.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}`,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
