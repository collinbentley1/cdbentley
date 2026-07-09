# TRIAGE.md — morning pass for "The Ocean Remembers" (armature v1)

WS-C Phase C integrator, overnight July 7 work order. Ranking synthesizes each scene agent's self-assessment AND my own run-through of the integrated descent at `/ocean/` (headless Chrome, desktop 1440x900 + mobile 390x844; screenshots in `/Users/collin/overnight-20260707/descent-*.png`). Judgment calls below are flagged, not acted on — per the work order, quality decisions happen at 8am, not 3am.

**How to look:** `bun run dev`, open `http://localhost:3000/ocean/` (or any port via `PORT=…`). Plain view: `/ocean/?reduced` or the "expand full context" toggle. Per-scene harnesses with live tunables: `/ocean/harness/<sceneId>.html`. Full-run numbers: `reports/descent-benchmark.md`.

---

## Ranking (1 = strongest tonight)

### 1. beach — the thesis, wordless. KEEP.
The name stands intact for ~7s, washes, re-writes; contacts stand above the tide line as real DOM; the undertow is pure in depth (test-proven round-trip). In the integrated page the first fold is the site's best frame.
Refine: (a) after a deep round-trip the name takes up to ~11s to re-write (`redrawPeriod`/`redrawRate` — decide if re-bloom should sweep faster); (b) depth-1.25 residue is sparse dots — raise `deepLift` if the echo should read stronger; (c) `nameInk` 0.82 and the demo-family ramp await your master-ramp pass; (d) I set `contactMarker=0` (DOM block placed) — confirm you don't want the dashed underlay back; (e) mobile: the 200-col grid is CSS-scaled, not re-gridded (systemic note below).

### 2. ocean-floor — the destination reads. KEEP.
Mounds, marine snow, "restore full context" pixel line, contact bars at solid @-weight; the docked-shelf + floor frame (descent-floor.png) is the strongest integrated screenshot. Real links + a real restore button now overlay the bars/line.
Refine: (a) level-2 residue is deliberately sparse — density is one `moundGlow` slider; (b) the 3x5 "N" is a Π-ish compromise; (c) `lightIntensity` 0.1 → 0.06 if the halo reads theatrical; (d) the agent's idea worth judging: should the seven anonymous mounds echo the sibling dock glyphs?; (e) my floor-links overlay sits a hair above the @-bars — nudge `.floor-links` top% if it bothers you.

### 3. subway-platform — the true scene; copy decides it. KEEP (copy pending).
The headlight resolving the trench out of black is the best single moment in the deep half; residue keeps "a platform" between trains. Both copy slots are your pen and the scene means nothing until they land.
Refine: (a) `headlightPeriod` 42s → 50-60s for the real page?; (b) the tone call the agent deliberately did not make: should an occasional cycle actually pass through as a bright sweep ("threshold, not stuck")?; (c) wall-tile band may sit one band dimmer after the ramp pass.

### 4. trading-floor — quiet and legible; now the OG image. KEEP.
Six lit monitors scrolling digit-band luminance (no code-chosen characters), pre-dawn window band. Its harness render at t≈7s IS `public/assets/og/ocean-og.png` — re-shoot at will (`scratchpad prerender + sips crop`, or pick another moment/scene).
Refine: (a) only 3-5 of 6 screens survive to bin4/level2 — raise `screenBrightness` ~1.15 if six embers should reach the dock; (b) digits-in-the-ramp may fight a unified master ramp — swapping `tuning.ramp` keeps the sim; (c) mullion rhythm is metronome-regular.

### 5. airport-gate — the most thesis-literal mechanism; needs its receipt. KEEP.
Split-flap reshuffle IS luminance jumping quantization bins; the receipt-render-to-ASCII → condense-to-chip pipeline is complete end-to-end.
Refine: (a) the kiosk listing is a CLEARLY-FAKE placeholder — swap the real directory screenshot per FACTS C14 (`receipt.ts` has the 3-line recipe); (b) cure currently loops every 18s as a demo — latch it once per visit and pair the condense with `createDockAnimation` + the accent moment (accent currently fires only on DOM receipt chips; wiring the canvas cure to it is a small Phase-C follow-up I did not improvise); (c) seats read abstract; board frame weight is arguable.

### 6. anglerfish — the lure mechanic, exactly per brief. KEEP.
One SDK light source; everything else sub-threshold; stateless sim (dt-partition-proven). At bin4 it becomes a single drifting dot — right memory, maybe too little ember.
Refine: (a) lit-face hierarchy is one ramp step of separation — `bodyInk`/`lureIntensity` are the knobs if it reads "light with texture" instead of "jawed fish"; (b) illicium rod vanishes when lit (0.095 → ~0.12 for a dotted arc); (c) turn compression floor 0.34 → 0.5 if the squish reads as a glitch; (d) exactly ONE residue dot survives level-2 — raise `lureIntensity` ~0.55 for 2-4.

### 7. deep-shape — honest occlusion, properly rare. KEEP.
Silhouette is a moving hole in water/snow/light; eye glints only on alignment; aborts on scroll-away; residue never blinks out. Integration wired the discoverable gesture: double-click the deep section (or `~` while it's on screen) sets `motion.summon`.
Refine: (a) enormity is temporal, not spatial — `glowRadius` 18 → 20-22 for a bigger reveal is the first knob; (b) head reads as a smooth bite (radius profile is a code-edit, not a slider); (c) decide whether `@` at the lure core dilutes the eye-glint exclusivity; (d) cross-scene lighting (the anglerfish's own lure catching this body) is undefined in the frozen SDK — a v2 SDK question, flagged not solved.

### 8. corridor — reads as a corridor; muddy at the horizon. KEEP, hand-tune.
Perspective, flicker restraint (measured, never square-wave), floor pools breathing. Weakest points are compositional.
Refine: (a) the three deepest fixtures crowd into a stacked blur — fewer fixtures or a higher vanishing point; (b) door recesses at bin2 read as wall gaps; (c) vignette + geometry are init-time constants (code edit, not slider); (d) ramp " ·:-|=+*#@" is a first pass.

### 9. stage — calm and correct; two taste calls decide it. KEEP (probably).
Fly-system sway is genuinely quiet; the ghost light exercises the lure mechanic well. Ranked low only because its two open calls are the kind that change the scene's character, and its claims panel (Yale) carries the site's most delicate grading (see FACTS flags).
Refine: (a) ghost light keep/kill — it's a compositional addition beyond the brief's sentence, and its pool crosses the '|' band producing a thin ring of bars (master-ramp question); (b) sway moves in deliberate 1-cell jogs (anti-aliased version read worse — tried and reverted by the agent); (c) bin4 residue is ~3 dots — `hazeFloor` if it should read stronger.

### 10. classroom — the ghosts land; the residue trick needs your verdict. KEEP, decide the bake.
Non-lexical chalk ghosts on staggered cycles are the right idea and render zero readable text by construction. Ranked last not for craft but because its biggest engineering choice is the most debatable: init bakes THREE stroke-thickness bases selected by depth so line art survives bin4 (else it pooled to black).
Refine: (a) keep the multi-base bake or prefer scenes that vanish before docking (5-line revert, per the agent); (b) bin2 promotes frame verticals to '@' — chunky mid-forget; (c) `ghostMax` 0.2 → 0.25-0.3 for distance legibility; (d) moon pool/front-desk corner is busy; (e) education thread is ungraded in FACTS — prose stays TODO until you write it with a receipt.

---

## Integration layer — what I built and where it is weak (my own self-assessment)

Works, verified end-to-end (15 automated checks green, zero console errors; see WORKLOG): descent order 1→8 with the deep register between subway and floor; depth = viewport-heights past a memory line 0.5vh into each section (pure, bidirectional, no hysteresis; first bin-2 compaction at ~1.2 scrolls, dock by ~2.4); always-on ocean field with scroll-velocity→turbulence (tau 0.35s, saturates at 3.5 vh/s — deliberately subtle); shelf with 8 slots, hover/focus chips, sessionStorage, click-restore, "restore full context"; dock glyphs travel the SDK bezier sampled purely from collapse (so the restore path is the dock path backward, by construction); FACTS pipeline with machine-checked verbatim extraction; provenance packets (yale left / GitHub-and-live below / press right) with focus-triggered equivalents and the ONE accent firing only at receipt-dock; plain view = the static document itself (no-JS default), `?reduced` + `prefers-reduced-motion` + visible toggle; Lighthouse 100/100/100/100 in launch config.

Weak / for your eye:
1. **Prose-over-scene overlap** is the armature's roughest edge: claim blocks slide over the diorama mid-compaction (readable via per-block dark backing, but composition is first-pass; beach got a special-case offset so the name owns the first fold). The brief's "the ocean parts around it" deserves a real pass — possibly scenes reserving copy-slot regions like subway does.
2. **Slot 8 (ocean floor) never docks** — you stand on it, so it can't pass the memory line. I think that's honest; if you want all 8 glyphs docked at the end, the floor needs a synthetic dock trigger.
3. **Mobile is CSS-scaled desktop grids** (cells go sub-6px on a 390px phone). Scenes were built at fixed cols; re-gridding per breakpoint is scene-by-scene work (beach's mask auto-downscales; others untested). Perf is fine (see bench); legibility is the question.
4. **Compaction easing is the SDK spring/bezier defaults** — the signature animation awaits your hand (stiffness/damping/bow in `createDockAnimation`, plus `dampingTau`).
5. **Shelf slots pre-dock render as dim placeholder dots** — decide whether undocked slots should show scene numbers, nothing, or a fainter glyph preview.
6. **Airport cure ↔ accent moment** not wired on-canvas (see scene 5 refine (b)).
7. The `~` key summon listens page-wide when the deep section is visible — fine, but decide if dblclick alone is the intended gesture.

## Systemic findings (cross-scene, for the master pass)

- **bin4 + rampLevel2 threshold**: `simplifyRamp` level 2 has a hard 0.5 cut; average-pooling drags most scenes below it. Every scene that survives tonight does so via its own residue shaping (beach deepLift, subway edge line, airport panel lift, deep-shape core, classroom bake). If the master ramp changes, re-run each scene's bin4 check.
- **Master ramp**: five ramp families are in play (' ·:~≈=+*#@' variants, digits, ' ·:-|=+*#@'). Unifying is your brush; scene sims are ramp-agnostic.
- **Real-hardware check**: all numbers are M1 Max + CPU-throttle; GPU untested on a real phone (same caveat Phase A recorded).

## FACTS flags (every scene flag, consolidated + integrator's own)

Scene agents (verbatim condensed):
- beach: only rendered text is "Collin Bentley" (allowed); dock glyph carries eroded-name fragment " C·LL·N ··" (derived from allowed text — review); contact labels mechanical; no claims rendered.
- stage: no claims rendered in-scene; claim slot = R9 + C4 phrasing (President 2017 per C3) — now typeset by the pipeline (see below); nothing invented.
- classroom: C5 respected (school never branded; "international bilingual school, Beijing" framing only); education thread ungraded incl. "+60% DIBELS" — nothing rendered; ghosts are non-lexical by construction.
- corridor: S1 anchors the slot (typeset DEFENSIBLE + receipt chip); "2M-member refill model" NOT in FACTS — visible TODO(collin) in the page, never rendered as fact.
- trading-floor: scrolling figures are luminance noise, never text; L1 typeset with the C11/C12 binding limit inline ("demo-stage…never daily-trader use" carried as the claim's caveat).
- airport-gate: S3 + F4 typeset (BULLETPROOF, heavy ink) with S3's withdrawn-at-dissolution caveat inline; C14 placeholder receipt clearly fake pending your screenshot.
- subway: no claims by design; both copy slots TODO(collin), test-enforced.
- ocean-floor: only rendered words "restore full context" (brief-fixed copy); contacts were placeholder bars, now real DOM links.
- anglerfish / deep-shape: zero claims, zero text; deep-shape never named anywhere (grep-audited; integration + PR keep the neutral id).

Integrator (new tonight — review these):
1. **Parser scope**: `tools/facts-claims.ts` parses sections S/F/L/R only. C is excluded as binding; A/ST/T are ALSO excluded (interview/ops material — conservative call so the public repo never carries them). The committed `claims.generated.ts` contains ONLY the 8 rendered fragments, not the whole ledger — public surface = rendered surface.
2. **Verbatim guarantee**: every rendered claim/caveat is machine-checked to be a whitespace-normalized verbatim substring of its FACTS entry; generation throws otherwise. Grades map at grade; anything ungraded renders as `UNGRADED (receipt-carried)` in dim ink — never DEFENSIBLE weight or heavier.
3. **R9 receipt chip href** links collegearts.yale.edu/events/shows-screenings/reverie (verified 200 tonight). That URL is FACTS C4's receipt, used as the one verified yale.edu link; R9's own bio-page receipt has no URL in FACTS, so it stays text-only. Confirm you're happy with the pairing.
4. **S4 in the colophon** is the approved-verbatim spine sentence, rendered UNGRADED-dim (its components include NEEDS-CAVEAT S2; the caveat lives in FACTS, not the sentence). If you want S2's caveat shadowing the colophon line, say the word.
5. **L1 second fragment** (the 11-domain-routers receipts list) renders with a non-linking chip "v1 repo (private; …)" — mechanical label, review wording.
6. **LinkedIn URL** answers 999 to curl (bot wall); taken as-is from the WS-A verified patch branch.
7. **Meta/OG description** is deliberately minimal mechanical copy ("Collin Bentley — portfolio. A terminal ocean that remembers like a model.") — replace with your line; `noindex` staging guard is marked for removal at ship.

## Morning decision list (fastest path through)

1. Master ramp pass + compaction easing by hand (SDK constants).
2. Keep/kill: stage ghost light; classroom multi-base bake; corridor fixture count.
3. Copy: scene 7 (sign + body), beach line, colophon, 8 summary chips, meta description, resume link.
4. Swap airport C14 screenshot; decide cure latch + accent pairing.
5. Prose/scene overlap art direction; undocked-slot look; slot-8 policy.
6. Mobile grid strategy (re-grid vs CSS scale).
7. Root route flip (`/` vs `/ocean/`) and `noindex` removal — launch decisions, not tonight's.
