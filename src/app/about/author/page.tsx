import type { Metadata } from "next";
import { Container } from "@/components/ui/shell";

export const metadata: Metadata = {
  title: "The author — Financial Watchlist",
  description:
    "Maciej Sacewicz — full-stack and embedded developer in Białystok. Agency work in Belgium, SaaS for Polish marketplaces, IoT firmware at YOSENSI.",
  alternates: { canonical: "/about/author" },
};

/**
 * Who built this.
 *
 * Reverse-chronological, newest first — the order a recruiter reads in, where
 * the top of the list is the answer to "what are they doing now". An earlier
 * draft ran oldest-first as a narrative; that reads better end to end and worse
 * when skimmed, and skimming is what this page is for.
 *
 * The header is centred and the entries are not, deliberately. Centring a
 * summary block sets it apart as a header; centring the entries would cost the
 * left edge that makes the period gutter scannable.
 */

type Entry = {
  period: string;
  title: string;
  place?: string;
  body: string[];
  stack?: string;
};

const ENTRIES: Entry[] = [
  {
    period: "2025",
    title: "klucze-bialystok.pl",
    place: "locksmith, Białystok",
    body: [
      "A complete digital presence for a local client. I rebuilt the site from scratch, wired up GA4 analytics and conversion tracking, and launched a Google Ads campaign. First week: 4,000 zł in revenue on an 800 zł monthly budget — 5× ROAS from day one. Ongoing monthly content and performance reporting.",
      "Writing SEO posts by hand is exactly the kind of work that should not need a human every time, so I automated it: GitHub Actions triggers the Gemini API to draft a post, a human reviews and approves, and it publishes to the Next.js site automatically. Zero ongoing cost.",
    ],
    stack: "Next.js · GA4 · Google Ads · GitHub Actions · Gemini API",
  },
  {
    period: "2024 – present",
    title: "YOSENSI",
    place: "current role",
    body: [
      "YOSENSI builds IoT wireless sensor networks — hardware that measures air quality, temperature, humidity and particulate matter, transmitting over LoRaWAN and BLE. Calling it a day job undersells it, because it spans both sides of the stack.",
      "On the software side I built and maintain a React Native / Expo device-management app used internally to discover, identify and monitor sensor nodes over Bluetooth, and overhauled the internal firmware upload tool with a full UI redesign and node search by identifier. I own the content and tooling on the support site and manage product listings.",
      "On the engineering side: firmware in C and C++ on STM32 microcontrollers running Zephyr RTOS and Mbed OS. I was the first engineer here to adopt Zephyr — brought it up from zero, documented it, and it became the company standard. Around 25 firmware modules for Bosch, Panasonic and STMicroelectronics sensors covering temperature, humidity, particulate matter, TVOC, gas, pressure, motion and QVAR.",
      "I also built the internal warehouse cost dashboard, which queries TME, Mouser, Farnell and DigiKey APIs in real time to calculate per-unit production cost for each sensor node. And I have been running pre-certification for a LoRaWAN gateway — UKCA, CE and FCC — writing automated RF test scripts for an anechoic chamber, self-teaching EMI/EMC from scratch, and coordinating directly with certification laboratories.",
    ],
    stack: "C · C++ · STM32 · Zephyr RTOS · Mbed OS · React Native · Expo",
  },
  {
    period: "2024 – present",
    title: "Voya",
    place: "voya.com.pl",
    body: [
      "A photobook e-commerce platform. Customers design and order custom photobooks and the platform handles everything from order placement to shipping-label generation.",
      "The part that mattered most was payment integrity: Stripe with idempotency keys, webhook validation and explicit order state management, because double-charging real customers is the failure you do not get to apologise your way out of. Furgonetka for automated shipping, Resend for transactional email, Supabase Edge Functions for order processing.",
      "A full staging environment mirrors production exactly — Vercel preview branch, isolated Supabase database, Stripe test mode. The site is live with paying customers.",
    ],
    stack: "Next.js · Supabase · PostgreSQL · Stripe · Furgonetka · Resend · Vercel",
  },
  {
    period: "2024 – present",
    title: "Swiftlist",
    place: "for 24BHPro",
    body: [
      "A client selling on Allegro, Poland's dominant marketplace, had an arithmetic problem: updating one product — shoes, say — meant editing 12 size variants across 100+ products. Over 1,200 individual edits per update cycle, several times a week.",
      "Swiftlist is a SaaS platform that connects to Allegro's REST API, allows bulk listing creation and editing in a single action, and syncs inventory back to the client's own site through scheduled cron jobs. What took hours takes one click. Currently expanding to Empik and Amazon.",
    ],
    stack: "TypeScript · Node.js · Supabase · Allegro REST API",
  },
  {
    period: "2024",
    title: "iOS scheduling app",
    place: "cosmetics industry",
    body: [
      "A custom iOS schedule-management application built for a client in the cosmetics sector. Delivered directly and not publicly available.",
    ],
    stack: "Swift · SwiftUI",
  },
  {
    period: "2023 – 2024",
    title: "NYS Dashboard",
    place: "New York",
    body: [
      "A contact at Bloomberg had an idea: help used-car dealerships work out which cars actually sell in their area. I partnered with a friend holding a master's in AI and LLMs and we built a working demo for the New York region.",
      "My side: collecting and processing New York DMV vehicle registration data with Python, running the ETL pipeline through self-hosted n8n on paid infrastructure to handle the volume, building the React frontend and Supabase backend, and wiring Resend for automated daily reports to stakeholders. His side: a predictive model trained on the data I collected and filtered, outputting the ten predicted best-selling vehicles per region.",
      "The dashboard combined real historical trends with predicted ones in a single investor-facing interface. We pitched. They said we were asking too much, and the project went into storage — the demo is still live.",
    ],
    stack: "Python · n8n · React · Supabase · Resend",
  },
  {
    period: "2019 – 2023",
    title: "Web agency, sole developer",
    place: "Belgium",
    body: [
      "Co-ran an informal web agency for four years as the only developer. My partner handled clients and marketing; I built everything. Between 10 and 20 commercial projects — restaurants wanting a first online presence, local shops going digital, a designer brand store, a barber shop, e-commerce built from scratch. Belgian and French clients, real budgets, real deadlines.",
      "The stack evolved as I did: React, Node.js, JavaScript, TypeScript, Supabase, Firebase, and early workflow automation with n8n before I moved to more backend-first approaches. When I relocated to Poland in 2023 we closed the agency, and my partner went on to found Fidelis Agency under the name we had been building together.",
    ],
    stack: "React · Node.js · TypeScript · Supabase · Firebase · n8n",
  },
];

function Work({ entry }: { entry: Entry }) {
  return (
    <article className="grid gap-x-8 gap-y-3 border-t border-[var(--rule)] py-7 sm:grid-cols-[9rem_1fr]">
      {/* Mono period in a left gutter — the same scanning device the news list
          uses for tickers, so the two read as one system. */}
      <div className="font-mono text-xs whitespace-nowrap text-[var(--dim)]">
        {entry.period}
      </div>
      <div className="min-w-0">
        <h3 className="text-base font-medium">
          {entry.title}
          {entry.place && (
            <span className="ml-2 font-normal text-[var(--dim)]">
              {entry.place}
            </span>
          )}
        </h3>
        <div className="mt-2.5 space-y-3">
          {entry.body.map((p, i) => (
            <p
              key={i}
              className="max-w-[62ch] text-sm leading-relaxed text-[var(--dim)]"
            >
              {p}
            </p>
          ))}
        </div>
        {entry.stack && (
          <p className="mt-3.5 font-mono text-[11px] leading-relaxed text-[var(--faint)]">
            {entry.stack}
          </p>
        )}
      </div>
    </article>
  );
}

export default function AuthorPage() {
  return (
    <Container>
      {/* Centred, and only this block. `mx-auto` on the measure-capped prose
          rather than on the header itself, so the copy stays inside a readable
          column instead of stretching to the container and merely being
          centre-aligned inside it. */}
      <header className="mb-12 text-center">
        <h1 className="text-3xl font-medium tracking-tight">Maciej Sacewicz</h1>
        <p className="mx-auto mt-3 max-w-[58ch] text-base leading-relaxed text-[var(--dim)]">
          A developer who builds things that actually ship. Seven years across
          agency work, e-commerce, SaaS and embedded firmware — usually as the
          person responsible for the whole thing working, not one layer of it.
        </p>

        {/* The definition pairs stay left-aligned within their own cells. A
            centred term over centred prose gives two ragged edges per cell and
            nothing to scan down; the block is centred on the page, the facts
            inside it are not. */}
        <dl className="mx-auto mt-8 grid max-w-[46rem] gap-x-8 gap-y-4 text-left text-sm sm:grid-cols-2">
          <div>
            <dt className="font-mono text-xs text-[var(--dim)]">Right now</dt>
            <dd className="mt-1">
              Firmware and software at YOSENSI (IoT sensor networks), plus
              Swiftlist and Voya in production for clients.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs text-[var(--dim)]">Based in</dt>
            <dd className="mt-1">
              Białystok, Poland. Belgian and Polish citizenship; Polish, French
              and English.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs text-[var(--dim)]">Studied</dt>
            <dd className="mt-1">
              Computer science at HE2B ESI, Brussels — the first student in the
              institution&rsquo;s history to receive a grade of 22/20.
            </dd>
          </div>
          <div>
            <dt className="font-mono text-xs text-[var(--dim)]">Contact</dt>
            <dd className="mt-1">
              <a
                href="mailto:sacewicz.maciej3@gmail.com"
                className="text-[var(--gold)] transition-opacity hover:opacity-80"
              >
                sacewicz.maciej3@gmail.com
              </a>
            </dd>
          </div>
        </dl>
      </header>

      <h2 className="mb-1 font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
        The work
      </h2>
      <div>
        {ENTRIES.map((e) => (
          <Work key={`${e.period}-${e.title}`} entry={e} />
        ))}
      </div>

      <section className="mt-12 border-t border-[var(--rule)] pt-8">
        <h2 className="mb-3 font-mono text-xs tracking-[0.18em] text-[var(--dim)] uppercase">
          And this one
        </h2>
        <p className="max-w-[62ch] text-sm leading-relaxed text-[var(--dim)]">
          Financial Watchlist was built as a demo — to show what I ship in a
          focused stretch of time. Real market data, TradingView charts, price
          alerts evaluated on a schedule, row-level security at the database
          rather than in the interface. The same patterns I use in production,
          not a shortcut version of them. The reasoning behind each decision is
          written up on{" "}
          <a
            href="/about/project"
            className="text-[var(--gold)] transition-opacity hover:opacity-80"
          >
            the project page
          </a>
          , and the code is on{" "}
          <a
            href="https://github.com/jurecki007/financial-watchlist"
            className="text-[var(--gold)] transition-opacity hover:opacity-80"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </Container>
  );
}
