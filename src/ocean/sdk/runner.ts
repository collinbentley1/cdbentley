/**
 * Scene runner — the frame loop glue. Per frame, in this frozen order:
 *
 *   1. scene.update(dt, context)            (scene writes its buffer)
 *   2. applyLights(buffer, context.lights)  (lure and friends lift the ramp)
 *   3. res = resolutionForDepth(depth)      (pure, bidirectional)
 *   4. renderer.draw(buffer, simplifyRamp(ramp, res.rampLevel), { bin })
 *
 * Sleep/wake is IntersectionObserver-driven via bindSleepWake: offscreen
 * scenes get stop() + scene.sleep(); the ocean field (Phase C) is the only
 * always-on sim.
 */

import { createBuffer } from "./buffer.ts";
import { applyLights } from "./light.ts";
import { simplifyRamp } from "./ramp.ts";
import type { GlyphRenderer } from "./renderer.ts";
import { resolutionForDepth, smoothDetail, DEFAULT_RESOLUTION, type Resolution } from "./resolution.ts";
import type { SceneContext, SceneModule } from "./types.ts";

export interface SceneRunnerOptions {
  /** Called after each rendered frame (harness/bench instrumentation). */
  onFrame?: (info: { cpuMs: number; dt: number; resolution: Resolution }) => void;
  /** Clamp for dt spikes (tab switches). Default 0.1s. */
  maxDt?: number;
}

export interface SceneRunner {
  readonly scene: SceneModule;
  readonly context: SceneContext;
  readonly running: boolean;
  /** Damped continuous detail actually shown (see smoothDetail). */
  readonly detail: number;
  /** Last computed resolution. */
  readonly resolution: Resolution;
  /** Begin the requestAnimationFrame loop (idempotent). */
  start(): void;
  /** Halt the loop (idempotent). */
  stop(): void;
  /** Set depth-past-the-memory-line in viewport heights. */
  setDepth(depth: number): void;
  /** Advance exactly dt seconds and render one frame (tests, benches). */
  step(dt: number): void;
}

export function createSceneRunner(scene: SceneModule, renderer: GlyphRenderer, options: SceneRunnerOptions = {}): SceneRunner {
  const { cols, rows } = scene.tuning;

  if (renderer.cols !== cols || renderer.rows !== rows) {
    throw new Error(`runner: renderer grid ${renderer.cols}x${renderer.rows} != scene grid ${cols}x${rows}`);
  }

  const context: SceneContext = {
    awake: true,
    buffer: createBuffer(cols, rows),
    depth: 0,
    lights: [],
    time: 0,
  };

  const maxDt = options.maxDt ?? 0.1;
  const tau = scene.tuning.resolution?.dampingTau ?? DEFAULT_RESOLUTION.dampingTau;
  let resolution = resolutionForDepth(context.depth, scene.tuning.resolution ?? {});
  let detail = resolution.detail;
  let running = false;
  let rafId = 0;
  let lastTimestamp = -1;

  scene.init(context);

  const step = (dt: number): void => {
    const clamped = dt > maxDt ? maxDt : dt <= 0 ? 0 : dt;
    const started = performance.now();
    context.time += clamped;
    scene.update(clamped, context);

    if (context.lights.length > 0) {
      applyLights(context.buffer, context.lights);
    }

    resolution = resolutionForDepth(context.depth, scene.tuning.resolution ?? {});
    detail = smoothDetail(detail, resolution.detail, clamped, tau);
    const ramp = simplifyRamp(scene.tuning.ramp, resolution.rampLevel, scene.tuning.minimalGlyph ?? "·");
    renderer.draw(context.buffer, ramp, { bin: resolution.bin });
    options.onFrame?.({ cpuMs: performance.now() - started, dt: clamped, resolution });
  };

  const loop = (timestamp: number): void => {
    if (!running) {
      return;
    }

    const dt = lastTimestamp < 0 ? 1 / 60 : (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    step(dt);
    rafId = requestAnimationFrame(loop);
  };

  return {
    context,
    get detail(): number {
      return detail;
    },
    get resolution(): Resolution {
      return resolution;
    },
    get running(): boolean {
      return running;
    },
    scene,
    setDepth(depth: number): void {
      context.depth = depth;
    },
    start(): void {
      if (running) {
        return;
      }

      running = true;
      lastTimestamp = -1;
      rafId = requestAnimationFrame(loop);
    },
    step,
    stop(): void {
      running = false;

      if (rafId !== 0) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    },
  };
}

/**
 * IntersectionObserver-driven sleep/wake. Returns a disconnect function.
 * Scenes sleep when offscreen; only the Phase C ocean field skips this.
 */
export function bindSleepWake(runner: SceneRunner, element: Element, threshold = 0): () => void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!runner.context.awake) {
            runner.context.awake = true;
            runner.scene.wake?.(runner.context);
          }

          runner.start();
        } else {
          runner.stop();

          if (runner.context.awake) {
            runner.context.awake = false;
            runner.scene.sleep?.(runner.context);
          }
        }
      }
    },
    { threshold },
  );

  observer.observe(element);

  return (): void => {
    observer.disconnect();
  };
}
