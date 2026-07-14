/**
 * Corridor scene contract tests — DOM-free, run under `bun test`.
 */

import { describe, expect, test } from "bun:test";

import {
  assertBufferInRange,
  assertBufferShape,
  assertResolutionMonotone,
  assertSceneContract,
  createBuffer,
  resolutionForDepth,
  type SceneContext,
} from "../../sdk/index.ts";
import { scene } from "./scene.ts";

function makeContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(scene.tuning.cols, scene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

describe("corridor scene", () => {
  test("satisfies the frozen scene contract", () => {
    assertSceneContract(scene);
  });

  test("compaction is monotone and pure for this scene's config", () => {
    assertResolutionMonotone(scene.tuning.resolution ?? {});
  });

  test("compaction round-trips: descending then ascending the same depths is identical", () => {
    const config = scene.tuning.resolution ?? {};
    const depths = [-0.25, 0, 0.2, 0.4, 0.6, 0.9, 1.1, 1.4, 1.8, 2.5];
    const down = depths.map((depth) => resolutionForDepth(depth, config));
    const up = [...depths].reverse().map((depth) => resolutionForDepth(depth, config));

    up.reverse();
    expect(up).toEqual(down);
  });

  test("writes finite luminance in [0, 1] at the tuned grid size", () => {
    const context = makeContext();

    scene.init(context);

    for (let frame = 0; frame < 10; frame++) {
      context.time += 1 / 60;
      scene.update(1 / 60, context);
    }

    assertBufferShape(context.buffer, scene.tuning.cols, scene.tuning.rows);
    assertBufferInRange(context.buffer);
  });

  test("tolerates arbitrary sleep gaps (state is a function of time, not dt)", () => {
    const slept = makeContext();

    scene.init(slept);
    slept.time = 300; // wake after a long offscreen gap
    scene.update(0.1, slept);
    assertBufferInRange(slept.buffer);

    // A context that reaches the same time in small steps sees the same frame.
    const stepped = makeContext();

    scene.init(stepped);

    for (let frame = 0; frame < 5; frame++) {
      stepped.time = 300 - (4 - frame) * (1 / 60);
      scene.update(1 / 60, stepped);
    }

    expect(Array.from(stepped.buffer.data)).toEqual(Array.from(slept.buffer.data));
  });

  test("flicker is restrained: mean luminance never jumps frame to frame", () => {
    const context = makeContext();

    scene.init(context);

    let previousMean = Number.NaN;

    for (let frame = 0; frame < 240; frame++) {
      context.time += 1 / 60;
      scene.update(1 / 60, context);

      let sum = 0;

      for (const v of context.buffer.data) {
        sum += v;
      }

      const mean = sum / context.buffer.data.length;

      if (!Number.isNaN(previousMean)) {
        expect(Math.abs(mean - previousMean)).toBeLessThan(0.01);
      }

      previousMean = mean;
    }
  });

  test("summary chip carries the final shelf copy", () => {
    expect(scene.summaryChip).toBe("Humana, 2020–2024 — safe rails for AI products.");
  });
});
