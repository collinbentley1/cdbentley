/** The Journey (/) — §5.1 of the design brief, origin-first. Copy is final-draft; Collin gives every line a pass before merge. */

export type Chip = {
  label: string;
  /** 0-5 bar segments that fill on reveal; null renders a plain badge. */
  level: number | null;
  mastered?: boolean;
};

export type Companion = "horse" | "bulldog" | "robot" | "crane" | "pigeon" | "pear";

export type Scene = {
  key: string;
  kicker: string;
  title: string;
  role: string;
  body: string;
  companion: Companion | null;
  chips: Chip[];
  marginNote: string | null;
  /** Extra trail beats before this scene (1 = standard gap, 2 = thesis beat). */
  beat: number;
  signposts?: Array<{ label: string; href: string }>;
};

export const HUD_CHIP = "TRAINER · LV. 29 — STILL LEVELING";
export const TRAILHEAD = {
  bubble: "Hi, I'm Collin!",
  marginNote: "follow the trail ↓",
  subtitle: "The journey of a teacher who builds",
  title: "COLLIN",
} as const;

export const SCENES: Scene[] = [
  {
    beat: 1,
    body: "Before software: horses. Teaching a nervous rider to trust a thousand-pound animal taught me the whole job — patience first, trust second, technique a distant third. The best feedback loops don't say a word.",
    chips: [{ label: "TRUST", level: 5 }],
    companion: "horse",
    key: "stables",
    kicker: "THE STABLES",
    marginNote: "it starts with listening",
    role: "Riding & Equine Therapy Instructor",
    title: "THE STABLES",
  },
  {
    beat: 1,
    body: "Computer science by day; by night, producing a dozen plays and musicals on a $200k budget. I learned that shipping is a team sport, and the most important seat I added to our board was a fully-empowered inclusion officer. Most inclusive season in the Dramat's history.",
    chips: [
      { label: "LOGIC", level: 5 },
      { label: "STAGECRAFT", level: null },
    ],
    companion: "bulldog",
    key: "yale",
    kicker: "YALE",
    marginNote: null,
    role: "Computer Science · Dramat President",
    title: "YALE",
  },
  {
    beat: 2,
    body: "In Yale's Socially Assistive Robotics Lab, the robots weren't the point — the kids were. A robot that helps a child practice eye contact succeeds only when the child stops needing it. The question that lab burned into me: don't ask how smart the machine is. Ask whether the human grew.",
    chips: [{ label: "HUMAN-CENTERED AI", level: 5 }],
    companion: "robot",
    key: "sar-lab",
    kicker: "THE ROBOT ROOM",
    marginNote: "← the whole thesis",
    role: "Socially Assistive Robotics Lab",
    title: "THE ROBOT ROOM",
  },
  {
    beat: 1,
    body: "First job mixing the two loves: making it easier for clinicians and hospital staff to learn new things. Friction, it turns out, is the real enemy of learning — not difficulty.",
    chips: [{ label: "LEARNING DESIGN", level: 5 }],
    companion: null,
    key: "yale-med",
    kicker: "YALE MED",
    marginNote: null,
    role: "Learning & Development Technology",
    title: "YALE MED",
  },
  {
    beat: 1,
    body: "A year teaching computer science and robotics to young learners in Beijing. My students' science and reading scores climbed a full grade-level past previous cohorts — but the real curriculum was watching a seven-year-old realize she could make the robot obey *her*.",
    chips: [{ label: "TEACHING", level: 5, mastered: true }],
    companion: "crane",
    key: "beijing",
    kicker: "BEIJING",
    marginNote: "scores up a full grade-level",
    role: "Educator, AndKids International School",
    title: "BEIJING",
  },
  {
    beat: 1,
    body: "Four years incubating products inside one of America's largest health companies. The one I'm proudest of listened quietly during home-health visits so nurses could keep their eyes on the patient instead of the paperwork. Ambient AI, before that was a category — and my crash course in multimodal LLMs, regulated data, and earning clinical trust.",
    chips: [
      { label: "AMBIENT AI", level: 5 },
      { label: "SHIPPING IN REGULATED WORLDS", level: null },
    ],
    companion: "pigeon",
    key: "humana",
    kicker: "HUMANA",
    marginNote: null,
    role: "Senior PM, Incubation Lab · 4 years, NYC",
    title: "HUMANA",
  },
  {
    beat: 1,
    body: "A warm voice that checks in on patients between appointments — listening, remembering, keeping care continuous through the long quiet. Voice AI taught me that tone is a feature and silence is a UI state.",
    chips: [{ label: "VOICE AI", level: 5 }],
    companion: null,
    key: "healthyr",
    kicker: "HEALTHYR",
    marginNote: null,
    role: "Principal Product Manager",
    title: "HEALTHYR",
  },
  {
    beat: 1,
    body: "Started a company with two friends. v1 rebuilt the trading desk's operating system; v2 gave a Colorado rafting outfitter its own front door inside ChatGPT and Claude. We're winding it down on purpose: the problems we love weren't a ten-billion-dollar company, and we think they deserve solutions anyway. That belief is where I'm headed next.",
    chips: [
      { label: "FOUNDER", level: 5 },
      { label: "MCP", level: 5, mastered: true },
    ],
    companion: "pear",
    key: "otseek",
    kicker: "OTSEEK",
    marginNote: null,
    role: "Co-Founder · PearX W26",
    signposts: [
      { href: "/work", label: "see the work →" },
      { href: "/dojo", label: "train with me →" },
    ],
    title: "OTSEEK",
  },
  {
    beat: 1,
    body: "Every chapter was the same job in different clothes: help someone become more capable than they were yesterday, then get out of the way. These days the someone is anyone using AI — and the classroom got very, very big.",
    chips: [],
    companion: null,
    key: "now",
    kicker: "NOW",
    marginNote: "stars out",
    role: "",
    title: "NOW",
  },
];

export const ENDCAP = {
  buttons: [
    { href: "/work", label: "THE WORK" },
    { href: "/dojo", label: "THE DOJO" },
    { href: "/notes", label: "THE NOTES" },
  ],
  sub: "THE STORY KEEPS LEVELING UP",
  tbc: "to be continued…",
} as const;
