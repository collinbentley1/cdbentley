import { describe, expect, test } from "bun:test";

import {
  applyLights,
  applyRamp,
  assertBufferInRange,
  assertBufferShape,
  assertResolutionMonotone,
  assertSceneContract,
  createBuffer,
  resolutionForDepth,
  simplifyRamp,
  type SceneContext,
} from "../../sdk/index.ts";
import { CONTACT_BARS, restoreLineCells, scene } from "./scene.ts";

function makeContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(scene.tuning.cols, scene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

function runFrames(context: SceneContext, frames: number, dt = 1 / 60): void {
  for (let i = 0; i < frames; i++) {
    context.time += dt;
    scene.update(dt, context);
    applyLights(context.buffer, context.lights);
  }
}

describe("ocean-floor scene", () => {
  test("satisfies the frozen scene contract", () => {
    expect(() => assertSceneContract(scene)).not.toThrow();
  });

  test("writes a valid buffer across a long run with lights applied", () => {
    const context = makeContext();
    scene.init(context);
    runFrames(context, 180);
    assertBufferShape(context.buffer, scene.tuning.cols, scene.tuning.rows);
    assertBufferInRange(context.buffer);
  });

  test("sim is deterministic for a fixed timeline (no hidden randomness)", () => {
    const first = makeContext();
    scene.init(first);
    runFrames(first, 48);
    const snapshot = Float32Array.from(first.buffer.data);

    const second = makeContext();
    scene.init(second);
    runFrames(second, 48);

    let identical = true;

    for (let i = 0; i < snapshot.length; i++) {
      if (snapshot[i] !== second.buffer.data[i]) {
        identical = false;
        break;
      }
    }

    expect(identical).toBe(true);
  });

  test("compaction is monotone and bidirectional (same path down and back up)", () => {
    const config = scene.tuning.resolution ?? {};
    assertResolutionMonotone(config);

    const depths: number[] = [];

    for (let i = 0; i <= 120; i++) {
      depths.push(-0.5 + (3 * i) / 120);
    }

    const descending = depths.map((depth) => resolutionForDepth(depth, config));
    const surfacing = [...depths]
      .reverse()
      .map((depth) => resolutionForDepth(depth, config))
      .reverse();

    expect(surfacing).toEqual(descending);
    expect(resolutionForDepth(0, config)).toEqual({ bin: 1, collapse: 0, detail: 1, rampLevel: 0 });
    expect(resolutionForDepth(3, config)).toEqual({ bin: 4, collapse: 1, detail: 0, rampLevel: 2 });
  });

  test("contact bars are solid @-weight ink and keep it at ramp level 1", () => {
    const context = makeContext();
    scene.init(context);
    runFrames(context, 60);

    const rows = applyRamp(context.buffer, scene.tuning.ramp);
    const ramp = Array.from(scene.tuning.ramp);
    const brightest = ramp[ramp.length - 1] ?? "";
    expect(brightest).toBe("@");

    for (const bar of CONTACT_BARS) {
      for (let y = bar.y; y < bar.y + bar.h; y++) {
        const row = Array.from(rows[y] ?? "");

        for (let x = bar.x; x < bar.x + bar.w; x++) {
          expect(context.buffer.data[y * context.buffer.width + x]).toBe(1);
          expect(row[x]).toBe(brightest);
        }
      }
    }

    const level1 = Array.from(simplifyRamp(scene.tuning.ramp, 1, scene.tuning.minimalGlyph ?? "·"));
    expect(level1[level1.length - 1]).toBe("@");
  });

  test("the restore line is stamped bright over the water", () => {
    const cells = restoreLineCells();
    expect(cells.length).toBeGreaterThan(120);

    const context = makeContext();
    scene.init(context);
    runFrames(context, 30);

    for (const cell of cells) {
      expect(context.buffer.data[cell.y * context.buffer.width + cell.x] ?? 0).toBeGreaterThanOrEqual(0.7);
    }
  });

  test("open water stays on the sparse end of the ramp", () => {
    const context = makeContext();
    scene.init(context);
    runFrames(context, 90);

    let sum = 0;
    let count = 0;

    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < context.buffer.width; x++) {
        sum += context.buffer.data[y * context.buffer.width + x] ?? 0;
        count++;
      }
    }

    expect(sum / count).toBeLessThan(0.18);
  });
});
