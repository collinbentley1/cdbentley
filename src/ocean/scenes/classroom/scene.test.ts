import { expect, test } from "bun:test";
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
} from "../../sdk/index.ts";
import type { SceneContext } from "../../sdk/index.ts";
import { scene } from "./scene.ts";

function freshContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(scene.tuning.cols, scene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

test("classroom obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});

test("classroom buffer stays shaped and in range over a long run with sleep gaps", () => {
  const context = freshContext();
  scene.init(context);

  // 20 simulated seconds at 60fps, then clamped-dt frames as after sleep.
  for (let frame = 0; frame < 1200; frame++) {
    context.time += 1 / 60;
    context.depth = Math.sin(frame / 90) + 0.6; // wander across the memory line
    scene.update(1 / 60, context);
  }

  for (let gap = 0; gap < 30; gap++) {
    context.time += 0.1;
    scene.update(0.1, context);
  }

  assertBufferShape(context.buffer, scene.tuning.cols, scene.tuning.rows);
  assertBufferInRange(context.buffer);
});

test("classroom survives extreme live-tuned motion values", () => {
  const context = freshContext();
  scene.init(context);
  const original = { ...scene.tuning.motion };

  try {
    scene.tuning.motion.ghostMax = 40;
    scene.tuning.motion.dustAmp = 9;
    scene.tuning.motion.moonIntensity = 12;
    scene.tuning.motion.ghostDuty = 3;
    scene.tuning.motion.ghostPeriod = 0;

    for (let frame = 0; frame < 90; frame++) {
      context.time += 1 / 60;
      scene.update(1 / 60, context);
    }

    assertBufferInRange(context.buffer);
  } finally {
    Object.assign(scene.tuning.motion, original);
  }
});

test("classroom compaction is monotone and pure (no scene overrides)", () => {
  expect(() => {
    assertResolutionMonotone(scene.tuning.resolution ?? {});
  }).not.toThrow();
});

test("classroom residue survives full compaction (bin 4 + ramp level 2 is not blank)", () => {
  const context = freshContext();
  context.depth = 1.2; // bin 4, rampLevel 2 under DEFAULT_RESOLUTION
  scene.init(context);

  for (let frame = 0; frame < 12; frame++) {
    context.time += 1 / 60;
    scene.update(1 / 60, context);
  }

  const res = resolutionForDepth(context.depth, scene.tuning.resolution ?? {});
  expect(res.bin).toBe(4);
  expect(res.rampLevel).toBe(2);

  const binned = binBuffer(context.buffer, res.bin);
  const ramp = simplifyRamp(scene.tuning.ramp, res.rampLevel, scene.tuning.minimalGlyph ?? "·");
  const rows = applyRamp(binned, ramp);
  const inkCells = rows.join("").split("").filter((c) => c !== " ").length;

  // The forgotten scene must still leave a skeleton, not a black hole.
  expect(inkCells).toBeGreaterThan(30);
});

test("classroom compaction round-trips: descending re-blooms along the ascending path", () => {
  const depths = [-0.5, 0, 0.2, 0.35, 0.5, 0.85, 1.0, 1.05, 1.2, 1.5, 2.0, 2.5];
  const down = depths.map((d) => resolutionForDepth(d, scene.tuning.resolution ?? {}));
  const up = [...depths].reverse().map((d) => resolutionForDepth(d, scene.tuning.resolution ?? {}));
  up.reverse();

  for (let i = 0; i < depths.length; i++) {
    expect(up[i]).toEqual(down[i]);
  }
});
