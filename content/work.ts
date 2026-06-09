/**
 * /work — five evidence pages (§5.2). Uniform template:
 * problem → what I built → live demo → build notes → what it taught me → links.
 * [CONFIRM-2]: the rafting operator is anonymized until Collin resolves naming.
 * [CONFIRM-3]: critical-history copy stays generic until Collin confirms scope.
 */

export type WorkLink = { href: string; label: string };

export type MedlockDemo = {
  kind: "medlock";
  endpoint: string;
  tools: Array<{
    name: string;
    blurb: string;
    request: string;
    response: string;
  }>;
};

export type AvaDemo = {
  kind: "ava";
  turns: Array<{
    user: string;
    tool: { name: string; note: string };
    assistant: string;
    durableObjectWrite: boolean;
  }>;
};

export type OtseekDemo = {
  kind: "otseek";
  lanes: Array<{ branch: string; agent: string }>;
  caption: string;
};

export type RunsettaDemo = {
  kind: "runsetta";
  pace: string[];
  weather: string[];
  mood: string[];
  /** lines[pace][mood][weather] */
  lines: string[][][];
};

export type HistoryDemo = {
  kind: "critical-history";
  entries: Array<{ label: string; note: string; x: number; y: number }>;
};

export type WorkDemo = MedlockDemo | AvaDemo | OtseekDemo | RunsettaDemo | HistoryDemo;

export type WorkPage = {
  slug: string;
  title: string;
  strap: string;
  problem: string;
  built: string[];
  demoTitle: string;
  demo: WorkDemo;
  buildNotes: string[];
  taught: string;
  links: WorkLink[];
};

export const WORK_PAGES: WorkPage[] = [
  {
    buildNotes: [
      "Cloud Run + Terraform + GitHub OIDC — no long-lived deploy keys.",
      "PR-preview environments and Docker Hardened Images, on the same GitOps platform as this site.",
      "Pure Bun runtime; the MCP server uses @modelcontextprotocol/server over the WebStandard Streamable HTTP transport.",
    ],
    built: [
      "A pure-Bun MCP server (Streamable HTTP) plus the site that explains it. The public deployment serves deterministic demo vitals, so anyone can connect it to Claude safely; private deployments point the same tool surface at your own Solid Pod behind bearer auth.",
      "Tools: solid_fetch_vitals (read-only by design) and vitals_scan, which hands the camera step to the browser — the server can't touch hardware. It also ships a medlock://context resource so the model gets deployment and safety context, not just the human.",
    ],
    demo: {
      endpoint: "https://medlock.ai/api/mcp",
      kind: "medlock",
      tools: [
        {
          blurb: "Read-only vitals from the demo pod",
          name: "solid_fetch_vitals",
          request: `{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "solid_fetch_vitals",
    "arguments": {}
  }
}`,
          response: `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "demo pod vitals —
      heart_rate: 62 bpm
      blood_pressure: 118/76
      spo2: 98%
      source: deterministic demo
      (public deploys never serve
      real patient data)"
    }]
  }
}`,
        },
        {
          blurb: "Prepare a browser scan handoff",
          name: "vitals_scan",
          request: `{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "vitals_scan",
    "arguments": {}
  }
}`,
          response: `{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{
      "type": "text",
      "text": "scan ready — open the
      handoff URL in your browser.
      The camera activates there,
      never from this server."
    }]
  }
}`,
        },
      ],
    },
    demoTitle: "TRY IT AGAINST THE DEMO POD",
    links: [
      { href: "https://medlock.ai", label: "medlock.ai" },
      { href: "https://github.com/collinbentley1/medlock", label: "source on GitHub" },
    ],
    problem: "AI assistants are useful exactly in proportion to what they know about you — and health data is the last thing you should hand to a black box.",
    slug: "medlock",
    strap: "Your health data, on a leash you hold.",
    taught: "Consent isn't a checkbox, it's an architecture. Read-only tools, demo-by-default data, and handing hardware access to the user's own browser made “safe” the path of least resistance.",
    title: "medlock",
  },
  {
    buildNotes: [
      "Lazy first-request schema creation and seeding, so a fresh deploy answers smoke tests before any credentials exist.",
      "Origin allowlists for chatgpt.com and claude.ai; idempotency keys scoped per itinerary.",
      "Assets on Workers Assets with edge cache — keep media out of D1 rows.",
      "Ventrata OCTO checkout bridge with test/live environment gating.",
    ],
    built: [
      "A self-hostable, MIT-licensed ChatGPT App / Claude Connector backend the operator runs on their own Cloudflare account, one click. A Worker speaks MCP JSON-RPC at /mcp; D1 holds catalog, knowledge, itineraries, and idempotency records.",
      "A Durable Object per itinerary serializes writes so model retries and double-clicked widgets can't double-book a raft. Vectorize powers semantic search over trips and operator knowledge, with a lexical fallback when unconfigured. Their existing WordPress content syncs in through a small plugin — app passwords, no admin cookies.",
      "Tools include create-recommendation-profile, search-attractions, and the planning, itinerary, quote, and checkout-handoff flow.",
    ],
    demo: {
      kind: "ava",
      turns: [
        {
          assistant: "I can help with that! To point you at the right water, a quick profile: how comfortable is your crew with rapids, and what ages am I planning for?",
          durableObjectWrite: false,
          tool: { name: "create-recommendation-profile", note: "Builds a reusable trip profile the rest of the tools can read." },
          user: "We're a family of five heading to Colorado in July. Can you plan us a river day?",
        },
        {
          assistant: "With kids of eight and eleven who'd like “splashy but not scary,” the Lower Canyon half-day float fits best — class II-III water, minimum age six, guides who do this run daily. The Royal Gorge route is the one to save for when the kids are older.",
          durableObjectWrite: false,
          tool: { name: "search-attractions", note: "Semantic search over the operator's trips and knowledge base (Vectorize)." },
          user: "Kids are 8 and 11. Splashy but not scary. Morning if possible.",
        },
        {
          assistant: "Done — here's your river day: 8:45 check-in at the outpost, 9:30 Lower Canyon float (about 3 hours on the water), wetsuits included, back by 1:00 for lunch. I've held it as an itinerary; checkout happens with the operator directly.",
          durableObjectWrite: true,
          tool: { name: "plan-itinerary", note: "One Durable Object per itinerary — repeated clicks and model retries serialize to a single write. No double-booked rafts." },
          user: "Perfect. Book the morning float for the five of us.",
        },
      ],
    },
    demoTitle: "PLAN A RIVER DAY",
    links: [],
    problem: "When travelers start planning trips inside AI assistants, who owns the relationship — the platform, an aggregator, or the small operator running the rafts? We bet it should be the operator.",
    slug: "ava",
    strap: "A rafting company's front door inside ChatGPT and Claude.",
    taught: "Distribution is the new shelf space; giving a small business ownership of its AI integration — deployable to their own account, readable by their own dev — is the difference between renting a future and having one. Also: serialize your writes; agents retry.",
    title: "AVA",
  },
  {
    buildNotes: [
      "CRM service with its own Postgres and its own MCP endpoint.",
      "FastAPI auth via WorkOS; Next.js workspaces for marketing, auth, app, and docs.",
      "Infisical-injected secrets with --watch restarts; Datadog checks; Alembic migrations.",
      "Post-merge hooks rebuild the CLI only when Go files change; bootstrap includes an agent-tool maintenance pass.",
    ],
    built: [
      "A monorepo where the interesting part is the developer platform: a Go CLI, ot, giving every engineer — human or AI — up, down, logs, and check, plus runtime preflight.",
      "Git-worktree isolation is the heart of it: each linked worktree automatically gets its own ports, its own Docker Postgres and database URLs, and a path-mounted Tailscale Funnel exposing that branch's MCP server at …/_ot/<instance>/mcp. Five agents on five branches never collide.",
    ],
    demo: {
      caption: "built for the era when your teammates include agents",
      kind: "otseek",
      lanes: [
        { agent: "human · collin", branch: "main" },
        { agent: "agent · claude", branch: "feat/quote-engine" },
        { agent: "agent · claude", branch: "fix/crm-dedupe" },
        { agent: "human · cofounder", branch: "feat/docs-portal" },
        { agent: "agent · codex", branch: "chore/preflight" },
      ],
    },
    demoTitle: "FIVE WORKTREES, ZERO COLLISIONS",
    links: [],
    problem: "Agency MBS trading runs on telephone games, fragmented systems, and Excel files at the edge of collapse; traders lose trades to their own tooling.",
    slug: "otseek",
    strap: "An operating system for the trading desk.",
    taught: "The most leveraged code in a startup is the code that makes everyone else faster — and in 2026, “everyone else” includes the models. Design your dev loop for parallel agents and humans stop stepping on each other too.",
    title: "OTseek",
  },
  {
    buildNotes: [
      "Bun API for coaching lines, Spotify transitions, and TTS — OpenAI Agents SDK, speech via gpt-4o-mini-tts (voice “marin”).",
      "Native SwiftUI clients for iOS 26 and watchOS 26 share a Swift package for the API contract and view models.",
      "Spotify secrets never touch the Apple app — token exchange stays server-side.",
      "Terraform WIF, Secret Manager, Cloud Run GitOps — the shared platform again.",
    ],
    built: [
      "An open-source running companion: a Bun API for coaching lines, Spotify transitions, and text-to-speech, with native SwiftUI clients for iPhone and Apple Watch.",
      "It started as hypercoach on LangChain in January 2024 and was rebuilt in 2026 on the shared platform — same idea, two stack generations apart, history imported rather than erased.",
    ],
    demo: {
      kind: "runsetta",
      lines: [
        [
          ["Easy pace, easy rain. You're basically a duck today — ducks never check their splits.", "Nice and easy in this heat. Hydrate like it's your job; jog like it's your hobby.", "Perfect day, easy pace. This is the run you'll remember when you brag about loving running."],
          ["Easy miles in the rain build the kind of stubborn that race day can't rattle.", "Heat plus easy pace equals patience practice. You're doing great. Slower. Greater.", "Gorgeous out. Keep it conversational — if you can't chat, you're racing, and today isn't a race."],
          ["RAIN DRILLS, RECRUIT. Easy pace does not mean easy posture. Shoulders down. Eyes up.", "It's hot and we are UNBOTHERED. Easy pace, tall spine, march it out.", "Conditions: perfect. Excuses: zero. Easy pace, but make it crisp."],
        ],
        [
          ["Tempo in the rain? You absolute legend. Lock the rhythm, let the puddles worry about themselves.", "Tempo in this heat is spicy. Settle in two notches under heroic.", "Tempo time on a perfect day — find the edge, then politely stay on it."],
          ["Rain keeps you cool; the tempo keeps you honest. Breathe in fours and float.", "Hot tempo day: effort over pace. Your watch doesn't know about the sun. You do.", "Steady at the edge of comfortable. If your breath turns ragged, back off five seconds."],
          ["TEMPO. RAIN. GLORY. Cadence up, chin level, and don't you dare tiptoe around puddles.", "The sun is a rival coach trying to slow my athlete. DEFY IT — at a sensible effort.", "Perfect weather is for PRs at practice intensity. Hit the rhythm. Hold the line."],
        ],
        [
          ["Race pace in the rain — grip the road, shorten the stride, and go be weatherproof.", "Race effort in heat: respect it. Bank nothing, spend evenly, finish proud.", "Race pace on a perfect day. This is the one. Smooth is fast."],
          ["Cold rain, hot engine. Stay light on your feet and trust your training.", "Heat changes the math, not the mission. Even effort; the splits will forgive you.", "Everything aligned today. Run the plan, not the adrenaline."],
          ["RAIN IS JUST APPLAUSE FROM THE SKY. Race pace. Commit. COMMIT HARDER.", "FORGE CHECK: it's hot, you're hotter. Race effort, ice-cold focus.", "No wind. No excuses. Race pace until the doubt gets dropped at mile two."],
        ],
      ],
      mood: ["hype", "zen", "drill-sergeant"],
      pace: ["easy", "tempo", "race"],
      weather: ["rain", "heat", "perfect"],
    },
    demoTitle: "GENERATE A COACH LINE",
    links: [{ href: "https://github.com/collinbentley1/runsetta", label: "source on GitHub" }],
    problem: "I wanted a running coach that knew my pace, my playlist, and when to shut up.",
    slug: "runsetta",
    strap: "A coach in your ear, open source.",
    taught: "The same product, rebuilt across stack generations, is the honest benchmark of how much the tools have changed — and how much taste hasn't.",
    title: "runsetta",
  },
  {
    buildNotes: [
      "2020 TypeScript map-storytelling build: Mapbox fly-tos between researched locations, content through a git-based CMS, privacy policy routing.",
      "Revived June 2026 onto the shared platform as a Bun/Cloud Run GitOps app — content moved; nothing was rewritten from memory.",
    ],
    built: [
      "A map-storytelling project from 2020: researched locations, each with an entry in a git-based CMS, connected by smooth fly-throughs between sites. Six years later it was revived onto the same Bun/Cloud Run platform as everything else on this page.",
    ],
    demo: {
      entries: [
        { label: "ENTRY 01", note: "A researched location, written up in the git-based CMS.", x: 22, y: 30 },
        { label: "ENTRY 02", note: "The map flies between entries — story order, not map order.", x: 66, y: 48 },
        { label: "ENTRY 03", note: "Each entry carries sources; the CMS keeps them with the text.", x: 38, y: 72 },
      ],
      kind: "critical-history",
    },
    demoTitle: "FLY THE ROUTE",
    links: [{ href: "https://github.com/collinbentley1/critical-history", label: "source on GitHub" }],
    problem: "Local history work deserves software with the care of a museum exhibit — and software that outlives whichever stack it was born on.",
    slug: "critical-history",
    strap: "Civic memory deserves good software.",
    taught: "Software outlives its first stack; build content so it can move.",
    title: "critical history",
  },
];

export const WORK_INDEX = {
  intro: "Five projects, one habit: build the thing, then build the thing that teaches the next person how it works.",
  title: "THE WORK",
} as const;
