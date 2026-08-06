/**
 * Headline sentiment, matched locally against a lexicon of financial verbs —
 * not an LLM call, which would be a request per headline.
 *
 * Framing matters more than accuracy here: it is labelled a signal, never a
 * judgement, and returns "neutral" rather than guessing. A confident wrong tag
 * on financial news is worse than no tag.
 */
export type Sentiment = "positive" | "negative" | "neutral";

// Verbs and nouns that carry direction in market coverage specifically.
// "Beat", "cut" and "miss" mean something here they do not mean generally.
const POSITIVE = [
  "beat", "beats", "surge", "surges", "surged", "jump", "jumps", "jumped",
  "rally", "rallies", "rallied", "soar", "soars", "soared", "gain", "gains",
  "rise", "rises", "rose", "climb", "climbs", "climbed", "upgrade", "upgrades",
  "outperform", "record high", "tops", "beat estimates",
  "raises guidance", "strong", "profit", "growth", "expands", "wins",
];

const NEGATIVE = [
  "miss", "misses", "missed", "plunge", "plunges", "plunged", "fall", "falls",
  "fell", "drop", "drops", "dropped", "slump", "slumps", "slumped", "sink",
  "sinks", "sank", "tumble", "tumbles", "tumbled", "downgrade", "downgrades",
  "cuts guidance", "lawsuit", "probe", "investigation", "recall", "layoff",
  "layoffs", "loss", "losses", "warns", "warning", "slides", "weak", "decline",
];

export function sentimentOf(headline: string): Sentiment {
  const h = ` ${headline.toLowerCase()} `;
  const hit = (words: string[]) =>
    words.filter((w) => h.includes(` ${w} `) || h.includes(`${w} `)).length;

  const pos = hit(POSITIVE);
  const neg = hit(NEGATIVE);

  // A headline carrying both directions is not neutral by averaging — it is
  // ambiguous, and saying "neutral" is the truthful answer.
  if (pos > 0 && neg > 0) return "neutral";
  if (pos > 0) return "positive";
  if (neg > 0) return "negative";
  return "neutral";
}
