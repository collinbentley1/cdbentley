# Prior art: context departure, motion, and retrieval

WS-C pre-design sweep, July 7, 2026. Written before any design code, per the discipline line in GOALS.md WS-C ("prior-art report exists before any design code lands; commit order shows it").

Sourcing rule (STYLE.md rule 5): every URL below was fetched and verified tonight by one of three research passes. Findings the passes could verify only at search level, or whose primary page resisted fetch, appear with **no URL** and are marked as such. Any copy derived from this report must re-verify its URLs on the day it ships.

---

## 1. The question

Tonight's armature proposes: reading position rendered as a visible context window; sections that scroll out of the window visibly compact and travel to a persistent shelf as labeled summary chips; retrieval expands a chip back along the reversed path. The pitch phrase is "a portfolio that remembers like a model."

Before designing it, two questions:

1. Does any shipping UI spatially animate context departure — anything that drifts, shrinks toward, or lands in a persistent retrievable location, the way a minimized window pours into the Dock?
2. Given the answer, what may tonight's build claim, and what may it not?

## 2. What ships today (chat UIs)

Fourteen surfaces surveyed: Claude Code, claude.ai, ChatGPT, Gemini, Perplexity, VS Code Copilot Chat, Cline, Roo Code, SillyTavern, Codex CLI, OpenCode, Amp, Open WebUI, LM Studio. The entire shipped vocabulary for context departure reduces to four patterns. None involve motion.

**Pattern 1 — the fill meter.** State indication only; departure itself is invisible.

- Claude Code: status-line percentage, `/usage`, `/context` breakdown; auto-compaction summarizes history near the limit; `/compact` accepts steering instructions. Compaction replaces the working conversation in place with an expandable summary event; the old transcript survives only as inert terminal scrollback. No motion, no persistent named destination. (https://code.claude.com/docs/en/costs)
- VS Code Copilot Chat: a context-window control in the chat input — "a shaded bar shows the proportion of the context window currently in use," hover shows a 15K/128K-style breakdown, menu offers Compact Conversation. Docs state compaction "happens transparently in the background, so you can keep chatting without interruption." (https://code.visualstudio.com/docs/copilot/chat/copilot-chat-context)
- Cline: Context Window Progress Bar in the task header, pitched as ending "context amnesia." Its truncation algorithm silently removes middle messages; no user-facing marker or animation of removal. (https://cline.bot/blog/understanding-the-new-context-window-progress-bar-in-cline)
- Roo Code: ContextWindowProgress bar showing token distribution. (https://docs.roocode.com/features/intelligent-context-condensing)

**Pattern 2 — in-place substitution, at most a static summary row.**

- Roo Code, the strongest prior found: "Condensing context..." progress, then an expandable ContextCondenseRow inserted into the chat history at the condensation point — an audit trail with before/after token counts and cost. It appears; it does not travel. Retrieval location is taught by placement and label, not motion. (https://docs.roocode.com/features/intelligent-context-condensing)
- OpenCode: compaction inserts "a new assistant message marked as summary" into the transcript. Codex CLI: `/compact` plus a text warning that compactions reduce accuracy. Amp: no auto-compaction — a manual Handoff extracts relevant info into a fresh thread. (Cross-tool survey: https://gist.github.com/badlogic/cd2ef65b0697c4dbe2d13fbecb0a0a5f)
- VS Code Copilot agent sessions: an inline "Summarized conversation history" status row inserted into the transcript; user reports call it noise and ask to disable it (fetched: github.com/orgs/community/discussions/166415).
- claude.ai: an inline wait message — "Compacting our conversation so we can keep chatting" — while model-side context is summarized. The visible history stays fully scrollable and unchanged; compaction is otherwise invisible. (https://unmarkdown.com/blog/claude-compacting-explained)

**Pattern 3 — a passive boundary line.**

- SillyTavern, the only shipping UI found that spatially situates context departure inside the transcript: "A dotted line between messages denotes the context range for the chat. Messages above that line are not sent to the AI" (exact docs wording). A static boundary; messages above it stay rendered but excluded. Nothing drifts across it; it teaches a rule, not a retrieval gesture. (https://docs.sillytavern.app/usage/common-settings/)

**Pattern 4 — a labeled chip linking to a settings page.**

- ChatGPT memory: a static "Memory updated" pill above the response, linking to Settings > Personalization > Manage Memory. The closest mainstream pattern to "content went somewhere retrievable" — but it teaches the location by label and link, not by motion; nothing from the transcript visibly travels into it. Long-chat truncation itself has no UI at all. *Primary OpenAI pages returned 403 to fetch; wording corroborated across multiple independent sources quoting the announcement. Unverified tonight — no URL ships.*

**Nothing at all.**

- Gemini: memory is "Saved info" on a dedicated settings page; no context meter, no compaction UI, no in-chat chip found in help docs or community threads. *Search-level only — no URL ships.*
- Perplexity: threads stored indefinitely in a Library; no context-usage indicator or compaction UI surfaced by help center, changelog, or teardowns. *Search-level only — no URL ships.*
- Open WebUI: discussion #9668 (Feb 2025, fetched) is an unimplemented feature request for even a basic context fill bar, with no maintainer response. LM Studio issue #1677 likewise requests compaction/rolling summarization. Much of the ecosystem has not shipped step one (a meter), let alone motion. (https://github.com/open-webui/open-webui/discussions/9668)

Adjacent but not context departure: VS Code 1.107 collapses successive tool calls into titled expandable sections "to reduce visual noise" — accordion collapse in place, for density, not directional. *Release notes identified via search, page not fetched — no URL ships.*

**Bottom line:** several products explicitly advertise that compaction is invisible. No shipping chat or LLM UI found spatially animates departure. Nothing drifts, shrinks toward, or lands in a persistent retrievable location.

## 3. The lineage (OS motion + research)

The motion vocabulary tonight's mechanic needs is old, shipped, and — in four cases — quote-verified from primary sources. This is lineage to claim proudly, not novelty.

**The rule, stated by Apple.** WWDC 2018 Session 803, "Designing Fluid Interfaces" (Chan, de Vries, Marcos): interfaces should "maintain spatial consistency throughout movement"; content should "smoothly leave and enter our perception in symmetric paths"; "if something disappears one way, we expect it to emerge from where it came"; each element should have "a consistent place where it lives." This is the exact contract the compaction shelf implements — compaction motion must travel to the shelf along a path the user can mentally reverse, and retrieval must replay it backward. The session's own worked example is the iOS icon-to-app zoom: apps zoom out of their home-screen icon and collapse back into the icon's grid position, which is why you can find them again without thinking. The shelf chip plays the role of the app icon. Cite the icon zoom via this session; it has no standalone Apple doc. (https://developer.apple.com/videos/play/wwdc2018/803/)

**The shipped precedent, at OS scale, by default, for 25 years.** The macOS genie effect: Apple's macOS User Guide documents the Dock setting ("Minimized windows animation: Choose the visual effect used when you minimize a window"), and `genie` is the literal default value of the Dock's `mineffect` key (both pages fetched; the current Apple page no longer names "Genie" in fetched text). Since Mac OS X 10.0 (2001), the OS default for putting content away has been an animation that visibly pours the window into its Dock destination — the user watches where it goes and knows where to click to get it back. Minimize = compact; Dock = shelf; genie path = the teaching motion. Use as design lineage, not quotable Apple doctrine: Apple documents the setting, not the rationale. Do not cite patent US6831666B1 for this — checked; it is a Canon app-switcher patent, not Apple's genie effect. (https://support.apple.com/guide/mac-help/change-desktop-dock-settings-mchlp1119/mac and https://macos-defaults.com/dock/mineffect.html)

**The named idea.** Pasquale D'Silva, "Transitional Interfaces" (Medium, April 9, 2013), quote-verified: "Animation can be used functionally too. It's not just an embellished detail" and "It helps brains understand how the information flows." State-swaps without motion "feel like a glitch." The essay that named what the shelf mechanic depends on — motion carries information about where things went. Designer essay, not research; pair with the empirical items below. (https://medium.com/@pasql/transitional-interfaces-926eb80d64e3)

**The empirical warrant.** Robertson, Czerwinski, Larson, Robbins, Thiel, van Dantzich, "Data Mountain: Using Spatial Memory for Document Management" (UIST '98, Microsoft Research): users who placed documents at stable spatial locations retrieved them with statistically reliable advantages over list-based favorites. Verified via the Microsoft Research publication page (ACM DL 403s to automated fetch). Design consequence it forces: the shelf only works if chip positions are stable — fixed edge, stable ordering. If compacted items reshuffle, the motion teaches a location that stops being true and the mechanic collapses into decoration. (https://www.microsoft.com/en-us/research/publication/data-mountain-using-spatial-memory-for-document-management/)

**The survey backing.** Scarr, Cockburn & Gutwin, "Supporting and Exploiting Spatial Memory in User Interfaces," Foundations and Trends in HCI 6(1), 2013, DOI 10.1561/1100000046 (metadata verified via Semantic Scholar; publisher landing page 403s to automated fetch but is the canonical link). The two-phase model maps one-to-one onto the mechanic: the compaction animation is the SUPPORT phase (it builds location memory by showing the item traveling to its slot); one-click shelf retrieval is the EXPLOIT phase. If only one academic source appears in visible copy, use Data Mountain; keep this as the survey backing. (https://www.nowpublishers.com/article/Details/HCI-046)

**The why.** Don Norman, "Design as Communication" (jnd.org, 2008), quote-verified: "the entire communication must take place through the 'system image': the information conveyed by the physical product itself"; "people function through stories, not logic." Compaction with no motion gives the user no system image of where their context went; the default user story becomes "my stuff was deleted." The shelf animation is the system image. This is the citation that answers "why not just compact silently?" (https://jnd.org/design-as-communication/)

**The persistent-object requirement.** Shneiderman 1983, "Direct Manipulation: A Step Beyond Programming Languages," IEEE Computer 16(8), DOI 10.1109/MC.1983.1654471 — canonical but not fetch-verified (IEEE/ACM block automated fetch). Verified instead via NN/g's "Direct Manipulation: Definition" (Sherugar & Budiu, 2016, updated Oct 2024), which states the three principles with attribution: continuous representation of the objects of interest; physical actions instead of complex syntax; rapid, reversible, incremental actions with immediately visible effects. "Continuous representation" is the argument that compacted context must remain on screen as a chip, not vanish into an invisible buffer reachable by command; "reversible" grounds one-gesture retrieval. Name Shneiderman and the DOI; link NN/g. (https://www.nngroup.com/articles/direct-manipulation/)

**Observation-only items (no citation ships).** iOS notification banners retract toward the top edge — the same edge you fetch them back from. Apple nowhere documents this animation or its rationale; the primary support page's body is client-rendered and could not be extracted. Use as a live demonstration in copy ("watch any iPhone"), never with a citation. Platform caveat for copy: "fades to top-left" is platform-specific; be precise or demo it. Likewise the Apple HIG Motion page: URL resolves, body is client-rendered JS, no text could be quote-verified — do not hang any claim on it; everything it would supply exists in stronger form in WWDC 803.

## 4. Adjacent web work

Each ingredient of "scroll = context window; sections compact into retrievable chips" exists separately in shipping web work. No site found combines them.

- **Scroll as token volume.** LLM Context Window Visualizer (Damien Henry): pick a model, get a scrollable text block sized to its token limit — scroll distance literally represents token volume. A one-trick explainer: nothing compresses, nothing docks, no chips, not a site structure. Confirms the metaphor is legible, not that anyone has used it as architecture. (https://context-windows.damien-henry.com/)
- **Scroll-driven compression of past sections.** The stacking-cards / sticky-section collapse pattern is ubiquitous (Codrops "On-Scroll Animation Ideas for Sticky Sections," Jan 2024; official Chrome scroll-driven-animations demos checked). Past sections visibly shrink and slide behind the next — but the compression is decorative: no labels, no summaries, no retrieval. Past cards just exit. (https://tympanus.net/codrops/2024/01/31/on-scroll-animation-ideas-for-sticky-sections/)
- **A persistent shelf of retrievable items.** Rauno Freiberg's personal site (rauno.me) is built on an OS metaphor with a persistent dock — exactly a shelf of compact retrievable chips. But navigation-driven, not scroll-driven: content never compresses into the dock as a side effect of reading; no summarization; no LLM framing. (https://www.killerportfolio.com/by/rauno-freiberg)
- **LLM as portfolio structure — the chat-skin route.** Adrian Zumbrunnen's conversational website (2016) is the canonical pre-LLM chat portfolio (https://medium.com/swlh/my-website-is-now-conversational-because-why-not-46e1d8a369). Toukoum (Raphael Giraud, 2025), the viral "AI-native portfolio," makes the site an LLM chat with an avatar; since productized as Fastfolio; the GitHub repo documents the chat-native original (https://github.com/toukoum/portfolio). Michelangelo Zampogna's Conversational AI Portfolio is Awwwards-recognized (https://www.awwwards.com/inspiration/conversational-interface-conversational-ai-portfolio). All three take the opposite route to tonight's: they delete or bypass the document and replace scroll with chat. None instrument the scroll itself; nothing compacts. "Site as conversation" is a decade old and has zero novelty in 2026.
- **Text at multiple compression levels.** Telescopic Text (Joe Davis, 2008, still live) and Ted Nelson's StretchText (1967): a summary IS the collapsed state; detail is retrievable on demand. Deepest conceptual lineage for "sections compact into retrievable summaries" — but click-driven and inverted (start compressed, expand outward); no scroll drive, no shelf. Cite honestly as lineage. (https://www.telescopictext.org/)
- **Scrollytelling's pinned element.** Scrollama / The Pudding pattern: a persistent pinned graphic re-renders accumulated state while prose steps scroll past — functionally a shelf holding a compressed "story so far." But the prose itself is never summarized or retrievable; it is consumed and gone. No scrollytelling library found (Scrollama, GSAP ScrollTrigger, Vev, basement) ships a compact-past-sections-into-chips primitive. (https://pudding.cool/process/introducing-scrollama/)
- **"This site, compressed to fit a context window" as shipping infrastructure.** llms.txt (Jeremy Howard): sites publish a condensed markdown summary explicitly because "context windows are too small to handle most websites in their entirety." Real and shipping — but invisible infrastructure for machine readers. Making that compression the visible, human-facing UI of the page appears unclaimed. (https://llmstxt.org/)
- **Observation-only, no citation ships:** Apple product pages dock the product name + Buy button into a persistent local nav after the hero scrolls away — scroll-triggered docking of exactly one item, once (the supporting CSS-Tricks piece verifies Apple's scroll-animation technique, not the nav docking; URL not verified tonight). TurboTax-style auto-collapse accordions turn a completed form section into a one-line re-openable summary row — completion-driven, not scroll-driven (NN/g accordion guidance not fetched tonight). Both are pattern cousins; neither ships as a citation.

## 5. Calibrated novelty claims

Binding on tonight's build and on any copy derived from it. Same discipline as FACTS.md: use nothing below a grade you can live with in an interview; upgrading a grade or dropping a caveat is a hard failure. Evidence base: three research passes on July 7, 2026 (docs, changelogs, issue trackers, live sites); two primary OpenAI pages resisted fetch and were corroborated only via search snippets; unindexed design concepts and demos likely exist.

### May claim

**N1.** "No shipping chat or LLM product we could find spatially animates context departure — nothing drifts, shrinks toward, or lands in a persistent retrievable location." — *DEFENSIBLE.* Caveat that travels with it: based on docs, changelogs, and issue trackers as of July 2026; claim first-in-category-that-we-can-find, never first-ever.

**N2.** "The motion vocabulary is deliberately not novel: this is the genie effect doing its original job — a receipt showing where your window went — applied to context compaction." — *BULLETPROOF as lineage.* Genie has been the OS default since 2001; icon zoom teaches "where apps live"; Apple stated the rule in 2018 ("symmetric paths," "a consistent place where it lives"). Claim the transplant, not the move.

**N3.** "The specific synthesis — reading position as a visible context window whose evicted sections compact into labeled summary chips docked on a persistent shelf, retrievable by reversing the path — appears unclaimed among shipping sites and scrollytelling libraries." — *DEFENSIBLE.* Each ingredient exists separately (Section 4); no combination found. The two nearest neighbors to name when differentiating publicly: stacking-cards (compression without memory) and chat portfolios (memory without a document).

**N4.** "Stable spatial placement measurably speeds retrieval" — citable to Data Mountain (UIST '98) with Scarr/Cockburn/Gutwin 2013 as survey backing. — *DEFENSIBLE as cited research.* Caveat: this supports the design decision; it is not evidence that tonight's implementation improves anything. No user testing exists. Never imply measured results for this site.

**N5.** "Compaction without motion leaves the user no system image of where context went; the default story becomes 'my stuff was deleted.'" — *DEFENSIBLE as argument*, citable to Norman's system-image essay (quote-verified) and observable in Section 2's survey (several products advertise compaction as invisible). It is an argument from theory, not a measured user finding.

### May not claim

**X1.** Never "first to visualize context." Meters are commodity (Claude Code, Copilot, Cline, Roo). Damien Henry shipped scroll-as-token-volume as an explainer.

**X2.** Never "first summary you can expand where content used to be." Roo Code's ContextCondenseRow and OpenCode's summary message shipped it.

**X3.** Never "first conversational/AI/LLM portfolio." Zumbrunnen 2016, Toukoum 2025, Zampogna on Awwwards. The chat-skin frame has zero novelty; the defensible territory is the scroll/compaction mechanics only.

**X4.** Never claim novelty for scroll-driven compression of past sections (stacking-cards is everywhere) or for a persistent dock of retrievable items (rauno.me) or for multi-resolution text (StretchText 1967, Telescopic Text 2008). These are lineage, and the copy should say so.

**X5.** Never "first ever," "invented," "revolutionary," or any phrasing stronger than "no shipping product we could find" (STYLE.md rule 2 also bans the hype-words outright).

### Citation discipline for this mechanic

- Exactly four load-bearing citations if copy needs them: WWDC 803 (the rule), Data Mountain + Scarr/Cockburn/Gutwin (the evidence), Norman system image (the why), Shneiderman 1983 via NN/g (the persistent-object requirement). Everything else is lineage-by-demonstration.
- The iOS notification exit is a demonstration, never a footnote — Apple never documented its rationale; a citation there is the citation-clothes failure mode.
- Do not cite: the Apple HIG Motion page (body unextractable tonight), patent US6831666B1 (Canon, not genie), OpenAI memory pages (403 tonight), Google/Perplexity help pages (search-level only), VS Code 1.107 release notes (not fetched), CSS-Tricks Apple-pages piece or NN/g accordion page (not verified tonight). If any of these are wanted later, fetch and verify first.

### Design constraints the prior art forces (for the armature, tonight)

1. Chip positions on the shelf are stable — fixed edge, stable ordering, no reshuffling (Data Mountain; the mechanic dies otherwise).
2. Retrieval expands FROM the chip along the reversed compaction path; same chip, same position, every time (WWDC 803 symmetric paths).
3. The chip is continuously visible — never an invisible buffer behind a command (Shneiderman, continuous representation).
4. The compaction animation is the SUPPORT phase and one-gesture retrieval is the EXPLOIT phase (Scarr et al.); if reduced motion is on, the plain linearized view is the default and no spatial-memory claims apply to it.
