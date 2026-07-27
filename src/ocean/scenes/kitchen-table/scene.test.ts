import { expect, test } from "bun:test";

import { applyLights, assertSceneContract, createBuffer } from "../../sdk/index.ts";
import type { SceneContext } from "../../sdk/index.ts";
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

function advance(context: SceneContext, steps: number, dt: number): void {
  for (let i = 0; i < steps; i++) {
    context.time += dt;
    scene.update(dt, context);
  }
}

test("kitchen-table obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});

test("sim is a pure function of time: identical buffers across dt partitions", () => {
  const a = makeContext();
  const b = makeContext();
  scene.init(a);
  scene.init(b);

  advance(a, 6, 0.1); // 6 x 0.1s
  advance(b, 2, 0.3); // 2 x 0.3s — same total time, different partition

  expect(a.time).toBeCloseTo(b.time, 12);
  expect(Array.from(a.buffer.data)).toEqual(Array.from(b.buffer.data));
});

test("the phone is the only light source and its pool resolves hidden detail", () => {
  const context = makeContext();
  scene.init(context);
  advance(context, 3, 1 / 60);

  // One phone: every lobe rides the screen (same row, clustered on its axis).
  expect(context.lights.length).toBe(3);

  const [left, center, right] = context.lights;

  if (!left || !center || !right) {
    throw new Error("expected the three phone-glow lobes");
  }

  expect(left.y).toBe(center.y);
  expect(right.y).toBe(center.y);
  expect(Math.abs(right.x - left.x)).toBeLessThan(center.radius * 2);

  // Mean wood grain in a patch just left of the phone, before and after the
  // light pass: the lure lift is what makes the grain exist.
  const width = context.buffer.width;
  const px = Math.round(left.x) - 5;
  const py = Math.round(left.y);
  const patchMean = (): number => {
    let sum = 0;

    for (let y = py - 1; y <= py + 1; y++) {
      for (let x = px - 2; x <= px + 2; x++) {
        sum += context.buffer.data[y * width + x] ?? 0;
      }
    }

    return sum / 15;
  };

  const unlit = patchMean();

  applyLights(context.buffer, context.lights);

  const lit = patchMean();

  expect(unlit).toBeLessThan(1 / scene.tuning.ramp.length); // a whisper in the dark
  expect(lit).toBeGreaterThan(unlit + 0.1); // resolves inside the pool
});

test("glow radius never drops below the mobile floor", () => {
  const original = scene.tuning.motion.glowRadius ?? 19;
  scene.tuning.motion.glowRadius = 2;

  try {
    const context = makeContext();
    scene.init(context);
    advance(context, 2, 1 / 60);

    expect(context.lights.length).toBeGreaterThan(0);

    for (const light of context.lights) {
      expect(light.radius).toBeGreaterThanOrEqual(scene.tuning.motion.glowRadiusMin ?? 8);
    }
  } finally {
    scene.tuning.motion.glowRadius = original;
  }
});

test("a message arrival brightens the screen rows beyond the resting face", () => {
  const { msgLen = 2.4, msgPeriod = 13, msgPhase = 8.4 } = scene.tuning.motion;
  const context = makeContext();
  scene.init(context);

  // Rest: a moment with no message active.
  context.time = 1;
  scene.update(1 / 60, context);
  const restMax = maxLuminance(context);

  // Peak: the middle of the first arrival window.
  context.time = msgPeriod - msgPhase + msgLen / 2;
  scene.update(1 / 60, context);
  const peakMax = maxLuminance(context);

  expect(peakMax).toBeGreaterThan(restMax + 0.1);
});

function maxLuminance(context: SceneContext): number {
  let max = 0;

  for (const value of context.buffer.data) {
    max = Math.max(max, value);
  }

  return max;
}
