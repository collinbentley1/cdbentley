import { describe, expect, test } from "bun:test";

import {
  applyRamp,
  assertBufferInRange,
  assertBufferShape,
  assertResolutionMonotone,
  assertSceneContract,
  binBuffer,
  createBuffer,
  resolutionForDepth,
  simplifyRamp,
  type SceneContext,
} from "../../sdk/index.ts";
import { deepShapeProbe, deepShapeScene } from "./scene.ts";

function freshContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(deepShapeScene.tuning.cols, deepShapeScene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

/** Step the scene n frames at dt, keeping context.time in sync. */
function run(context: SceneContext, seconds: number, dt = 1 / 60): void {
  const steps = Math.ceil(seconds / dt);

  for (let i = 0; i < steps; i++) {
    context.time += dt;
    deepShapeScene.update(dt, context);
  }
}

describe("deep-shape scene", () => {
  test("satisfies the frozen scene contract", () => {
    expect(() => {
      assertSceneContract(deepShapeScene);
    }).not.toThrow();
  });

  test("stays rare: nothing passes in 25s of default idle", () => {
    const context = freshContext();
    deepShapeScene.init(context);
    run(context, 25);

    const probe = deepShapeProbe();
    expect(probe.active).toBe(false);
    expect(probe.passes).toBe(0);
    assertBufferShape(context.buffer, deepShapeScene.tuning.cols, deepShapeScene.tuning.rows);
    assertBufferInRange(context.buffer);
  });

  test("idle clock does not accrue while compacted (deep depth)", () => {
    const context = freshContext();
    deepShapeScene.init(context);
    context.depth = 1.2;
    run(context, 5);
    expect(deepShapeProbe().idleTime).toBe(0);

    context.depth = 0;
    run(context, 5);
    expect(deepShapeProbe().idleTime).toBeGreaterThan(4);
  });

  test("sleep aborts the clock and any pass — you have to dwell", () => {
    const context = freshContext();
    deepShapeScene.init(context);
    run(context, 29);
    expect(deepShapeProbe().idleTime).toBeGreaterThan(28);

    deepShapeScene.sleep?.(context);
    expect(deepShapeProbe().idleTime).toBe(0);
    run(context, 5);
    expect(deepShapeProbe().passes).toBe(0);
  });

  test("gesture summon fires immediately, before the 1.5s idle mark", () => {
    const context = freshContext();
    const motion = deepShapeScene.tuning.motion;
    const previousSummon = motion.summon ?? 0;
    motion.summon = 1;

    try {
      deepShapeScene.init(context);
      // Half a second — well under the old 1.5s gate that silently dropped
      // an early gesture. The pass must already be running.
      run(context, 0.5);
      expect(deepShapeProbe().active).toBe(true);
    } finally {
      motion.summon = previousSummon;
    }
  });

  test("summoned pass: silhouette occludes, buffer stays valid, then it is gone", () => {
    const context = freshContext();
    const motion = deepShapeScene.tuning.motion;
    const previousSummon = motion.summon ?? 0;
    motion.summon = 1;

    try {
      deepShapeScene.init(context);
      run(context, 2.5);

      const started = deepShapeProbe();
      expect(started.active).toBe(true);
      expect(started.passes).toBe(1);

      // Stop summoning so the pass in flight is the only one.
      motion.summon = 0;

      // Mid-pass: head near mid-frame; the fore-body interior is a hole.
      const width = context.buffer.width;
      const traverseTime = motion.traverseTime ?? 20;

      for (let guard = 0; guard < 600; guard++) {
        const probe = deepShapeProbe();

        if (!probe.active || Math.abs(probe.headX - width / 2) < width * 0.2) {
          break;
        }

        run(context, 0.1, 0.1);
      }

      const mid = deepShapeProbe();
      expect(mid.active).toBe(true);

      // Sample straight down the column under the head's x: the darkest cell
      // must be at (or below) the silhouette floor band, darker than open
      // water ever gets, proving occlusion actually rendered.
      const column = Math.max(0, Math.min(width - 1, Math.round(mid.headX)));
      let darkest = 1;

      for (let y = 0; y < context.buffer.height; y++) {
        const v = context.buffer.data[y * width + column] ?? 1;

        if (v < darkest) {
          darkest = v;
        }
      }

      expect(darkest).toBeLessThan(0.02);
      assertBufferInRange(context.buffer);

      // Let the whole body clear the frame; the deep goes quiet again.
      run(context, traverseTime * 2, 0.1);
      const after = deepShapeProbe();
      expect(after.active).toBe(false);
      expect(after.passes).toBe(1);
      assertBufferInRange(context.buffer);
    } finally {
      motion.summon = previousSummon;
      deepShapeScene.init(freshContext());
    }
  });

  test("residue survives the deepest compaction: bin4 + level-2 ramp stays inked", () => {
    const context = freshContext();
    const motion = deepShapeScene.tuning.motion;
    const previousSummon = motion.summon ?? 0;
    motion.summon = 1;

    try {
      deepShapeScene.init(context);
      run(context, 2.5);
      expect(deepShapeProbe().active).toBe(true);

      // Scroll away mid-pass: past collapse start the pass aborts (rarity,
      // and the body can no longer swallow the glow core in the residue).
      context.depth = 1.2;
      run(context, 0.2);
      expect(deepShapeProbe().active).toBe(false);

      // At residue depth for a full minute, the pooled glow core must keep
      // at least one cell above the two-glyph threshold every sampled frame.
      const ramp = simplifyRamp(deepShapeScene.tuning.ramp, 2, deepShapeScene.tuning.minimalGlyph ?? "·");

      for (let i = 0; i < 30; i++) {
        run(context, 2);
        const rows = applyRamp(binBuffer(context.buffer, 4), ramp);
        const inked = rows.join("").split(ramp[1] ?? "·").length - 1;
        expect(inked).toBeGreaterThan(0);
      }
    } finally {
      motion.summon = previousSummon;
      deepShapeScene.init(freshContext());
    }
  });

  test("the glow lifts the ramp out of the black (no pass needed)", () => {
    const context = freshContext();
    deepShapeScene.init(context);
    run(context, 2);

    let brightest = 0;

    for (const value of context.buffer.data) {
      if (value > brightest) {
        brightest = value;
      }
    }

    expect(brightest).toBeGreaterThan(0.2);
    expect(brightest).toBeLessThanOrEqual(1);
    expect(deepShapeProbe().active).toBe(false);
  });

  test("context.lights stays empty by design (occlusion happens in-update)", () => {
    const context = freshContext();
    deepShapeScene.init(context);
    run(context, 1);
    expect(context.lights.length).toBe(0);
  });

  test("compaction is monotone and pure for this scene's config", () => {
    expect(() => {
      assertResolutionMonotone(deepShapeScene.tuning.resolution ?? {});
    }).not.toThrow();
  });

  test("depth round-trip re-blooms along the same path (bidirectional)", () => {
    const config = deepShapeScene.tuning.resolution ?? {};
    const depths: number[] = [];

    for (let d = -0.25; d <= 2.5; d += 0.05) {
      depths.push(d);
    }

    const down = depths.map((depth) => resolutionForDepth(depth, config));
    const up = [...depths].reverse().map((depth) => resolutionForDepth(depth, config));
    up.reverse();

    for (let i = 0; i < depths.length; i++) {
      expect(up[i]).toEqual(down[i]);
    }
  });

  test("dock glyph uses only glyphs from the scene ramp (and spoils nothing)", () => {
    const allowed = new Set(Array.from(deepShapeScene.tuning.ramp + (deepShapeScene.tuning.minimalGlyph ?? "·")));

    for (const row of deepShapeScene.dockGlyph) {
      expect(row.length).toBe(12);

      for (const glyph of row) {
        expect(allowed.has(glyph)).toBe(true);
      }
    }

    expect(deepShapeScene.dockGlyph.length).toBe(6);
  });

  test("copy rule: summaryChip never names the shape", () => {
    expect(deepShapeScene.summaryChip).toBe("Deeper — it doesn't have a name.");
  });

  test("all motion tunables are finite numbers (harness live-edit contract)", () => {
    const entries = Object.values(deepShapeScene.tuning.motion);
    expect(entries.length).toBeGreaterThan(0);

    for (const value of entries) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
