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
import { anglerfishScene } from "./scene.ts";

function freshContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(anglerfishScene.tuning.cols, anglerfishScene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

describe("anglerfish scene", () => {
  test("satisfies the frozen scene contract", () => {
    expect(() => {
      assertSceneContract(anglerfishScene);
    }).not.toThrow();
  });

  test("writes a full valid buffer across a long run with sleep-gap dts", () => {
    const context = freshContext();
    anglerfishScene.init(context);

    const dts = [1 / 60, 1 / 60, 0.1, 1 / 60, 0.1, 0.1, 1 / 60];

    for (let i = 0; i < 240; i++) {
      const dt = dts[i % dts.length] ?? 1 / 60;
      context.time += dt;
      anglerfishScene.update(dt, context);
    }

    assertBufferShape(context.buffer, anglerfishScene.tuning.cols, anglerfishScene.tuning.rows);
    assertBufferInRange(context.buffer);
  });

  test("the lure is exactly one light source that drifts and stays in bounds", () => {
    const context = freshContext();
    anglerfishScene.init(context);
    expect(context.lights.length).toBe(1);

    const positions: Array<{ x: number; y: number }> = [];

    for (const target of [0.5, 30, 60]) {
      context.time = target;
      anglerfishScene.update(1 / 60, context);
      expect(context.lights.length).toBe(1);
      const light = context.lights[0];

      if (!light) {
        throw new Error("lure light missing");
      }

      expect(light.intensity).toBeGreaterThan(0);
      expect(light.radius).toBeGreaterThan(0);
      expect(light.x).toBeGreaterThanOrEqual(0);
      expect(light.x).toBeLessThan(anglerfishScene.tuning.cols);
      expect(light.y).toBeGreaterThanOrEqual(0);
      expect(light.y).toBeLessThan(anglerfishScene.tuning.rows);
      positions.push({ x: light.x, y: light.y });
    }

    const first = positions[0];
    const last = positions[positions.length - 1];

    if (!first || !last) {
      throw new Error("missing sampled positions");
    }

    const moved = Math.hypot(last.x - first.x, last.y - first.y);
    expect(moved).toBeGreaterThan(2);
  });

  test("the sim is stateless: buffer depends only on time, not dt history", () => {
    const a = freshContext();
    const b = freshContext();
    anglerfishScene.init(a);
    anglerfishScene.init(b);

    for (let i = 0; i < 60; i++) {
      a.time += 1 / 60;
      anglerfishScene.update(1 / 60, a);
    }

    for (let i = 0; i < 6; i++) {
      b.time += 0.1;
      anglerfishScene.update(0.1, b);
    }

    // Land both on the identical instant, then render once more: a sleep gap
    // and a smooth run must produce the same frame.
    a.time = 4.25;
    b.time = 4.25;
    anglerfishScene.update(1 / 60, a);
    anglerfishScene.update(0.1, b);

    expect(a.buffer.data).toEqual(b.buffer.data);
  });

  test("the deep stays black outside the pool; the lure lifts detail out of it", () => {
    const context = freshContext();
    anglerfishScene.init(context);
    context.time = 12;
    anglerfishScene.update(1 / 60, context);

    const data = context.buffer.data;
    let bright = 0;

    for (let i = 0; i < data.length; i++) {
      if ((data[i] ?? 0) >= 0.3) {
        bright++;
      }
    }

    // Before lights: only the esca core and teeth may pass 0.3 — a handful
    // of cells in a ~14k-cell grid. The deep is dark by construction.
    expect(bright).toBeGreaterThan(0);
    expect(bright).toBeLessThan(80);
  });

  test("compaction is monotone and pure for this scene's config", () => {
    expect(() => {
      assertResolutionMonotone(anglerfishScene.tuning.resolution ?? {});
    }).not.toThrow();
  });

  test("depth round-trip re-blooms along the same path (bidirectional)", () => {
    const config = anglerfishScene.tuning.resolution ?? {};
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
    const allowed = new Set(Array.from(anglerfishScene.tuning.ramp + (anglerfishScene.tuning.minimalGlyph ?? "·")));

    for (const row of anglerfishScene.dockGlyph) {
      for (const glyph of row) {
        expect(allowed.has(glyph)).toBe(true);
      }
    }
  });

  test("all motion tunables are finite numbers (harness live-edit contract)", () => {
    const entries = Object.values(anglerfishScene.tuning.motion);
    expect(entries.length).toBeGreaterThan(0);

    for (const value of entries) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
