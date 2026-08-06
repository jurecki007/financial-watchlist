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
  // Resolves each page's relative `alternates.canonical` to an absolute URL.
  // Deliberately has no canonical of its own: metadata is inherited, so one
  // here would make every page claim to be the homepage.
  metadataBase: SITE_URL,
  title: "Financial Watchlist",
  description:
    "Track companies, watch prices and charts, read the news that moves them.",
  // The icon lives in `public/`, which Next serves but never announces, so the
  // tag is declared here. Never both locations: `public/` wins the URL while
  // the app-router file still emits the tag, so the markup would describe one
  // file and the server send another.
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Font variables belong on <html>, not <body>: `@theme` resolves
    // `--font-sans` at `:root`, so with the next/font classes on <body> it
    // computed to invalid and every sans surface fell back to the system stack.
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
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
      <body className="antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
