/**
 * /dojo — §5.4. The capability artifact. Fully scripted; every response below is
 * canned and no API is ever called. The skill taught: "three moves of context"
 * (role · constraints · example), practiced against a fictional trip-planning
 * assistant, "Riverbot".
 */

export const DOJO_HEADER = {
  subhead: "90 seconds. No account. No tracking you across the internet. The only score that matters is yours.",
  title: "THE DOJO",
  titleSuffix: "leave knowing one move you didn't have.",
} as const;

export const BASE_PROMPT = "plan me a trip";

/** Screen 1 — TRY. The starving model's confident, useless wall. */
export const USELESS_ANSWER =
  "Great question! Trips really depend on what you're looking for. Colorado has options for everyone: rafting (it depends on the season!), hiking (it depends on your fitness!), hot springs (it depends on your budget!). I'd recommend researching what suits your group, considering weather, and booking in advance — or last-minute, which can also work. Let me know if you'd like more general suggestions!";

export const RATE_RESPONSE = "Correct. It's useless. Not because the model is weak — because it's starving.";

/** Screen 2 — MOVE 1: GIVE IT A ROLE. */
export const ROLES = [
  {
    answer:
      "Let's find your family calm water first. The Lower Canyon float is the run I'd put my own kids on: class II, minimum age six, guides who narrate every riffle before you reach it. Wetsuits and life jackets are included and fitted on shore, where it's calm. Nobody is ever more than twenty feet from a guide, and the photo raft catches the smiles, not the worry.",
    chip: "river guide for nervous families",
    key: "guide",
    prefix: "You are a river guide who specializes in nervous families.",
  },
  {
    answer:
      "Then allow me to suggest the private-charter morning: your own raft and senior guide on the canyon's quietest stretch, launching ahead of the public trips. A riverside table follows — chilled towels, local trout, a view your phone will not do justice to. Transfers from your lodge are handled. You'll touch nothing but the water, and only if you choose to.",
    chip: "luxury concierge",
    key: "concierge",
    prefix: "You are a luxury travel concierge.",
  },
  {
    answer:
      "Okay, broke-but-brave plan: book the weekday afternoon raft slot — same rapids, fewer dollars than Saturday. Split a campsite at the river access (cheapest beds in the canyon, bring earplugs), and the gear's all included so nobody rents a wetsuit twice. Pack your own lunch; buy the photo pack once for the whole group and share it.",
    chip: "budget trip planner for students",
    key: "budget",
    prefix: "You are a budget trip planner for students.",
  },
] as const;

export const ROLE_SENSEI = "Same model. One sentence of role. Notice what it stopped guessing about.";

/** Screen 3 — MOVE 2: GIVE IT CONSTRAINTS. Two sliders → 9 variants (group × fear). */
export const GROUP_SIZES = ["2", "6", "12"] as const;
export const FEAR_LEVELS = ["none", "some", "please-no-rapids"] as const;

/** CONSTRAINT_ANSWERS[groupIndex][fearIndex] — two sentences each. */
export const CONSTRAINT_ANSWERS: string[][] = [
  [
    "For two fearless paddlers, skip the big raft: take inflatable kayaks down the class III stretch, one each. You'll earn every splash and have no one to blame but each other.",
    "For two of you with a few butterflies, a guided half-day raft on class II-III water is the sweet spot. You'll share a boat with a calm crew and a guide who reads the river out loud.",
    "Two people, zero rapids: take the scenic float — flat, slow water with canyon walls doing all the drama. Bring binoculars; this stretch is where the herons hang out.",
  ],
  [
    "Six thrill-seekers fill exactly one raft — your crew, your guide, nobody else's elbows. Go full-day class III-IV and argue about who screamed at the wave train.",
    "Six with mixed nerves still fits one raft, which is the point: you stay together. The class II-III half-day has enough splash for the bold and enough calm for the rest.",
    "Six and strictly no rapids: the morning float plus the canyon zipline keeps everyone moving without a single wave. The water stays flat; the adrenaline comes from the cables.",
  ],
  [
    "Twelve confident paddlers means a two-raft convoy, and yes, the guides will let you race. Book the full-day run with the canyon lunch beach — it's built for groups exactly like yours.",
    "Twelve with a range of courage splits perfectly: one raft takes the spicier line, one takes the gentle one, and you reunite at the same lunch beach. Everyone gets the trip they wanted and the same stories at dinner.",
    "Twelve, no rapids, no problem: charter the flat-water float with a riverside picnic — it runs rain or shine and nobody gets splashed past the knees. The hardest part is herding twelve people into the vans by 8:45.",
  ],
];

export const CONSTRAINT_SENSEI = "Constraints aren't limits on the model. They're limits on its hallucinations.";

/** Screen 4 — MOVE 3: SHOW AN EXAMPLE. Two output formats. */
export const FORMATS = [
  {
    answer: {
      intro: "Your river day, in the format you asked for:",
      rows: [
        ["8:00", "Coffee at the outpost; waivers and wetsuit fitting"],
        ["8:45", "Vans to the put-in — guide talk on the way"],
        ["9:30", "On the water (the stretch your sliders picked)"],
        ["12:30", "Lunch beach: tacos, sun, optional cliff-jump photos"],
        ["14:00", "Back at the outpost; photos ready by 15:00"],
      ],
    },
    example: "format it like: 8:00 — coffee · 9:30 — on the water",
    key: "day-grid",
    label: "a day-grid schedule",
  },
  {
    answer: {
      checklist: ["swimsuit worn under clothes (changing rooms are scarce)", "water shoes or old sneakers — no flip-flops on a raft", "sunscreen, applied before the wetsuit goes on", "dry change of clothes left in the van", "cash tip for your guide (they earn it)"],
      intro: "Pack this, then show up — the plan runs itself:",
      outro: "Trip: morning check-in, guided float on your chosen stretch, lunch beach, back by 14:00.",
    },
    example: "format it like a packing checklist first, plan second",
    key: "packing-first",
    label: "a packing-first checklist",
  },
] as const;

export const FORMAT_SENSEI = "You just taught it. That's all teaching a model is — showing, not hoping.";

/** Screen 5 — LEVEL UP. */
export const LEVEL_UP = {
  buttons: [
    { href: "/notes", label: "read why this matters →" },
    { href: "/", label: "who built this →" },
  ],
  cheatLine: "role + constraints + example",
  honest: "Total canned demo, by the way — no model was called. The moves are real. Try them on a live one tonight.",
  recap: [
    { move: "GIVE IT A ROLE", plain: "Tell it who it is. One sentence kills a page of guessing." },
    { move: "GIVE IT CONSTRAINTS", plain: "Say what's true about your situation. Every fact you add is a hallucination you subtract." },
    { move: "SHOW AN EXAMPLE", plain: "Paste the shape you want back. Showing beats describing, every time." },
  ],
  title: "+1 LEVEL — that was YOUR level, not ours.",
} as const;

export const SCREEN_LABELS = ["TRY", "MOVE 1 — GIVE IT A ROLE", "MOVE 2 — GIVE IT CONSTRAINTS", "MOVE 3 — SHOW AN EXAMPLE", "LEVEL UP"] as const;
