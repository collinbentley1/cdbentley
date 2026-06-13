# Application Kit — Education Labs Design Engineer (Greenhouse 5097186008)
Everything needed to submit, independent of any AI session. Companion to `design-brief.md`.
Target: submit Wednesday morning. BD generalist (greenhouse 5068226008) same morning if link still live.

---

## 1. PUNCH LIST (before submit)
- [ ] **Essay authorship**: rewrite `/notes/riding-instructors` in your own hand. Keep structure; replace sentences; add one un-inventable detail (a specific horse, a specific rider, a specific Beijing student). You may be interviewed about this text.
- [ ] **CONFIRM-1**: one concrete sentence in the Robot Room scene about what you actually did at the SAR Lab.
- [ ] **Dojo v2 swap**: replace prompting-moves dojo with FIND THE FLAW (spec §6 below). The current dojo is a tutorial-on-rails teaching a deprecating skill — the team's JD explicitly disclaims tutorials.
- [ ] **JS verification** (fetch can't see it): dojo interactions, medlock playground fires against live endpoint, journey scroll-walk, stat-bar fills.
- [ ] **Mobile pass** at 390px; reduced-motion pass; viewport heights 700–1100 (the old reveal bug's habitat).
- [ ] Lighthouse ≥95 on `/`, `/dojo`, `/work/medlock`.
- [ ] Merge PR #18 → production at cdbentley.com before submitting (the Website field must hit prod, not a PR preview that tears down).
- [ ] LinkedIn: add SAR Lab to experience; add the essay + dojo to Featured; headline can stay until offer.

## 2. FORM ANSWERS (the boring fields, decided once)
- Website: `https://cdbentley.com`
- Open to 25% in-office: Yes
- Earliest start: [your honest answer — "2–4 weeks from offer" is normal]
- Deadlines/timeline: optional — if BD generalist also advances, it's fine to note you're in process for another Anthropic role; otherwise leave blank.
- AI Policy: Yes (and mean it — the essay and Why Anthropic are yours).
- Visa: No. Relocation: No. Address: your NYC address.
- Interviewed at Anthropic before: answer honestly.
- Additional info field: 3 lines max. Suggested shape (write in your voice): point them to the dojo ("it measures whether the visitor got better, not whether they stayed"), the live medlock MCP endpoint, and the colophon.

## 3. RESUME FACT SHEET (verified; build the one-pager from this)
**Identity line:** Product engineer & researcher — I build systems that make people more capable.
- OTseek — Co-Founder, PearX W26 (Nov 2025–present, dissolving by choice). v1: trading-desk OS — Go dev CLI (`ot`) with git-worktree isolation, per-worktree Docker Postgres + path-mounted Tailscale-funneled MCP servers (parallel human+AI development); FastAPI/WorkOS auth; CRM w/ dedicated Postgres + MCP endpoint; Next.js workspaces. v2: self-hostable ChatGPT App / Claude Connector backend for a Colorado outfitter — Cloudflare Worker MCP, D1, Durable Objects serializing itinerary writes (model retries can't double-book), Vectorize semantic search, WordPress + Ventrata OCTO bridges, one-click deploy.
- Healthyr — Principal Product Manager (Sep 2024–Nov 2025, NYC). Voice AI patient companion; care continuity between appointments.
- Humana — Senior PM, Incubation Lab (Oct 2020–Sep 2024, NYC). Incubated clinical + non-clinical products incl. ambient AI for home-health visits; internal thought leader on multimodal LLMs in product.
- AndKids International School, Beijing — Educator (2019–20). CS & robotics; students gained one grade-level in science and reading vs. prior cohorts.
- Yale School of Medicine — Learning & Development Technology (2018).
- Yale — CS coursework; SAR Lab research [add your one-line specific]; President & Musical Producer, Yale Dramatic Association ($200K budget, dozen productions, most inclusive season in its history).
**Side projects (the proof):** medlock.ai — public MCP server, Solid-pod consent architecture, live demo endpoint. runsetta — open-source AI run coach (OpenAI Agents SDK, SwiftUI iOS/watchOS). platform — own Bun/Cloud Run/Terraform GitOps platform (SHA-pinned actions, Checkov, Socket). cdbentley.com — this site; hand-rolled PNG sprite pipeline. GitHub: 2,330 contributions in the last year; upstream bug reports to openai/codex and zeroclaw.
**Format:** one page, four sections mirroring the JD's four pillars (engineering+craft / conviction / research mindset / coalition building), artifacts > adjectives.

## 4. "WHY ANTHROPIC?" — beats only (200–400 words, YOURS ALONE)
1. The through-line: every job has been teaching — riders, kids, clinicians, nurses, patients. The SAR Lab question that organized your life: don't ask how smart the machine is; ask whether the human grew.
2. Why this team: you've measured capability instead of engagement since before you knew it was a hiring criterion — the dojo is the proof; you're applying to work on the measurement problem.
3. Why Anthropic: you build on Claude and MCP daily (medlock, AVA); a PBC whose mission is the thesis you dissolved a company over.
Anti-patterns: no flattery, no quoting their site, no AI cadence, no "passionate."

## 5. WARM INTRO (send Monday morning)
To Harris Stolzenberg (mutual with Drew Bent), your voice:
> Harris — quick ask. I'm applying to Anthropic's Education Labs this week (Drew Bent's team — you two are connected). Former teacher turned builder; I just shipped a portfolio that measures visitor capability instead of engagement. Would you forward me along? Three lines from you beats three hundred from me.

## 6. DOJO v2 — FIND THE FLAW (build spec)
Premise: the durable skill isn't writing prompts — it's catching machines being confidently wrong (Discernment, in Anthropic's 4-D fluency framework). Keep: dojo frame, sensei, cairn, level-up shell, "no tracking" subhead. Delete: Riverbot + the three moves.
Loop: show a confident 4–6 sentence AI-style answer containing exactly ONE planted realistic flaw → visitor clicks the sentence they distrust → verdict + 2-line explanation of the failure-mode *category* → next. Ten items, escalating: 2 easy (fabricated statistic, wrong date) · 4 medium (unit error, hallucinated API method, false attribution, plausible-but-wrong historical claim) · 4 hard (reversed causality, base-rate error, off-by-one in working code, real-citation-wrong-claim).
Data: `dojo.ts` → `{answer, flawSentenceIndex, category, explanation, difficulty}`. Collin authors/edits all ten — they must be genuinely good fakes.
Scoring = the point: accuracy, speed per catch, category breakdown ("you miss causal flips"), improvement across rounds. End screen: "You caught 7/10. These errors were planted by a human. Real ones won't announce themselves — that's the skill." One lineage line: planted-flaw practice is a cognitive forcing function (Buçinca et al., CHI 2021); link to the essay.

## 7. INTERVIEW PREP
**Process to expect (design-engineer shaped):** recruiter screen → hiring-manager conversation (likely Drew) → craft/portfolio deep-dive (walk the site & dojo decisions) → possible practical exercise → cross-functional + values conversations. They weight communication heavily; the writing matters.
**The canon, mapped:** Bloom 2-sigma (Drew/Schoolhouse); Vygotsky ZPD + scaffold-fading (your SAR thesis); Bjork desirable difficulties + Kapur productive failure (dojo lets you fail first); generation/testing effects (Claude Code learning mode's #TODO gaps); Sweller cognitive load; Bainbridge "Ironies of Automation" 1983 (automation deskills operators for exactly the moments it fails — the dojo's reason to exist); Buçinca 2021 cognitive forcing functions (friction reduces over-reliance at a small satisfaction cost — the growth-vs-delight knife-edge); mid-2025 cognitive-debt studies (MIT EEG essay study; Microsoft/CMU CHI survey) — cite as suggestive, not settled.
**Their shipped work:** Learning Mode (Apr 2025, Socratic withholding) → all users + Claude Code (Aug 2025); Teach For All (100K teachers, 63 countries, Jan 2026); Northeastern/LSE/Champlain; Canvas/Panopto/Wiley integrations; AI Fluency 4Ds (Delegation, Description, Discernment, Diligence); Economic Index education finding: students offload the TOP of Bloom's taxonomy.
**Likely current bets (inference — hold loosely):** capability-measurement infrastructure (longitudinal, privacy-preserving "does this user need less scaffolding than last month"); adaptive scaffolding as default rather than opt-in mode; discernment training in-product; memory-driven learner models (spaced retrieval); beyond-chat interaction paradigms (human-authors-part canvases).
**Your three opinions (deploy one each conversation):** ① Learning Mode's limit is opt-in — the people who need it least are the only ones who enable it; the design problem is making friction feel like respect. ② Engagement and capability are adversarial short-term; org design (who owns the metric) decides which one survives. ③ The real risk isn't cheating; it's Bloom's inversion — offloading synthesis while keeping the typing.
**Your question for them:** "What's your current best proxy for capability growth in production — and what would falsify it?"
**Mock questions to rehearse aloud:** Walk me through the dojo — why planted flaws? · How would you measure whether Claude.ai makes users more capable? · Tell me about shipping under ambiguity (OTseek pivot) · A PM wants to add streaks to learning features — respond · Why did you dissolve your company? (answer with the oxygen thesis, no bitterness, 60 seconds).

## 8. SOURCES WORTH RE-READING BEFORE INTERVIEWS
Drew Bent on Edtech Insiders (Claude for Education episode) · anthropic.com/news/anthropic-teach-for-all · claude.com/solutions/education · Anthropic Economic Index education report · Anthropic AI Fluency courses (the 4Ds) · Buçinca et al. 2021 "To Trust or to Think" · Bainbridge "Ironies of Automation" · your own essay, until it sounds like you.
