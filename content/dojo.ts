/**
 * /dojo v2 — "FIND THE FLAW".
 * The durable human skill of the AI era isn't writing prompts — it's catching
 * machines being confidently wrong. Ten confident answers, each hiding exactly
 * one planted, realistic flaw. The visitor clicks the sentence they distrust;
 * the verdict names the failure-mode category so the learning transfers.
 *
 * Fully scripted: no model is called, nothing is tracked, scores live and die
 * in the tab. Every item drafted for Collin to author or heavily edit — the
 * non-flaw sentences must stay true, and the flaws genuinely good fakes.
 */

export const DOJO_HEADER = {
  subhead: "90 seconds. No account. No tracking you across the internet. The only score that matters is yours.",
  title: "THE DOJO",
  titleSuffix: "leave knowing one move you didn't have.",
} as const;

export const PREMISE = {
  body: "The durable skill of the AI era isn't writing prompts — it's catching machines being confidently wrong. Below are ten confident answers. Each contains exactly one planted flaw. Click the sentence you don't trust.",
  senseiIntro: "Ten answers. Each hides exactly one flaw. Trust nothing on style.",
  start: "▶ BEGIN — ITEM 1 OF 10",
} as const;

export type DojoItem = {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  /** Failure-mode label — the thing that transfers. */
  category: string;
  /** 4-6 confident sentences; exactly one is wrong. */
  sentences: string[];
  /** Optional code block shown between the prose and the choices. */
  code?: string;
  flawIndex: number;
  /** Two lines: why it's wrong + why this failure mode survives review. */
  explanation: string;
};

export const ITEMS: DojoItem[] = [
  {
    category: "fabricated statistic",
    difficulty: "easy",
    explanation: "That suspiciously precise number is invented — no such 2021 census exists. Decimal-point precision is the tell: nobody can measure what they haven't discovered yet.",
    flawIndex: 2,
    id: "pacific",
    sentences: [
      "The Pacific is the largest ocean on Earth, covering more area than all the continents combined.",
      "It holds roughly half of the world's ocean water.",
      "A 2021 census of marine life concluded that 84.6% of Pacific species remain undiscovered.",
      "The Mariana Trench, the deepest known point in any ocean, lies in the western Pacific.",
      "Despite its name, the Pacific hosts most of Earth's active volcanoes along the Ring of Fire.",
    ],
  },
  {
    category: "wrong date",
    difficulty: "easy",
    explanation: "Apollo 17 left the Moon in December 1972, not 1975. Dates that are merely “about right” are where confident answers drift — close enough to read past, wrong all the same.",
    flawIndex: 3,
    id: "apollo",
    sentences: [
      "NASA's Apollo program put twelve astronauts on the lunar surface between 1969 and 1972.",
      "Apollo 11's Eagle lander touched down in the Sea of Tranquility in July 1969.",
      "Apollo 13 never landed; an oxygen tank exploded en route and the crew returned safely.",
      "The final mission, Apollo 17, left the Moon in December 1975, and no human has walked there since.",
      "Apollo 17's crew included Harrison Schmitt, the only professional geologist to walk on the Moon.",
    ],
  },
  {
    category: "unit error",
    difficulty: "medium",
    explanation: "Moonlight reaches Earth in about 1.3 seconds, not minutes. The digits were right and the unit wasn't — unit slips survive because the number looks correct at a glance.",
    flawIndex: 1,
    id: "moonlight",
    sentences: [
      "The Moon orbits Earth at an average distance of about 384,000 kilometers.",
      "Reflected sunlight from the Moon takes about 1.3 minutes to reach your eyes.",
      "Because the Moon's orbit is slightly elliptical, its apparent size in our sky varies — the origin of so-called supermoons.",
      "The same face of the Moon always points toward Earth, because its rotation is tidally locked to its orbit.",
      "The Moon drifts about 3.8 centimeters farther from Earth each year, measured with laser reflectors the Apollo crews left behind.",
    ],
  },
  {
    category: "hallucinated API",
    difficulty: "medium",
    explanation: "There is no Array.prototype.unique() in JavaScript — the real one-liner is [...new Set(values)]. Hallucinated methods look exactly like real ones; the only defense is the docs.",
    flawIndex: 1,
    id: "unique",
    sentences: [
      "Removing duplicates from a JavaScript array is a one-liner in modern engines.",
      "Every array ships with a built-in unique() method, so values.unique() returns the deduplicated array.",
      "Building a Set also works — [...new Set(values)] stores each value once and spreads back into an array.",
      "For arrays of objects, neither approach compares by content: Sets dedupe object references, not deep equality.",
      "ES2023 added immutable helpers like toSorted() and toReversed() that return new arrays instead of mutating.",
    ],
  },
  {
    category: "false attribution",
    difficulty: "medium",
    explanation: "Einstein never said it — the line first surfaces in 1980s addiction-recovery literature. Quotes migrate toward famous names; an attribution is a claim like any other.",
    flawIndex: 2,
    id: "einstein",
    sentences: [
      "Albert Einstein won the 1921 Nobel Prize in Physics for the photoelectric effect, not for relativity.",
      "He spent his later years at the Institute for Advanced Study in Princeton, chasing a unified field theory.",
      "He also left us a definition of madness, famously writing that insanity is “doing the same thing over and over again and expecting different results.”",
      "His 1905 “miracle year” papers covered Brownian motion, special relativity, and mass–energy equivalence.",
      "Time magazine named him Person of the Century in 1999.",
    ],
  },
  {
    category: "plausible-but-wrong history",
    difficulty: "medium",
    explanation: "The library declined over centuries; Caesar's fire damaged it at most partially, and no single documented blaze ended it. Tidy, dramatic endings are a hallmark of plausible-but-wrong history.",
    flawIndex: 3,
    id: "alexandria",
    sentences: [
      "The Library of Alexandria was founded in the early third century BC under the Ptolemaic dynasty.",
      "It formed part of a larger research institution, the Mouseion, which housed salaried scholars.",
      "Estimates of its collection vary enormously, from tens of thousands to several hundred thousand scrolls.",
      "Its end is well documented: the entire collection burned in a single catastrophic fire during Julius Caesar's siege in 48 BC.",
      "Alexandria itself remained a major center of learning well into late antiquity.",
    ],
  },
  {
    category: "reversed causality",
    difficulty: "hard",
    explanation: "The arrow points the other way: being tall gets you selected into elite basketball — playing it doesn't make you taller. When two things travel together, ask which causes which.",
    flawIndex: 2,
    id: "height",
    sentences: [
      "The average NBA player stands about six feet six inches, nearly a foot above the average American man.",
      "Height correlates with success at nearly every position, though guards run shorter than centers.",
      "This is partly because intensive basketball training during adolescence stimulates bone growth, adding measurable height by adulthood.",
      "Scouts evaluate wingspan alongside height, since reach shapes both shooting and defense.",
      "Shorter players still reach the Hall of Fame — Allen Iverson was listed at six feet even.",
    ],
  },
  {
    category: "base-rate neglect",
    difficulty: "hard",
    explanation: "At 1-in-10,000 prevalence, a beep is roughly 1% likely to be real — one true hit drowns in about a hundred false alarms. “Accuracy” never answers “what does a positive mean”; base rates do.",
    flawIndex: 2,
    id: "scanner",
    sentences: [
      "Imagine an airport scanner that correctly flags 99 of every 100 prohibited items, and wrongly beeps at just 1 of every 100 clean bags.",
      "Suppose only one bag in ten thousand actually contains a prohibited item.",
      "So when the scanner beeps at a bag, there is roughly a 99 percent chance the bag contains one.",
      "Screeners still resolve every beep with a hand search, which is why secondary inspection exists.",
      "The same arithmetic governs spam filters and medical screening alike.",
    ],
  },
  {
    category: "off-by-one",
    difficulty: "hard",
    explanation: "The condition i < prices.length - 1 stops one short — the last price never lands in the total. Off-by-ones live exactly where code reads fine and runs wrong.",
    flawIndex: 2,
    id: "cart",
    code: `function sumPrices(prices) {
  let total = 0;
  for (let i = 0; i < prices.length - 1; i++) {
    total += prices[i];
  }
  return total;
}`,
    sentences: [
      "This helper computes a cart total in plain JavaScript.",
      "It initializes an accumulator to zero before the loop begins.",
      "The loop walks the entire array, so every element of prices is added to the total.",
      "Because it only reads from the array, the function has no side effects on its input.",
      "An empty cart returns zero, since the loop body never executes.",
    ],
  },
  {
    category: "citation mismatch",
    difficulty: "hard",
    explanation: "The citation is real; the claim isn't in it. Miller measured short-term span — long-term memory has no seven-item cap. The most durable errors hide behind genuine references.",
    flawIndex: 2,
    id: "miller",
    sentences: [
      "Working memory is strikingly small relative to everything else the brain does.",
      "George Miller's 1956 paper “The Magical Number Seven, Plus or Minus Two” is among the most cited in psychology.",
      "In it, Miller showed that long-term memory tops out at about seven items, which is why phone numbers were designed with seven digits.",
      "Later work suggests the true short-term span is closer to four chunks for most material.",
      "Chunking — grouping digits into meaningful units — is how people stretch that limit every day.",
    ],
  },
];

export const VERDICT = {
  correct: "Caught. That one was {category}.",
  wrong: "It slipped past — the flaw was sentence {n}: {category}.",
} as const;

export const END = {
  buttons: [
    { href: "/notes/riding-instructors", label: "read why this matters →" },
    { href: "/", label: "who built this →" },
  ],
  closing: "You caught {n}/10. The errors here were planted by a human. Real ones won't announce themselves — that's the skill.",
  honest: "Planted by a human, scored in your browser, forgotten when you close the tab — no model was called, and nothing about you leaves this page.",
  perfectNote: "Nothing got past you this round.",
  replay: "↺ RUN IT AGAIN — different order, same flaws",
  roundNote: "Round 2 is harder by design — holding your accuracy there is the real improvement.",
  slippedLabel: "Got past you:",
  title: "+1 LEVEL — that was YOUR level, not ours.",
} as const;
