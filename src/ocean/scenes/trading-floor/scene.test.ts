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
import { tradingFloorScene } from "./scene.ts";

function freshContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(tradingFloorScene.tuning.cols, tradingFloorScene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

describe("trading-floor scene", () => {
  test("satisfies the frozen scene contract", () => {
    expect(() => {
      assertSceneContract(tradingFloorScene);
    }).not.toThrow();
  });

  test("writes a full valid buffer across a long run with sleep-gap dts", () => {
    const context = freshContext();
    tradingFloorScene.init(context);

    const dts = [1 / 60, 1 / 60, 0.1, 1 / 60, 0.1, 0.1, 1 / 60];

    for (let i = 0; i < 240; i++) {
      const dt = dts[i % dts.length] ?? 1 / 60;
      context.time += dt;
      tradingFloorScene.update(dt, context);
    }

    assertBufferShape(context.buffer, tradingFloorScene.tuning.cols, tradingFloorScene.tuning.rows);
    assertBufferInRange(context.buffer);
  });

  test("six lit monitors register six in-bounds light sources", () => {
    const context = freshContext();
    tradingFloorScene.init(context);

    expect(context.lights.length).toBe(6);

    for (const light of context.lights) {
      expect(light.intensity).toBeGreaterThan(0);
      expect(light.radius).toBeGreaterThan(0);
      expect(light.x).toBeGreaterThanOrEqual(0);
      expect(light.x).toBeLessThan(tradingFloorScene.tuning.cols);
      expect(light.y).toBeGreaterThanOrEqual(0);
      expect(light.y).toBeLessThan(tradingFloorScene.tuning.rows);
    }
  });

  test("compaction is monotone and pure for this scene's config", () => {
    expect(() => {
      assertResolutionMonotone(tradingFloorScene.tuning.resolution ?? {});
    }).not.toThrow();
  });

  test("depth round-trip re-blooms along the same path (bidirectional)", () => {
    const config = tradingFloorScene.tuning.resolution ?? {};
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

  test("dock glyph uses only glyphs from the scene ramp", () => {
    const allowed = new Set(Array.from(tradingFloorScene.tuning.ramp + (tradingFloorScene.tuning.minimalGlyph ?? "·")));

    for (const row of tradingFloorScene.dockGlyph) {
      for (const glyph of row) {
        expect(allowed.has(glyph)).toBe(true);
      }
    }
  });

  test("all motion tunables are finite numbers (harness live-edit contract)", () => {
    const entries = Object.values(tradingFloorScene.tuning.motion);
    expect(entries.length).toBeGreaterThan(0);

    for (const value of entries) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
