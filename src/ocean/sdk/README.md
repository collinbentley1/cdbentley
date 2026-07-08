# Scene SDK — frozen contract (scene-sdk-v1)

Everything under `src/ocean/sdk/` is frozen at tag `scene-sdk-v1`. Scene agents build against this document and `index.ts` and edit nothing here. If the contract blocks you, record it for TRIAGE.md and work around it inside your scene directory — do not patch the SDK at 3am.

## The model

A scene is a simulation that writes a low-res **luminance buffer** (`Float32Array`, row-major, values in `[0, 1]`). The SDK quantizes that buffer through the scene's hand-tunable **ramp** (a string of glyphs ordered DARK -> BRIGHT, index 0 darkest) into a canvas glyph grid. Scenes never touch the canvas, never do DOM, never render — they write luminance.

Frame order (fixed, in `createSceneRunner`):

1. `scene.update(dt, context)` — scene rewrites `context.buffer`
2. `applyLights(context.buffer, context.lights)` — additive, clamped
3. `resolutionForDepth(context.depth, tuning.resolution)` — pure compaction
4. `renderer.draw(buffer, simplifyRamp(ramp, rampLevel, minimalGlyph), { bin })`

## Files a scene agent owns (and nothing else)

- `src/ocean/scenes/<sceneId>/` — `scene.ts` (exports the `SceneModule`), `harness.ts`, optional `*.test.ts`, any private helpers.
- `public/ocean/harness/<sceneId>.html` — copy of `public/ocean/harness/demo.html` with title + script src changed.

`tools/build.ts` auto-discovers `src/ocean/scenes/<sceneId>/harness.ts` and emits `/assets/ocean/harness/<sceneId>.js`; the page is served at `/ocean/harness/<sceneId>.html`. `bun test` auto-discovers `*.test.ts` in your scene directory. No build or server edits, ever.

Reserved scene ids: `beach`, `stage`, `classroom`, `corridor`, `trading-floor`, `airport-gate`, `subway-platform`, `ocean-floor`, `anglerfish`, `deep-shape`, `demo`. The deep-register creature is `deep-shape` — never any other name, anywhere.

## SceneModule (see types.ts)

```ts
export const scene: SceneModule = {
  id: "classroom",                       // kebab-case, from the reserved list
  tuning: {
    ramp: " ·:-=+*#%@",                  // dark -> bright; Collin hand-tunes
    minimalGlyph: "·",                   // level-2 residue glyph
    cols: 200, rows: 90,                 // full-res luminance grid
    cellW: 8, cellH: 8,                  // CSS px hints for the harness
    motion: { flickerHz: 7, drift: 0.2 }, // ALL numeric, live-editable in harness
    resolution: {},                       // optional threshold overrides
  },
  dockGlyph: [ /* exactly 6 strings x 12 chars */ ],
  summaryChip: "TODO(collin): one-line summary",
  init(ctx) { /* seed state; may push into ctx.lights */ },
  update(dt, ctx) { /* write ctx.buffer.data, values 0..1 */ },
  wake(ctx) {}, sleep(ctx) {},            // optional
};
```

`SceneContext`: `{ buffer, lights, time, depth, awake }`. `depth` is depth-past-the-memory-line in viewport heights (<= 0 = fully remembered); the harness slider drives it, Phase C wires it to scroll. Rules:

- Write only finite values in `[0, 1]`. `assertSceneContract` enforces this.
- All hand-tunables live in `tuning` (ramp string, grid, `motion` numbers) so Collin can tune without reading your sim.
- One quiet idiomatic motion per scene; water breathes on ` ·:~≈`-like ramps, architecture stands on `|=#@`-like ramps.
- Art bounds are law: the renderer already enforces true black, phosphor off-white, dpr cap 2. Never use `OCEAN_THEME.accent` in a scene — it is reserved for epistemic events in Phase C. No CRT effects of any kind.

## Compaction (bidirectional, pure)

`resolutionForDepth(depth, config?) -> { detail, bin, rampLevel, collapse }`

- Pure function of depth; scroll up re-blooms along the same path. No hysteresis. Defaults in `DEFAULT_RESOLUTION` (bin 2 at 0.35, bin 4 at 0.85, ramp level 1 at 0.5, level 2 at 1.05, collapse 1.0 -> 1.5, tau 0.12s).
- Grid bins 1 -> 2 -> 4 (renderer average-pools and draws bin-sized glyphs); ramp simplifies via `simplifyRamp` (full -> ~half sampled -> darkest + `minimalGlyph`).
- The only damping is `smoothDetail` on the continuous `detail` scalar (use it to fade motion amplitude if you like; read `runner.detail`).
- `collapse` (0 -> 1) is the dock progress: Phase C pairs it with `createDockAnimation(fromRect, toRect)` whose spring-on-bezier `step/reverse/frameAt` drifts your `dockGlyph` to its shelf slot and back along the same path.

## Lights

Push `{ x, y, radius, intensity }` (buffer cell coords) into `context.lights`; the runner stamps them after update. Smooth falloff, additive, clamped to 1. This is how the lure lifts the ramp out of the black.

## Sleep/wake

`bindSleepWake(runner, element)` drives start/stop + `wake`/`sleep` hooks from an IntersectionObserver. Scenes must tolerate arbitrary sleep gaps (dt is clamped to 0.1s). The ocean field (Phase C, integrator-owned) is the only always-on sim.

## Harness

`runHarness(scene)` renders your scene standalone with: depth slider (drive compaction both ways), pause/step, fps + cpu + dirty-cell readout, resolution state, and live number inputs for every `tuning.motion` key. Reference: `/ocean/harness/demo.html` (`demo-scene.ts` shows the file shape).

## Assertions (bun test)

From `assert.ts`, all DOM-free:

- `assertSceneContract(scene)` — shape + one init + 3 updates in range. Every scene ships a test that calls this.
- `assertBufferShape(buffer, cols, rows)`, `assertBufferInRange(buffer)`
- `assertRampApplied(buffer, ramp, expectedRows)`
- `assertResolutionMonotone(configOverrides?)` — run it if you override `tuning.resolution`.

Minimal scene test:

```ts
import { expect, test } from "bun:test";
import { assertSceneContract } from "../../sdk/index.ts";
import { scene } from "./scene.ts";

test("classroom obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});
```

## Renderer (chosen by the Phase A spike)

`createGlyphRenderer` is WebGL2 — a fullscreen pass sampling a glyph-atlas texture from an R8 luminance texture (the shader does luminance -> ramp mapping) — with an automatic Canvas2D glyph-atlas fallback where WebGL2 is unavailable. Canvas2D loses under compaction and churn because ramp/bin swaps invalidate every cell; WebGL cost is constant. Numbers: `reports/renderer-spike.md`. The interface is frozen; the implementation may change without touching scenes — another reason scenes must not render directly.

## Copy discipline

Any human-readable copy in a scene (summary chips, prose, labels) is a `TODO(collin)` placeholder unless it comes from FACTS.md at grade. Never invent claims; C-section claims are never rendered.
