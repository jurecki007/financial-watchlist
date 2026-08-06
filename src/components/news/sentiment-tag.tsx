import { sentimentOf } from "@/lib/market-data/sentiment";

/**
 * Deliberately not colour-coded: green and red mean price direction
 * everywhere else, and a lexicon guess should not borrow that weight.
 * Neutral renders nothing rather than dressing up an absence of signal.
 */
export function SentimentTag({ headline }: { headline: string }) {
  const sentiment = sentimentOf(headline);
  if (sentiment === "neutral") return null;

  return (
    <span
      title="Derived from wording in the headline, not analysis"
      className="ml-2 inline-block border border-[var(--rule-strong)] px-1.5 py-px align-middle font-mono text-[10px] tracking-wide text-[var(--dim)] uppercase"
    >
      {sentiment === "positive" ? "upbeat" : "downbeat"}
    </span>
  );
}
