# cdbentley.com v2 — "The Journey" Full Production Brief (v2, content-complete)

**For:** Claude (Fable 5) in the coding harness, working in `collinbentley1/cdbentley` (deploy conventions already in-repo)
**From:** Collin Bentley + Claude (Cowork, June 9, 2026)
**Goal:** The strongest single artifact supporting Collin's application to **Anthropic Education Labs — Design Engineer, AI Capability Development** (Greenhouse 5097186008, $300–405K, SF/NYC).
**This version is content-complete.** Copy below is final-draft quality; Collin gives every line a personal pass before merge, but the harness should build against this text, not placeholders. The only deliberate blanks are three `[CONFIRM]` flags in §2.

---

## 1. Audience & win condition

Reviewers: **Drew Bent** (Education Lead; Schoolhouse.world co-founder, ex-Khan Academy engineer, taught HS math), **Zoe Ludwig** (MTS; ex-6th-grade science teacher → Girls Who Code → Lambda School → founded Notion user education), **Elie Schoppik** (MTS; co-founded/ran Rithm School 8 yrs, Frontend Masters teacher) — plus a design-engineer craft bar ("front-of-the-frontend: motion, polish, and interaction feel").

Their JD, verbatim: experiences that make users "**progressively more capable, curious, and empowered over time**"; "skeptical of tutorials, onboarding flows, and engagement metrics"; success = "**capability growth, not time-on-site**."

**Win condition:** in 3 minutes a reviewer (a) feels the craft, (b) *does something they couldn't do before arriving*, (c) understands Collin's whole career is one continuous act of teaching — riders, kids, clinicians, nurses, patients, traders, and now AI users.

**Site thesis: a portfolio that teaches.**

---

## 2. Source-of-truth fact sheet (the harness invents NOTHING beyond this section)

**Identity.** Collin Bentley · New York City · he/him · collin.bentley@me.com · github.com/collinbentley1 · linkedin.com/in/collinbentley · GitHub: 2,330 contributions in the last year, 62 repos.

**Timeline (verified via LinkedIn + repos):**
- **Equine therapy & riding instructor** — earliest work; taught riding and equine-assisted therapy. Lesson per his own site: "patience, trust, and reading what is not said."
- **Yale University, 2015–2019** — studied Computer Science (his site's wording). Coursework evidence in repos: CPSC 113 (web stacks ×3: Node, Ruby ×2), ENAS 410 (audio localization, C++), CS376 Java project, Racket/Emacs setup. President & Musical Producer, Yale Dramatic Association (Dec 2016–May 2018): shipped a dozen student/professional productions on a $200k operating budget; expanded the board with a fully-empowered diversity & inclusion officer; "most inclusive season in history."
- **Yale Socially Assistive Robotics Lab** (Scassellati's lab; robots that help children — notably kids with autism — practice social skills with other humans). Collin did research work here. `[CONFIRM-1: Collin — one sentence on your specific SAR project/role, to slot into §5.1 Scene 3 and /now]`
- **Yale School of Medicine — Learning & Development Technology Consultant, Jun–Aug 2018:** "eliminated the friction that used to make it hard for clinicians and hospital employees to learn new things."
- **AndKids International School, Beijing — Educator, Jun 2019–Feb 2020:** taught CS & robotics to young learners; raised science and reading scores one grade-level vs. previous cohorts.
- **Humana — Senior Product Manager, Incubation Lab, Oct 2020–Sep 2024 (NYC):** incubated and scaled ideas across clinical and non-clinical businesses; ambient AI for home health ("quietly captures home-health visits so nurses can focus on the person in front of them instead of the paperwork after" — his site); recognized internally as a thought leader in applying multimodal LLMs in products.
- **Healthyr — Principal Product Manager, Sep 2024–Nov 2025 (NYC):** voice AI companion — "a warm voice that checks in on patients, listens, and keeps care continuous in the long quiet between appointments."
- **OTseek — Co-Founder, Nov 2025–present. PearX W26 (Pear VC; partner Ryan Sells; thanks also to Harris Stolzenberg, Kathleen Estreich, Mar Hershenson, Pejman Nozad).** v1: operating system for OTC bond trading (Agency MBS). v2 pivot: AI travel integrations for destination operators (ChatGPT Apps + Claude Connectors). Company dissolving by choice; founders concluded the problem they loved wasn't a venture-scale company — and that's okay.

**Repo facts for /work pages (from READMEs & commit history, all verified):**

*OTseek v1 — "an operating system for OTC trading" (private monorepo, Python/TS/Go):* FastAPI auth+API backend; CRM service with dedicated Postgres and its own **MCP endpoint**; Next.js workspaces (marketing, auth, app, docs); WorkOS auth; Alembic migrations; Infisical-injected secrets; Datadog checks; **`ot`, a Go-based local-dev CLI** — `ot up/down/logs/check/upgrade/reset`, runtime preflight, and **git-worktree isolation**: each linked worktree auto-gets its own ports, Docker Postgres, DB URLs, and a **path-mounted Tailscale Funnel publishing that worktree's MCP server** at `https://<machine>.ts.net/_ot/<instance>/mcp` (agents in parallel worktrees never collide); post-merge hooks rebuild the CLI only when Go files change; bootstrap includes an "agent-tool maintenance pass." This is dev-tooling built so that *human + AI teammates can work many branches at once safely* — say so on the page.
*OTseek v2 — "AVA" (private, MIT-licensed for client self-hosting):* a **self-hostable ChatGPT App / Claude Connector backend for a Colorado rafting & zipline operator** (WordPress site coloradorafting.net; Ventrata ticketing). `[CONFIRM-2: name the operator "AVA Rafting & Zipline" publicly, or anonymize to "a Colorado rafting & zipline operator"?]` Cloudflare-native: Worker exposing **MCP JSON-RPC at `/mcp`**; **D1** for catalog/knowledge/profile/itinerary/idempotency; **Durable Objects** (`AvaSessionObject`) serializing one writer per itinerary **so repeated widget clicks and model retries can't double-book**; **Vectorize** semantic search (text-embedding-3-small) with graceful D1 lexical fallback; Workers Assets + edge cache for media; WordPress→D1 content bridge via a custom plugin (Basic-Auth app passwords, no admin cookies); Ventrata **OCTO** checkout bridge with test/live env gating; idempotency keys scoped per itinerary; CORS/origin allowlists for chatgpt.com + claude.ai; one-click Cloudflare deploy; lazy first-request schema creation + seeding so a fresh deploy answers smoke tests before credentials exist. MCP tools include `create-recommendation-profile`, `search-attractions`, planning/itinerary/quote/checkout-handoff.
*medlock (public, medlock.ai):* pure-**Bun** app serving a site + **MCP server over Streamable HTTP** (`@modelcontextprotocol/server`, WebStandard transport). Public deploy returns **deterministic demo vitals**; private deploys connect the same tool surface to a user's **Solid Pod** behind bearer auth. Tools: `solid_fetch_vitals` (read-only), `vitals_scan` (prepares a browser scan handoff URL **without activating camera hardware from the server**). Resource: `medlock://context` — *deployment and safety context for MCP clients*. Cloud Run + Terraform + GitHub OIDC, PR preview deployments, Docker Hardened Images.
*runsetta (public, open source; née "hypercoach", LangChain/LangServe era Jan 2024 → rebuilt May–Jun 2026):* pure-Bun API (`/api/coach`, `/api/spotify-transition`, `/api/audio`, Spotify token exchange) using **OpenAI Agents SDK** for coaching text and TTS (gpt-4o-mini-tts, voice "marin"); **native SwiftUI clients for iOS 26 + watchOS 26** sharing a Swift package (API contract + view models); Spotify secrets never touch the Apple app — token exchange is server-side; Terraform WIF/Secret Manager/Cloud Run GitOps.
*critical-history (public):* 2020 TypeScript map-storytelling project (Mapbox fly-tos, location entries via git-based CMS, privacy policy routing) revived June 2026 onto the shared platform as a Bun/Cloud Run GitOps app. `[CONFIRM-3: one sentence on what Critical History is about/for — whose history, which city?]`
*platform (public):* "Reusable Bun, GitOps, and Google Cloud Run platform for Collin Bentley projects" (Terraform/HCL) — medlock, runsetta, critical-history, cdbentley all migrated onto it June 1, 2026.
*cdbentley (this repo):* pure Bun front+back; **PR-preview Cloud Run services (`cdbentley-pr-<n>`) auto-created and destroyed**; GitHub Actions **SHA-pinned and enforced**; **Checkov** IaC scanning; **Socket Firewall** dependency checks + Socket's native Bun scanner; Docker Hardened Images; Bun canary in CI.

**Ecosystem fluency (citable):** filed bugs upstream on `openai/codex` (#1978 Aug 2025; #10828 Feb 2026, Codex CLI Pro user) and `zeroclaw-labs/zeroclaw` (#3337, S1 channel-parser bug, Mar 2026); commits co-authored with Claude across medlock/runsetta; Codex-branch workflows in runsetta. He builds *with* the agents he files bugs against.

---

## 3. Current-state audit (condensed; full details in v1 of this brief)

**Keep:** pixel-RPG journey conceit; 128×128 sprite pipeline (4×4 walk sheet, horse companion); parchment + ink palette; script "margin notes"; honest warm card copy; own-platform infra.
**Fix (P0):** A1 scroll-reveal bug — cards stuck near opacity 0 even in viewport; A2 zero links/contact/footer anywhere; A3 2–3 empty viewports between stations; A4 stat bars render permanently empty.
**Fix (P1):** A5 no project work on site; A6 Poké Balls + "A WILD PORTFOLIO APPEARED" = Nintendo trade dress, replace with original system (§4); A7 "to be continued…" end-cap leaks early.
**Fix (P2):** A8 verify real mobile at 390px; A9 no OG image/social card; A10 "TRAINER · LV.∞" kills the growth metaphor (infinity can't level up).

---

## 4. Creative direction (locked)

**World:** original **trail-and-cairns** system. Waypoints are pixel cairns (stacked stones — markers travelers leave *so the next person finds the path*; that is the teaching metaphor and the site says so in the colophon). Each cairn gains a stone with a 150ms drop + 1px dust puff as you pass. No Nintendo assets anywhere; permitted easter egg: one tall-grass patch near the footer that rustles on hover.
**Companions:** each chapter's companion joins the walking party (specs §6): horse (exists) → paper crane (Beijing) → bulldog (Yale) → small round robot with led-heart (SAR Lab) → stethoscope pigeon (NYC health years) → pixel pear (founder). Final scene: the whole parade walks behind him. Skills travel with you.
**Palette:** parchment base `#EDE6CC`, ink `#2B2B33`, accent red `#C24B41`, accent gold `#D9A441`; time-of-day tint overlay descending the page: dawn `#F5E9D4` → noon (base) → dusk `#E3D2C2` + star pixels `#F4EFE0` at ≤8% opacity shifts; body text contrast stays ≥4.5:1 at all times.
**Type:** bitmap face for headings/chips/HUD only (current one is fine); humanist body (system stack: `ui-sans-serif, -apple-system, "Segoe UI", sans-serif`) at 16–18px/1.6 for card prose and all /work //notes pages; handwritten script reserved for margin notes, ≤1 per viewport.
**Motion:** sprite **walks the route as you scroll** — position bound to scroll progress along the SVG path; 4×4 walk cycle stepped at 10fps (pixel art steps, never tweens); flips on switchbacks; idle after 2s (blink, weight shift); companions follow at 350ms stagger with own idles. Card reveals: 12px rise + fade, 240ms, `steps(6)` easing, trigger at 25% viewport intersection — **and a belt-and-suspenders `requestAnimationFrame` fallback that force-reveals any card within 40% of viewport center** (this is the A1 kill-shot; test at window heights 700–1100px). Stat bars fill left→right with count-up tick when ≥60% visible. Transform/opacity only; 60fps; no layout animation.
**Reduced motion:** `prefers-reduced-motion` → character cross-fades between stations, instant reveals, dojo states static, sound toggle hidden. Must be flawless.
**Keyboard:** ↑/↓ walks chapter-to-chapter with focus management; tiny HUD hint "⌨ arrows walk". Konami code → 1s companion conga.
**Sound (P2):** one pixel speaker toggle, bottom-right, **off by default**; soft chiptune + footstep ticks.

---

## 5. Page-by-page content (final-draft copy — Collin edits, harness builds)

### 5.1 `/` — The Journey (origin-first; ≤0.75 viewport of trail between stations)

**Scene 0 — Trailhead.** Title: `COLLIN` · subtitle: `The journey of a teacher who builds`. HUD chip: `TRAINER · LV. 29 — STILL LEVELING` *(Collin: set the level to your actual age or years-since-first-lesson; pick one and keep it honest)*. Margin note: `follow the trail ↓`. First cairn (1 stone). Speech bubble on the sprite: `Hi, I'm Collin!` (keep).

**Scene 1 — THE STABLES — Riding & Equine Therapy Instructor.** Companion joins: horse.
> Before software: horses. Teaching a nervous rider to trust a thousand-pound animal taught me the whole job — patience first, trust second, technique a distant third. The best feedback loops don't say a word.
Chip: `TRUST — acquired` (bar fills to 5/5 with tick sound-less count-up).

**Scene 2 — YALE — Computer Science · Dramat President.** Companion: bulldog.
> Computer science by day; by night, producing a dozen plays and musicals on a $200k budget. I learned that shipping is a team sport, and the most important seat I added to our board was a fully-empowered inclusion officer. Most inclusive season in the Dramat's history.
Chip: `LOGIC — acquired` · secondary chip: `STAGECRAFT`.

**Scene 3 — THE ROBOT ROOM — Socially Assistive Robotics Lab.** Companion: small round robot, LED heart.
> In Yale's Socially Assistive Robotics Lab, the robots weren't the point — the kids were. A robot that helps a child practice eye contact succeeds only when the child stops needing it. `[CONFIRM-1 sentence here]` The question that lab burned into me: don't ask how smart the machine is. Ask whether the human grew.
Chip: `HUMAN-CENTERED AI — acquired`. *(This scene is the thesis statement of the whole site; give it one extra beat of trail before and after.)*

**Scene 4 — YALE MED — Learning & Development Technology.**
> First job mixing the two loves: making it easier for clinicians and hospital staff to learn new things. Friction, it turns out, is the real enemy of learning — not difficulty.
Chip: `LEARNING DESIGN — acquired`.

**Scene 5 — BEIJING — Educator, AndKids International School.** Companion: paper crane.
> A year teaching computer science and robotics to young learners in Beijing. My students' science and reading scores climbed a full grade-level past previous cohorts — but the real curriculum was watching a seven-year-old realize she could make the robot obey *her*.
Chip: `TEACHING — mastered`.

**Scene 6 — HUMANA — Senior PM, Incubation Lab (4 years, NYC).** Companion: stethoscope pigeon.
> Four years incubating products inside one of America's largest health companies. The one I'm proudest of listened quietly during home-health visits so nurses could keep their eyes on the patient instead of the paperwork. Ambient AI, before that was a category — and my crash course in multimodal LLMs, regulated data, and earning clinical trust.
Chip: `AMBIENT AI — acquired` · `SHIPPING IN REGULATED WORLDS`.

**Scene 7 — HEALTHYR — Principal PM.**
> A warm voice that checks in on patients between appointments — listening, remembering, keeping care continuous through the long quiet. Voice AI taught me that tone is a feature and silence is a UI state.
Chip: `VOICE AI — acquired`.

**Scene 8 — OTSEEK — Co-Founder, PearX W26.** Companion: pixel pear.
> Started a company with two friends. v1 rebuilt the trading desk's operating system; v2 gave a Colorado rafting outfitter its own front door inside ChatGPT and Claude. We're winding it down on purpose: the problems we love weren't a ten-billion-dollar company, and we think they deserve solutions anyway. That belief is where I'm headed next.
Chip: `FOUNDER — acquired` · `MCP — mastered`. Two pixel signposts under the card: `see the work →  /work` · `train with me →  /dojo`.

**Scene 9 — NOW (dusk, stars out, full companion parade idle-breathing).**
> Every chapter was the same job in different clothes: help someone become more capable than they were yesterday, then get out of the way. These days the someone is anyone using AI — and the classroom got very, very big.
Buttons: `THE WORK` `THE DOJO` `THE NOTES`. Then, only now: `to be continued…` / `THE STORY KEEPS LEVELING UP`.
Footer (every page): GitHub · LinkedIn · email · `colophon` (one modal: stack, the cairn meaning, "built on my own Bun/Cloud Run platform — SHA-pinned actions, IaC-scanned, PR-preview deploys", link to repo).

### 5.2 `/work` — five evidence pages (uniform template: problem → what I built → live demo → build notes → what it taught me → links)

**`/work/medlock` — "Your health data, on a leash you hold."**
- Problem: AI assistants are useful exactly in proportion to what they know about you — and health data is the last thing you should hand to a black box.
- What I built: a pure-Bun MCP server (Streamable HTTP) + site. Public deployment serves **deterministic demo vitals**, so anyone can connect it to Claude safely; private deployments point the *same tool surface* at your own **Solid Pod** behind bearer auth. Tools: `solid_fetch_vitals` (read-only by design), `vitals_scan` (hands the camera step to the browser — the server can't touch hardware). Ships a `medlock://context` resource so the *model* gets deployment & safety context, not just the human.
- **Live demo (build this):** "TRY IT AGAINST THE DEMO POD" — an embedded MCP playground: visitor clicks tool buttons (`fetch vitals` → animated JSON-RPC request/response panes in pixel-terminal styling), then a one-click "Add to Claude" copy block with the public endpoint. The demo is the real endpoint — that's the flex.
- Build notes: Cloud Run + Terraform + GitHub OIDC, PR-preview environments, Docker Hardened Images; same GitOps platform as this site.
- What it taught me (draft, Collin to own): consent isn't a checkbox, it's an architecture. Read-only tools, demo-by-default data, and handing hardware access to the user's own browser made "safe" the path of least resistance.

**`/work/ava` — "A rafting company's front door inside ChatGPT and Claude."** *(respect [CONFIRM-2] for naming)*
- Problem: when travelers start planning trips inside AI assistants, who owns the relationship — the platform, an aggregator, or the small operator running the rafts? We bet it should be the operator.
- What I built: a **self-hostable, MIT-licensed ChatGPT App / Claude Connector backend** the operator runs on their own Cloudflare account, one click. Worker speaks MCP JSON-RPC; **D1** holds catalog/knowledge/itinerary/idempotency; a **Durable Object per itinerary serializes writes so model retries and double-clicked widgets can't double-book a raft**; **Vectorize** powers semantic search over trips and operator knowledge (lexical fallback if unconfigured); their existing **WordPress** content syncs in via a tiny plugin; **Ventrata OCTO** handles real availability and checkout handoff, test/live gated. Tools: `create-recommendation-profile`, `search-attractions`, itinerary/quote/checkout.
- **Live demo (build this):** "PLAN A RIVER DAY" — a 3-turn simulated agent conversation (canned transcript, typed-out at 30 chars/s with skip button) showing profile → semantic search → itinerary card render, with a side panel highlighting which MCP tool fired at each turn and a tiny Durable-Object diagram lighting up on the write.
- Build notes: lazy first-request schema + seed so a fresh deploy answers smoke tests before credentials exist; origin allowlists for chatgpt.com/claude.ai; idempotency keys scoped per itinerary; assets on Workers Assets + edge cache, "keep media out of D1 rows."
- What it taught me (draft): distribution is the new shelf space; giving a small business *ownership* of its AI integration — deployable to their own account, readable by their own dev — is the difference between renting a future and having one. Also: serialize your writes; agents retry.

**`/work/otseek` — "An operating system for the trading desk."**
- Problem: Agency MBS trading runs on telephone games, fragmented systems, and Excel files at the edge of collapse; traders lose trades to their own tooling.
- What I built (patterns, not secrets): a monorepo where the interesting part is the **developer platform**: a Go CLI (`ot`) giving every engineer — human or AI — `up/down/logs/check` plus **git-worktree isolation**: each worktree gets its own ports, its own Docker Postgres, and its own **path-mounted Tailscale Funnel exposing that branch's MCP server** (`…/_ot/<instance>/mcp`), so five agents on five branches never collide. CRM service with its own Postgres + MCP endpoint; FastAPI auth via WorkOS; Next.js workspaces; Infisical-injected secrets with `--watch` restarts.
- **Live demo (build this):** "FIVE WORKTREES, ZERO COLLISIONS" — an animated pixel diagram: five branch lanes, each spawning its own DB container and MCP tunnel; a collision-free commit/merge animation; caption: *built for the era when your teammates include agents*.
- What it taught me (draft): the most leveraged code in a startup is the code that makes everyone else faster — and in 2026, "everyone else" includes the models. Design your dev loop for parallel agents and humans stop stepping on each other too.

**`/work/runsetta` — "A coach in your ear, open source."**
- Problem: I wanted a running coach that knew my pace, my playlist, and when to shut up.
- What I built: open-source running companion — Bun API for coaching lines, Spotify transitions, and TTS (OpenAI Agents SDK; speech via gpt-4o-mini-tts); **native SwiftUI iOS 26 + watchOS 26 clients** sharing a Swift package for the API contract; Spotify secrets never leave the server. Started as `hypercoach` on LangChain in Jan 2024; rebuilt 2026 on the shared platform — same idea, two stack generations apart, history imported rather than erased.
- **Live demo (build this):** "GENERATE A COACH LINE" — three pixel sliders (pace: easy/tempo/race · weather: rain/heat/perfect · mood: hype/zen/drill-sergeant) → returns one of 27 pre-written coach lines in a speech bubble with a play-button TTS *recording* (pre-rendered audio files, no live API). Lines should be funny and kind; Collin records/curates final set.
- What it taught me (draft): the same product, rebuilt across stack generations, is the honest benchmark of how much the tools have changed — and how much taste hasn't.

**`/work/critical-history` — "Civic memory deserves good software."** *(respect [CONFIRM-3])*
- 2020 map-storytelling project: Mapbox fly-throughs between researched locations, content via a git-based CMS, revived in 2026 onto the platform. Demo: embedded mini fly-over of 3 locations.
- What it taught me (draft): software outlives its first stack; build content so it can move.

### 5.3 `/notes` — writing
Ship with **Essay 1 published**, two stubs ("trail not yet walked — soon").
**Essay 1 (full draft below — Collin must edit until it sounds like him; ~430 words): "What riding instructors know that growth teams don't."**
> Draft thesis & flow: (1) Open at the stables: you cannot make a horse trust a rider; you can only arrange the conditions where trust becomes the easiest available behavior. (2) Engagement-metric software does the opposite — it arranges conditions where *dependence* is the easiest behavior; the product gets smarter while the user stays the same. (3) The riding instructor's success metric is brutal and beautiful: the day the student stops needing you. Lessons end. Schools graduate. Good tutors obsolete themselves on purpose. Software almost never does, because retention is revenue. (4) AI breaks the excuse: when the tool can genuinely teach — explain itself, adjust to the learner, fade its own scaffolding — "they keep coming back" stops being proof of value and starts being a question: *coming back more capable, or just coming back?* (5) Close with the SAR Lab line: don't ask how smart the machine is; ask whether the human grew. The whole essay is the dojo's "why," and the journey's chapter 1, in prose.
Essay 2 stub: "Silence is a UI state: notes from building voice AI for patients." Essay 3 stub: "Oxygen for non-unicorn problems."

### 5.4 `/dojo` — the capability artifact (fully scripted; all responses canned, no API)

Frame: pixel dojo interior, sensei sprite = the horse wearing a tiny headband (continuity + comedy). Header: `THE DOJO — leave knowing one move you didn't have.` Subhead: `90 seconds. No account. No tracking you across the internet. The only score that matters is yours.`

**The skill taught: "three moves of context"** (role · constraints · example). Teaching loop = try → struggle → name the move → retry → level up. The visitor edits a prompt for a fictional trip-planning assistant ("Riverbot" — reuses AVA's domain, keeps the site coherent).

- **Screen 1 — TRY.** Prompt shown: `plan me a trip` → canned Riverbot answer: a generic, confident, useless wall of "it depends!" suggestions. Card: `Rate this answer:` [USEFUL] [USELESS] — any click → `Correct. It's useless. Not because the model is weak — because it's starving.`
- **Screen 2 — MOVE 1: GIVE IT A ROLE.** Visitor picks one of three role chips (`river guide for nervous families` / `luxury concierge` / `budget trip planner for students`) which visibly prepends to the prompt → canned answer #2 visibly sharpens in that direction (3 variants written). Sensei: `Same model. One sentence of role. Notice what it stopped guessing about.`
- **Screen 3 — MOVE 2: GIVE IT CONSTRAINTS.** Visitor sets two pixel sliders (group size 2/6/12 · "fear level: none/some/please-no-rapids") → answer #3 narrows further (9 variants: 3×3; write all 9, two sentences each). Sensei: `Constraints aren't limits on the model. They're limits on its hallucinations.`
- **Screen 4 — MOVE 3: SHOW AN EXAMPLE.** Visitor picks one of two example-output formats (a day-grid vs. a packing-first checklist) → final answer renders in chosen format (2 variants). Sensei: `You just taught it. That's all teaching a model is — showing, not hoping.`
- **Screen 5 — LEVEL UP.** Pixel fanfare, cairn gains a stone: `+1 LEVEL — that was YOUR level, not ours.` Recap card of the three moves in plain words, a copyable cheat-sheet line (`role + constraints + example`), and one honest line: `Total canned demo, by the way — no model was called. The moves are real. Try them on a live one tonight.` Buttons: `read why this matters → /notes` · `who built this → /`.
- Analytics: count only `dojo_completed` and `dojo_retry_improved` via self-hosted Plausible; display nothing publicly; no cookies.
- Total canned content to write into a `dojo.ts` data file: 1 + 3 + 9 + 2 + recap = **16 canned outputs** (all drafted by the harness from this spec, reviewed by Collin; keep each ≤80 words, warm, concretely about rivers).

---

## 6. Asset manifest (pixel, 128×128 unless noted, existing pipeline & PNG conventions)
1. Main character: existing 4×4 walk sheet (keep) + 4-frame idle (blink/weight-shift) + 2-frame wave (Scene 0).
2. Companions, each 4-frame walk + 2-frame idle: horse (walk exists; add idle tail-swish), paper crane (bob), bulldog (trot), round robot w/ LED heart (roll; heart blinks), pigeon w/ stethoscope (strut), pear w/ tiny legs (waddle).
3. Cairns: 3 stack states (2/3/4 stones) + falling-stone 3-frame anim + dust puff (16×16).
4. Sensei headband variant of the horse (dojo only) + dojo interior tile set (wall scroll reads "ASK BETTER").
5. Sky/light: dawn/noon/dusk 1×512 gradient strips + 8×8 star sprites (3 variants).
6. Signposts, speech-bubble 9-slice, slider knobs/track, chip/badge frames, pixel speaker (2 states), tall-grass patch (3-frame rustle).
7. OG image 1200×630 + 1:1 crop: character + full parade at dusk by a cairn, site title in bitmap face. Favicon: cairn 32×32/16×16.

## 7. Engineering notes
Stack stays exactly as the repo: pure Bun app, Bun canary CI, existing GitHub Actions (SHA-pinned), Checkov, Socket, Docker Hardened Images, PR-preview Cloud Run services, platform Terraform. No framework migration; no new SaaS dependencies except self-hosted Plausible (or skip analytics in P1). All journey/work/dojo content lives in typed data files (`content/chapters.ts`, `content/work/*.ts`, `content/dojo.ts`) so copy edits never touch components. Performance budget: LCP <1.5s mobile-throttled, JS <120KB gz, atlas <300KB, fonts ≤80KB (or system-only), Lighthouse ≥95 ×4 on `/`, `/work/medlock`, `/dojo`. A11y: full DOM article mirror of the canvas narrative, focus-visible, AA contrast, reduced-motion path. SEO: per-route titles/descriptions; sitemap; OG per §6.7.

**Acceptance checklist (run all before done):** reveal logic verified at viewport heights 700/850/1000/1100 (A1); zero ghosted cards in screenshot sweep at 390/768/1372 per chapter; every link resolves (footer on all routes); stat bars fill on first scroll-through; keyboard end-to-end walk; reduced-motion capture; dojo completable with keyboard only; Lighthouse reports committed to `/reports`; `[CONFIRM-1..3]` resolved by Collin before deploy of affected pages (everything else can ship).

## 8. Build order
**P0 (tonight):** A1 reveal fix + pacing compression + stat-bar fill + footer/contact/links + OG/meta + LV.∞→LV.29.
**P1:** origin-first journey rebuild, cairn/companion system, scroll-walk, `/work/medlock` + `/work/ava` + `/work/otseek`.
**P2:** `/dojo`, `/work/runsetta` + `/work/critical-history`, `/notes` with Essay 1, sound toggle, easter eggs.

## 9. Do-NOT list
No Nintendo assets or phrases; no Anthropic logos/names/reviewer references in the site; no invented facts beyond §2; no engagement-bait (popups, counters, newsletter); no live API keys in the dojo; no OTseek business specifics beyond §5.2's approved patterns; nothing on /work/ava or /work/otseek merges before Collin resolves [CONFIRM-2]; don't break existing URLs or migrate frameworks; the application's "Why Anthropic?" essay is written by Collin alone and is not part of this repo.

## 10. Traceability (site element → Education Labs JD line)
| Dojo (visitor levels up; capability events only) | "capability growth, not time-on-site"; "skepticism of engagement metrics" |
| Scroll-walk + stepped pixel motion + reduced-motion rigor | "motion, polish, and interaction feel" |
| /work pages with live demos + build notes | "portfolio showcasing innovative interaction designs and high-quality implementations" |
| SAR Lab scene + teacher-origin arc + Essay 1 | "background in learning sciences/HCI"; team's teacher→builder hiring pattern; "published writing on skill development" |
| medlock + AVA MCP pages | "experience building AI-native product experiences… LLMs in production"; MCP literacy both Anthropic JDs name |
| ot CLI worktree-isolation page | "one-person technical shop… establish patterns others can follow" |
| Typed content files + own platform + repo hygiene | "track record of independently driving features from prototype to production" |
