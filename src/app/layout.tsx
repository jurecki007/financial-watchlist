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
  // The icon lives in `public/`, not at `app/favicon.ico`, so it has to be
  // declared: Next emits <link rel="icon"> only for the app-router file
  // convention, and a file in `public/` is served but never announced.
  //
  // Both locations at once is the trap. `public/` wins the URL while the app
  // file still generates the tag, so the markup describes one file and the
  // server sends another — verified by serving a marker from `public/` and
  // watching it come back under the app file's declared type and sizes. One
  // location, one source of truth.
  icons: { icon: "/favicon.ico" },
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
