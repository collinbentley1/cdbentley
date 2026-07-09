import { expect, test } from "bun:test";
import {
  assertBufferInRange,
  assertBufferShape,
  assertResolutionMonotone,
  assertSceneContract,
  createBuffer,
  resolutionForDepth,
} from "../../sdk/index.ts";
import type { SceneContext } from "../../sdk/index.ts";
import { CONTACT_REGION } from "./contact-links.ts";
import { beachDebug, scene } from "./scene.ts";

function makeContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(scene.tuning.cols, scene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

function run(context: SceneContext, seconds: number, dt: number, each?: () => void): void {
  const frames = Math.round(seconds / dt);

  for (let f = 0; f < frames; f++) {
    context.time += dt;
    scene.update(dt, context);
    each?.();
  }
}

test("beach obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});

test("buffer keeps shape and range through several tide cycles", () => {
  const context = makeContext();
  scene.init(context);
  run(context, 16, 0.05, () => {
    assertBufferShape(context.buffer, scene.tuning.cols, scene.tuning.rows);
  });
  assertBufferInRange(context.buffer);
});

test("compaction is monotone and bidirectional (pure round trip)", () => {
  assertResolutionMonotone(scene.tuning.resolution ?? {});

  const depths: number[] = [];

  for (let d = 0; d <= 2.5 + 1e-9; d += 0.05) {
    depths.push(d);
  }

  const down = depths.map((d) => resolutionForDepth(d, scene.tuning.resolution ?? {}));
  const up = [...depths].reverse().map((d) => resolutionForDepth(d, scene.tuning.resolution ?? {})).reverse();

  for (let i = 0; i < depths.length; i++) {
    expect(down[i]).toEqual(up[i] ?? down[i]);
  }
});

test("the tide erodes the name and the sand redraws it", () => {
  const context = makeContext();
  scene.init(context);

  let minMean = 1;
  let recoveredAfterMin = 1;

  run(context, 60, 0.05, () => {
    const mean = beachDebug.meanNameStrength();

    if (mean < minMean) {
      minMean = mean;
      recoveredAfterMin = mean;
    } else if (mean > recoveredAfterMin) {
      recoveredAfterMin = mean;
    }
  });

  // Deterministic sim (seeded noise): observed minMean ~0.49, full recovery.
  expect(minMean).toBeLessThan(0.9);
  expect(recoveredAfterMin).toBeGreaterThan(minMean + 0.1);
});

test("the contact block region stays above the tide at depth 0", () => {
  const context = makeContext();
  scene.init(context);

  const regionBottomRow = Math.round((CONTACT_REGION.yFrac + CONTACT_REGION.hFrac) * scene.tuning.rows);

  run(context, 30, 0.05, () => {
    expect(beachDebug.minEdgeRowLastFrame()).toBeGreaterThan(regionBottomRow + 4);
  });
});

test("undertow climbs with depth and returns exactly on scroll-up", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 3;

  scene.update(0, context);
  const edgeAtSurface = beachDebug.minEdgeRowLastFrame();

  context.depth = 1;
  scene.update(0, context);
  const edgeAtDepth = beachDebug.minEdgeRowLastFrame();

  context.depth = 0;
  scene.update(0, context);
  const edgeBack = beachDebug.minEdgeRowLastFrame();

  expect(edgeAtDepth).toBeLessThan(edgeAtSurface - 20);
  expect(Math.abs(edgeBack - edgeAtSurface)).toBeLessThan(1e-6);
});
