/** /notes — §5.3. Essay 1 ships as a full draft for Collin to edit until it sounds like him; two stubs follow. */

export type Essay = {
  slug: string;
  title: string;
  published: boolean;
  teaser: string;
  /** Paragraphs; empty for stubs. */
  body: string[];
};

export const NOTES_INTRO = "Writing about teaching, tools, and the space between them.";

export const ESSAYS: Essay[] = [
  {
    body: [
      "You cannot make a horse trust a rider. I spent years trying shortcuts, and there aren't any. What you can do — what the whole craft turns out to be — is arrange the conditions under which trust becomes the easiest available behavior. You square the rider's shoulders, you slow the session down, you make the right thing the comfortable thing, and then you wait. The horse decides. That's the job: you don't produce the outcome, you produce the conditions, and you measure yourself by what the two of them can do without you.",
      "A lot of software is engineered to the opposite spec. Growth teams arrange conditions too — that's exactly what a streak, a badge, an infinite feed is. But the behavior they make easiest isn't capability; it's return. The product gets smarter every quarter, fed by everything its users do, while the users stay roughly the same people they were at signup. We've gotten so used to this that we treat it as the natural shape of software. It isn't natural. It's a choice, renewed in every sprint planning meeting where “did they come back?” stands in for “are they better off?”",
      "The riding instructor's success metric is brutal and beautiful: the day the student stops needing you. Lessons end. Schools graduate. A good tutor works deliberately toward their own obsolescence, and the profession celebrates them for it. Software almost never does this, and the honest reason is that retention is revenue. Dependence and product-market fit can look identical on a dashboard. For decades the field's defense was that software couldn't really teach anyway — it could only assist, so endless assistance was the best we could offer.",
      "AI breaks that excuse. A tool that can explain itself, adjust to the learner in front of it, and fade its own scaffolding on purpose is a tool that can genuinely teach — which means “they keep coming back” stops being proof of value and starts being a question. Coming back more capable, or just coming back? The same telemetry can't answer it. You have to decide to measure growth, the way an instructor watches the rider's hands instead of counting lessons sold.",
      "The robotics lab where I worked as a student had a version of this carved into everything it did, and I've carried it through every job since, from hospital classrooms to trading desks: don't ask how smart the machine is. Ask whether the human grew.",
    ],
    published: true,
    slug: "riding-instructors",
    teaser: "You cannot make a horse trust a rider. You can only arrange the conditions where trust becomes the easiest available behavior — and that distinction is the whole argument.",
    title: "What riding instructors know that growth teams don't",
  },
  {
    body: [],
    published: false,
    slug: "silence-is-a-ui-state",
    teaser: "Notes from building voice AI for patients.",
    title: "Silence is a UI state",
  },
  {
    body: [],
    published: false,
    slug: "oxygen-for-non-unicorn-problems",
    teaser: "Some problems deserve solutions, not valuations.",
    title: "Oxygen for non-unicorn problems",
  },
];

export const STUB_LINE = "trail not yet walked — soon";
