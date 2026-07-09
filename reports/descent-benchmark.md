# Descent full-run benchmark + page weight (WS-C Phase C)

July 9, 2026 (overnight of July 7 work order). Integrated page at `/ocean/` on branch `redesign/armature-v1`.

## Method (the Phase A method, full-run edition)

- `bun run build && bun tools/bench-descent.ts`
- Headless Chrome via playwright-core (channel "chrome"), CDP `Emulation.setCPUThrottlingRate(4)` as the throttled mobile profile, `deviceScaleFactor: 2` (the dpr cap).
- The page's `?bench=1` hook scripts a constant-speed scroll top → bottom → top over 26s (2s warmup excluded). The round trip exercises compaction in BOTH directions, every scene's sleep/wake crossing, dock/re-bloom travel, and the scroll-velocity → turbulence coupling at sustained fast-scroll churn.
- Metrics: rAF frame deltas (end-to-end pacing) + the summed per-frame CPU of every awake scene runner and the ocean field (`performance.now()` around update+draw submission, as in Phase A).
- Host: Apple M1 Max, macOS 27, Chrome headless with real GPU (ANGLE Metal). Headless rAF paces at 120Hz; read avg fps against a 120 ceiling — the binding budget is CPU < 8ms/frame and frame times < 16.7ms.

## Results (cpuThrottlingRate = 4, dpr 2, 26s full run)

| profile | avg fps | avg frame ms | p95 frame ms | avg scene+field cpu ms | p95 cpu ms | frames >17ms | frames |
| --- | --- | --- | --- | --- | --- | --- | --- |
| desktop 1680x820 | 118.6 | 8.43 | 10.10 | 3.61 | 5.40 | 0.1% | 2848 |
| mobile 390x844 | 120.0 | 8.33 | 10.00 | 2.35 | 4.00 | 0.0% | 2881 |

Verdict: 60fps holds with >2x frame-time headroom and >2x CPU headroom at 4x throttle, during the worst window this page has (continuous scroll churn + compaction threshold crossings + 2-3 scenes awake at once + the always-on field). The renderer is the Phase A WebGL2 winner; its cost is dirty-independent, which is why compaction frames do not spike (see reports/renderer-spike.md).

## Page weight (gz, budget: glyph atlas + JS < 300KB)

| asset | raw | gz |
| --- | --- | --- |
| /assets/ocean/descent.js (all 10 scenes + SDK + integration) | 67,277 B | 27,143 B |
| /ocean/index.html (inline CSS + full plain-view DOM) | 23,055 B | 5,980 B |
| glyph atlas | 0 B downloaded | rasterized at runtime from the system monospace stack (no font download, no font flash) |
| favicon.svg | 284 B | 217 B |

Total interactive payload ≈ **33.3KB gz** — ~267KB under budget. (The OG image, 76.7KB PNG, is metadata-fetched by crawlers only, not part of the page load.)

## Caveats (same shape as Phase A, honestly)

- CPU throttling does not throttle the GPU; the host GPU is an M1 Max via ANGLE Metal, not a mid-tier phone. The WebGL workload here is at most ~3 concurrent scene canvases + the field per frame; per-frame texture uploads stay in the tens of KB. Re-check on real hardware before launch.
- Headless rAF paced 120Hz; a 60Hz device has strictly more per-frame budget.
- Mobile profile runs the desktop scene grids CSS-scaled down (see TRIAGE.md — per-scene mobile grid sizing is a morning decision, not improvised tonight).

## Lighthouse (headless Chrome via `bunx lighthouse`, local server)

| config | performance | accessibility | best-practices | seo |
| --- | --- | --- | --- | --- |
| staging as committed (`noindex` staging meta present) | 100 | 100 | 100 | 60 |
| launch config (same page, `noindex` removed) | 100 | 100 | 100 | 100 |

The only SEO deduction is `is-crawlable` — the deliberate `<meta name="robots" content="noindex">` staging guard, marked in the HTML for removal at ship. Three findings were fixed en route to 100: initial TBT 1,610ms (all 10 renderer+atlas+scene inits in one task → staggered one-per-frame, now 0-10ms), CLS 1.0 (mode class landing after first paint → tiny pre-paint inline script), and dim-ink contrast (epistemic dim weights lifted to >= 4.5:1: todo 0.45→0.58, grade tag 0.38→0.58, caveat 0.5→0.58).

## Reproduce

```
bun run build && bun tools/bench-descent.ts
BENCH_THROTTLE=1 bun tools/bench-descent.ts   # unthrottled baseline
```
