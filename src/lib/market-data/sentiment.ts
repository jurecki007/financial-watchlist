/**
 * Headline sentiment, derived locally from the words in the headline.
 *
 * Deliberately NOT an LLM call or a paid sentiment API. Every headline on the
 * news page would be a request, the free tiers do not offer it, and a demo that
 * spends money per headline is a demo nobody can run.
 *
 * The honest framing matters more than the accuracy: this is a lexicon match
 * over financial verbs, not analysis. It is labelled as a signal, never as a
 * judgement, and where the words are mixed or absent it returns "neutral"
 * rather than guessing — a wrong confident tag on financial news is worse than
 * no tag.
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
