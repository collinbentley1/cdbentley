import { expect, test } from "bun:test";
import {
  assertBufferInRange,
  assertBufferShape,
  assertResolutionMonotone,
  assertSceneContract,
  binBuffer,
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

function stepTo(context: SceneContext, until: number, dt = 1 / 30): void {
  while (context.time < until) {
    context.time += dt;
    scene.update(dt, context);
  }
}

test("airport-gate obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});

test("resolution is monotone and identical in both scroll directions", () => {
  expect(() => {
    assertResolutionMonotone(scene.tuning.resolution ?? {});
  }).not.toThrow();

  // Scroll-down then scroll-up over the same depths must be the exact same
  // path (pure function, no hysteresis).
  const depths: number[] = [];

  for (let i = 0; i <= 100; i++) {
    depths.push(-0.5 + (3 * i) / 100);
  }

  const down = depths.map((d) => resolutionForDepth(d, scene.tuning.resolution ?? {}));
  const up = [...depths].reverse().map((d) => resolutionForDepth(d, scene.tuning.resolution ?? {}));
  up.reverse();

  for (let i = 0; i < depths.length; i++) {
    const forward = down[i];
    const backward = up[i];
    expect(backward).toBeDefined();
    expect(forward).toBeDefined();

    if (forward && backward) {
      expect(backward).toEqual(forward);
    }
  }
});

test("long run stays finite and in [0, 1] across depths and sleep-sized steps", () => {
  const context = makeContext();
  scene.init(context);

  for (let frame = 1; frame <= 400; frame++) {
    const dt = frame % 97 === 0 ? 0.1 : 1 / 30; // occasional clamped sleep-gap step
    context.time += dt;
    context.depth = 1.25 + 1.25 * Math.sin(frame / 40); // sweep 0 -> 2.5 and back
    scene.update(dt, context);

    if (frame % 80 === 0) {
      assertBufferShape(context.buffer, scene.tuning.cols, scene.tuning.rows);
      assertBufferInRange(context.buffer);
    }
  }
});

test("the departure board reshuffles, deterministically", () => {
  const boardRegion = (context: SceneContext): Float32Array => {
    // Data rows y=10..20 step 2, x=18..93 (excludes the clock/header row).
    const out: number[] = [];

    for (let y = 10; y <= 20; y += 2) {
      for (let x = 18; x <= 93; x++) {
        out.push(context.buffer.data[y * scene.tuning.cols + x] ?? 0);
      }
    }

    return Float32Array.from(out);
  };

  const a = makeContext();
  scene.init(a);
  stepTo(a, 2.0); // settled, before the first reshuffle at ~2.5s
  const before = boardRegion(a);
  stepTo(a, 7.4); // sweep (2.5 + 76 * 0.035 + 0.55) has fully settled
  const after = boardRegion(a);

  let changed = 0;

  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) {
      changed++;
    }
  }

  expect(changed).toBeGreaterThan(0);

  // Same seed, same steps -> identical buffer (sim is deterministic).
  const b = makeContext();
  scene.init(b);
  stepTo(b, 7.4);
  expect(Array.from(boardRegion(b))).toEqual(Array.from(after));
});

test("deep register leaves a residue that survives bin-4 + level-2 ramp", () => {
  // At rampLevel 2 the ramp is two glyphs with a 0.5 threshold; after 4x4
  // average-pooling, SOME cells must stay >= 0.5 or the scene forgets itself
  // to solid black instead of a sparse ghost.
  const context = makeContext();
  scene.init(context);
  context.depth = 1.2;
  stepTo(context, 1.0);

  const binned = binBuffer(context.buffer, 4);
  let survivors = 0;

  for (const v of binned.data) {
    if (v >= 0.5) {
      survivors++;
    }
  }

  expect(survivors).toBeGreaterThan(0);

  // And at depth 0 the residue lift must be inert: blank board cells stay at
  // the panel-background level, far below the level-2 threshold.
  const shallow = makeContext();
  scene.init(shallow);
  shallow.depth = 0;
  stepTo(shallow, 1.0);
  // y=11 is a blank panel row between data rows; x=50 is mid-board.
  const panelCell = shallow.buffer.data[11 * scene.tuning.cols + 50] ?? 1;
  expect(panelCell).toBeLessThan(0.2);
});

test("summary chip carries the final shelf copy", () => {
  expect(scene.summaryChip).toBe("OTseek, 2026 — a ChatGPT app in the first public wave.");
});
