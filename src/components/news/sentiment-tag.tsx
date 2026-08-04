import { sentimentOf } from "@/lib/market-data/sentiment";

/**
 * Sentiment tag.
 *
 * NOT colour-coded, and that is the point. Green and red are reserved for price
 * direction throughout this product; borrowing them for a lexicon guess about a
 * headline would dilute what a red number means, which is the one thing the
 * colour rule exists to protect. The tag earns attention through position and
 * the mono face instead.
 *
 * Neutral renders nothing. A tag on every headline is noise, and "neutral" is
 * mostly what the matcher returns when it has no opinion — saying so out loud
 * would dress an absence of signal up as a finding.
 */
export function SentimentTag({ headline }: { headline: string }) {
  const sentiment = sentimentOf(headline);
  if (sentiment === "neutral") return null;

  return (
    <span
      // Framed as what it is: a word match, not analysis.
      title="Derived from wording in the headline, not analysis"
      className="ml-2 inline-block border border-[var(--rule-strong)] px-1.5 py-px align-middle font-mono text-[10px] tracking-wide text-[var(--dim)] uppercase"
    >
      {sentiment === "positive" ? "upbeat" : "downbeat"}
    </span>
  );
}
