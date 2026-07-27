# Descent full-run benchmark + page weight (WS-C Phase C)

July 9, 2026 (overnight of July 7 work order); updated July 14 after the live-review interaction pass; refreshed July 15 after the root flip + readability/integration pass; refreshed July 27 after the four-scene aesthetic pass (corridor, subway-platform, ocean-floor, deep-shape). Integrated page now served at `/` (root) on branch `redesign/armature-v1`; the bench navigates `/?bench=1`.

## Method (the Phase A method, full-run edition)

- `bun run build && bun tools/bench-descent.ts`
- Headless Chrome via playwright-core (channel "chrome"), CDP `Emulation.setCPUThrottlingRate(4)` as the throttled mobile profile, `deviceScaleFactor: 2` (the dpr cap).
- The page's `?bench=1` hook scripts a constant-speed scroll top → bottom → top over 26s (2s warmup excluded). The round trip exercises compaction in BOTH directions, every scene's sleep/wake crossing, one-load shelf collection/rewind retention, and the scroll-velocity → turbulence coupling at sustained fast-scroll churn.
- Metrics: rAF frame deltas (end-to-end pacing) + the summed per-frame CPU of every awake scene runner, the ocean field, and the animated ASCII bridge when visible (`performance.now()` around update+draw submission, as in Phase A).
- Host: Apple M1 Max, macOS 27, Chrome headless with real GPU (ANGLE Metal). Headless rAF paces at 120Hz; read avg fps against a 120 ceiling — the binding budget is CPU < 8ms/frame and frame times < 16.7ms.

## Results (cpuThrottlingRate = 4, dpr 2, 26s full run)

| profile | avg fps | avg frame ms | p95 frame ms | avg scene+field+bridge cpu ms | p95 cpu ms | frames >17ms | frames |
| --- | --- | --- | --- | --- | --- | --- | --- |
| desktop 1680x820 | 119.8 | 8.35 | 9.30 | 3.57 | 5.70 | 0.0% | 2877 |
| mobile 390x844 | 119.8 | 8.34 | 9.20 | 2.44 | 4.60 | 0.1% | 2877 |

Frame pacing is unchanged from the July 15 run (119.8 vs 120.0 avg fps is rAF-ceiling noise; p95 frame times actually improved). The aesthetic pass added ~0.5ms average scene CPU on both profiles (desktop 3.10 → 3.57, mobile 1.94 → 2.44) — the cost of the new per-scene texture work (wet-wax pool breaks, elliptical fixture pools + tile grime, sediment skirts + breathing shafts, wake taper + flank bloom) — still under half the 8ms budget at 4x throttle.

Verdict: 60fps holds with >2x frame-time headroom and CPU headroom at 4x throttle, during the worst window this page has (continuous scroll churn + compaction threshold crossings + 2-3 scenes awake at once + the always-on field + the bridge when visible). The renderer is the Phase A WebGL2 winner; its cost is dirty-independent, which is why compaction frames do not spike (see reports/renderer-spike.md).

## Page weight (gz, budget: glyph atlas + JS < 300KB)

| asset | raw | gz |
| --- | --- | --- |
| /assets/ocean/descent.js (all 11 scenes incl. kitchen-table + bridge + SDK + integration) | 75,342 B | 30,258 B |
| /index.html (inline CSS + single-layout static DOM) | 24,730 B | 7,589 B |
| glyph atlas | 0 B downloaded | rasterized at runtime from the system monospace stack (no font download, no font flash) |
| favicon.svg | 284 B | 217 B |

Total interactive payload = **38,064 B gz** (`gzip -c`) — about 262KB under the 300KB budget. `resume.pdf` (99,303 B) is reported separately: it is a direct download from the header / contact rail, not part of the page load. (The OG image, 76.7KB PNG, is metadata-fetched by crawlers only, not part of the page load.)

## Caveats (same shape as Phase A, honestly)

- CPU throttling does not throttle the GPU; the host GPU is an M1 Max via ANGLE Metal, not a mid-tier phone. The WebGL workload here is at most ~3 concurrent scene canvases + the field per frame; per-frame texture uploads stay in the tens of KB. Re-check on real hardware before launch.
- Headless rAF paced 120Hz; a 60Hz device has strictly more per-frame budget.
- Mobile profile runs the desktop scene grids CSS-scaled down (see TRIAGE.md — per-scene mobile grid sizing is a morning decision, not improvised tonight).

## Lighthouse (July 15, post-flip — root build, `noindex` removed)

Lighthouse 12, headless Chrome, against the built server (`bun dist/server.js`) at `http://localhost:PORT/` (root, the flipped ocean page). All four categories:

| config | performance | accessibility | best-practices | seo |
| --- | --- | --- | --- | --- |
| root, post-flip (July 15) | 100 | 100 | 100 | 100 |

SEO is now 100 because the `noindex` staging guard is removed — the first indexable state is the finished page. (July 9 baseline for reference: same 100/100/100 with SEO 60 while `noindex` was present; the sole SEO deduction was `is-crawlable`, the deliberate staging guard.) Three findings were fixed en route to 100 back in the July 9 pass: initial TBT 1,610ms (all renderer+atlas+scene inits in one task → staggered one-per-frame, now 0-10ms), CLS 1.0 (mode class landing after first paint → tiny pre-paint inline script), and dim-ink contrast lifted to >= 4.5:1.

## Reproduce

```
bun run build && bun tools/bench-descent.ts
BENCH_THROTTLE=1 bun tools/bench-descent.ts   # unthrottled baseline
```
