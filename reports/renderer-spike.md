# Renderer spike: Canvas2D glyph atlas vs. WebGL luminance sampling

WS-C Phase A, July 7, 2026. Decides the renderer behind the frozen Scene SDK (`src/ocean/sdk/`, tag `scene-sdk-v1`).

## Verdict

**WebGL2** — a fullscreen pass sampling a pre-rasterized glyph-atlas texture from an R8 luminance texture, the fragment shader doing the luminance -> ramp-glyph mapping. Canvas2D glyph-atlas blitting remains in the SDK as the automatic fallback where WebGL2 is unavailable (`createGlyphRenderer` tries WebGL2, falls back, same frozen interface).

Canvas2D is the simpler path, but it does not hold 60fps at target density under the throttled profile in the cases that matter to this site (tables below). WebGL2 holds 60fps with >5x CPU headroom in every measured case, including worst case.

## Exactly what was measured

- **Code:** the spike pages drive the SAME code scenes will run: `/ocean/spike/webgl.html` uses the SDK production renderer (`src/ocean/sdk/renderer-webgl.ts`); `/ocean/spike/canvas2d.html` uses the SDK fallback (`src/ocean/sdk/renderer-canvas2d.ts`, dirty-cell drawImage from a glyph atlas, opaque cells, no clearRect). Both are fed by the same CPU-side value-noise water field (`src/ocean/spike/field.ts`, 2-octave fbm, 10-glyph ramp ` ·:~≈=+*#@`).
- **Harness:** `tools/bench-renderers.ts` (`bun run bench:renderers`). Headless Chrome 150.0.7871.101 via playwright-core 1.61.1 (channel "chrome"), CDP `Emulation.setCPUThrottlingRate(4)` as the throttled mobile profile, `deviceScaleFactor: 2` (the dpr cap), 600 measured rAF frames after 90 warmup frames per cell.
- **Metrics:** `cpuMs` = `performance.now()` around the frame callback (sim + render submission; GPU-side time is not captured — see caveats). Frame times = deltas between consecutive rAF timestamps.
- **Host:** Apple M1 Max, macOS 27.0. Headless Chrome had real GPU access: `ANGLE Metal Renderer: Apple M1 Max` (read via `WEBGL_debug_renderer_info`), not SwiftShader.
- **Modes:** `drift` = the brief's slow water breathing (dirty-cell best case, ~0.6-1% of cells change glyph per frame); `churn` = field speed x40 (fast-scroll turbulence; ~24-64% dirty); `full` = every cell invalidated every frame (what a compaction frame does: any ramp or bin change invalidates the whole grid). `churn`/`full` change nothing for WebGL — its cost is dirty-independent — so those rows double as controls.
- rAF in this headless profile paces at 120Hz (8.33ms), not 60. Read "avg fps" against the 120 ceiling; the binding budget is CPU <8ms/frame and frame times <16.7ms.

## Results (cpuThrottlingRate = 4, dpr 2, 600 frames)

### Desktop density: 200x90 grid @ 8px cell (canvas 1600x720 CSS px)

| path | mode | avg fps | p95 frame ms | avg cpu ms | p95 cpu ms | cpu >8ms | frames >17ms | dirty cells |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| canvas2d | drift | 120.0 | 9.2 | 1.59 | 2.2 | 0.0% | 0.0% | ~103/18000 |
| canvas2d | churn | 26.7 | 42.4 | 34.75 | 37.3 | 100.0% | 99.8% | ~11450/18000 |
| canvas2d | full | 19.1 | 58.9 | 43.17 | 45.8 | 100.0% | 100.0% | 18000/18000 |
| webgl2 | drift | 120.0 | 10.0 | 1.56 | 2.0 | 0.0% | 0.0% | n/a (all) |
| webgl2 | churn | 120.0 | 10.0 | 1.19 | 1.8 | 0.0% | 0.0% | n/a (all) |
| webgl2 | full | 120.0 | 10.1 | 1.19 | 1.8 | 0.0% | 0.0% | n/a (all) |

### Mobile density: 110x70 grid @ 6px cell (canvas 660x420 CSS px)

| path | mode | avg fps | p95 frame ms | avg cpu ms | p95 cpu ms | cpu >8ms | frames >17ms | dirty cells |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| canvas2d | drift | 120.0 | 9.2 | 0.87 | 1.2 | 0.0% | 0.0% | ~51/7700 |
| canvas2d | churn | 119.6 | 9.3 | 3.93 | 4.6 | 0.0% | 0.2% | ~1811/7700 |
| canvas2d | full | 43.3 | 26.8 | 13.11 | 14.0 | 99.5% | 84.2% | 7700/7700 |
| webgl2 | drift | 120.0 | 10.1 | 0.54 | 1.0 | 0.0% | 0.0% | n/a (all) |
| webgl2 | churn | 120.0 | 10.0 | 0.54 | 1.0 | 0.0% | 0.0% | n/a (all) |
| webgl2 | full | 120.0 | 10.1 | 0.55 | 1.0 | 0.0% | 0.0% | n/a (all) |

Throttle sanity check: the same matrix at `cpuThrottlingRate=1` gives e.g. canvas2d desktop churn 2.23ms avg cpu vs 34.75ms at 4x, and webgl2 desktop drift 0.85ms vs 1.56ms — the throttle is applied (JS-heavy work scales ~4x + overhead; the canvas2d churn case also loses raster parallelism when frames overrun).

## Why the "simplest that holds" is WebGL2 here

Canvas2D holds 120fps in calm drift — but this site's signature moments are exactly its failure modes:

1. **Compaction IS full invalidation.** Every ramp simplification or bin change (each threshold crossing during scroll, both directions) repaints the whole grid; the full-mode rows are that frame: 43ms CPU desktop under throttle. The signature animation would hitch on the frames where it matters most.
2. **Scroll-velocity -> turbulence churn.** Fast scroll churns the water field; churn mode at desktop density is 26.7fps / 34.8ms CPU — over budget by >4x.
3. **WebGL cost is flat** (~0.5-1.6ms CPU) regardless of dirty fraction, ramp swaps, or bin changes, and the per-frame upload is at most 18KB (200x90 R8 texture).

The Canvas2D path is not wasted: it ships as the automatic fallback (same `GlyphRenderer` interface), where it is adequate for drift-register rendering, plain-view users, and old hardware without WebGL2.

## Caveats, honestly

- Host GPU is an M1 Max via ANGLE Metal — not a mid-tier phone GPU. CPU throttling (the CDP knob) does not throttle the GPU. The WebGL workload is one pass over ~4.6M device px with two texture fetches per px and an 18KB texture upload per frame — well inside mid-tier mobile fill rates, but this rig cannot prove GPU-side frame times on a real phone. Phase C's full-run benchmark on the staging preview should re-check on real hardware before launch.
- `cpuMs` excludes GPU/compositor time for both paths (Canvas2D raster also happens off-thread in Chrome). Frame-time percentiles (rAF deltas) are the end-to-end check and agree with the CPU story.
- Headless rAF paced at 120Hz; on 60Hz devices there is strictly more per-frame budget.
- Canvas2D churn at mobile density (3.9ms avg) technically passes — only the full-invalidation case fails there. At desktop density both churn and full fail hard.

## Budget note

Built bundles (minified, gz): webgl spike (SDK renderer + field + bench) 4.3KB, canvas2d spike 4.2KB, full demo harness (whole SDK + UI) 6.4KB gz. Glyph atlases are rasterized at runtime from the system monospace stack (no font download, no font flash). The <300KB gz budget has ~290KB of headroom for Phase B/C.

## Reproduce

```
bun run bench:renderers            # full matrix, throttle 4x
BENCH_THROTTLE=1 bun run bench:renderers   # unthrottled baseline
```

Eyeball: `bun run dev`, then `/ocean/spike/webgl.html`, `/ocean/spike/canvas2d.html?churn=1&full=1`, `/ocean/harness/demo.html` (depth slider drives bidirectional compaction).
