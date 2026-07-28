/**
 * Tower scene ("corridor" slot) contract tests — DOM-free, run under
 * `bun test`. Mirrors the stage suite: contract, range, small grids,
 * compaction, purity, motion, plus composition invariants that pin the
 * tower's key structures via quantizeIndex bands.
 */

import { expect, test } from "bun:test";
import {
  applyLights,
  assertBufferInRange,
  assertBufferShape,
  assertResolutionMonotone,
  assertSceneContract,
  createBuffer,
  quantizeIndex,
  resolutionForDepth,
  type SceneContext,
} from "../../sdk/index.ts";
import { scene } from "./scene.ts";

function makeContext(cols = scene.tuning.cols, rows = scene.tuning.rows): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(cols, rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

/** Landmarks mirrored from the scene's proportional geometry. */
function landmarks(cols = scene.tuning.cols, rows = scene.tuning.rows) {
  const cx = Math.round(cols * 0.5);
  const shaftHalf = Math.max(3, Math.round(cols * 0.14));
  const shaftL = 4 * Math.max(0, Math.round((cx - shaftHalf) / 4));
  const shaftW = 4 * Math.max(2, Math.round((2 * shaftHalf + 1) / 4));

  return {
    arcadeTop: Math.round(rows * 0.8),
    cols,
    cx,
    ekgRow: Math.round(rows * 0.33),
    loggiaBot: Math.round(rows * 0.155),
    loggiaHalf: shaftHalf + Math.max(2, Math.round(cols * 0.02)),
    loggiaTop: Math.round(rows * 0.08),
    pierW: Math.max(2, Math.round(cols * 0.018)),
    rampLen: Array.from(scene.tuning.ramp).length,
    rows,
    shaftL,
    shaftR: shaftL + shaftW - 1,
    shaftTop: Math.round(rows * 0.2),
  };
}

/** Temporarily override motion tunables (restores in a finally). */
function withMotion<T>(overrides: Record<string, number>, run: () => T): T {
  const motion = scene.tuning.motion;
  const saved: Record<string, number> = {};

  for (const key of Object.keys(overrides)) {
    saved[key] = motion[key] as number;
    motion[key] = overrides[key] as number;
  }

  try {
    return run();
  } finally {
    for (const key of Object.keys(saved)) {
      motion[key] = saved[key] as number;
    }
  }
}

test("tower obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});

test("tower keeps its slot id and shelf copy", () => {
  expect(scene.id).toBe("corridor");
  expect(scene.summaryChip).toBe("Humana, 2020–2024 — safe rails for AI products.");
});

test("tower buffer stays finite in [0,1] across long runs and sleep gaps", () => {
  const context = makeContext();
  scene.init(context);

  for (let frame = 0; frame < 240; frame++) {
    context.time += 1 / 60;
    scene.update(1 / 60, context);
  }

  // Arbitrary sleep gap: the runner clamps dt to 0.1 but time may jump.
  context.time += 300;
  scene.update(0.1, context);

  // Deep-scroll depths never change what the sim writes (compaction is SDK-side).
  context.depth = 2.5;
  context.time += 1 / 60;
  scene.update(1 / 60, context);

  assertBufferShape(context.buffer, scene.tuning.cols, scene.tuning.rows);
  assertBufferInRange(context.buffer);
});

test("tower state is a function of time: a slept context matches a stepped one", () => {
  const slept = makeContext();
  scene.init(slept);
  slept.time = 300;
  scene.update(0.1, slept);

  const stepped = makeContext();
  scene.init(stepped);

  for (let frame = 0; frame < 5; frame++) {
    stepped.time = 300 - (4 - frame) * (1 / 60);
    scene.update(1 / 60, stepped);
  }

  expect(Array.from(stepped.buffer.data)).toEqual(Array.from(slept.buffer.data));
});

test("tower adapts to arbitrary small grids without wrapping or stray lights", () => {
  for (const [cols, rows] of [
    [20, 10],
    [64, 36],
  ] as const) {
    const context = makeContext(cols, rows);
    scene.init(context);
    context.time = 1;
    scene.update(1 / 60, context);

    assertBufferShape(context.buffer, cols, rows);
    assertBufferInRange(context.buffer);
    expect(context.lights.length).toBe(0);
  }

  // Restore the module-level base cache for the tuned grid.
  const context = makeContext();
  scene.init(context);
});

test("tower compaction is monotone and pure (scene uses SDK defaults)", () => {
  expect(() => {
    assertResolutionMonotone(scene.tuning.resolution ?? {});
  }).not.toThrow();
});

test("tower compaction round-trips: descending then ascending depths agree", () => {
  const config = scene.tuning.resolution ?? {};
  const depths: number[] = [];

  for (let d = -0.5; d <= 2.5; d += 0.05) {
    depths.push(Number(d.toFixed(2)));
  }

  const down = depths.map((depth) => resolutionForDepth(depth, config));
  const up = [...depths].reverse().map((depth) => resolutionForDepth(depth, config));
  up.reverse();

  for (let i = 0; i < depths.length; i++) {
    expect(up[i]).toEqual(down[i]!);
  }
});

test("tower is steady: identical time yields byte-identical buffers (no flicker)", () => {
  const a = makeContext();
  scene.init(a);
  a.time = 2.5;
  scene.update(1 / 60, a);
  const first = Float32Array.from(a.buffer.data);

  scene.update(1 / 60, a);

  expect(Array.from(a.buffer.data)).toEqual(Array.from(first));
});

test("tower heartbeat sweeps: the pulse moves even with the haze stilled", () => {
  withMotion({ hazeAmount: 0, hazeFloor: 0 }, () => {
    const context = makeContext();
    scene.init(context);

    context.time = 1;
    scene.update(1 / 60, context);
    const before = Float32Array.from(context.buffer.data);

    context.time = 6;
    scene.update(1 / 60, context);

    const { cols, ekgRow } = landmarks();
    let changed = 0;

    for (let y = ekgRow - 16; y <= ekgRow + 3; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.abs((before[y * cols + x] ?? 0) - (context.buffer.data[y * cols + x] ?? 0)) > 1e-6) {
          changed++;
        }
      }
    }

    expect(changed).toBeGreaterThan(0);
  });
});

test("tower arcade: the entablature crosses every column and the street line spans the base", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 1 / 60;
  scene.update(1 / 60, context);
  applyLights(context.buffer, context.lights); // the runner's post-update pass
  expect(context.lights.length).toBe(0);

  const { arcadeTop, cols, rampLen, rows } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const groundRow = Math.min(rows - 2, Math.round(rows * 0.955));

  for (let x = 0; x < cols; x++) {
    expect(band(x, arcadeTop)).toBeGreaterThanOrEqual(5); // '=' lintel, full-bleed
    expect(band(x, groundRow)).toBeGreaterThanOrEqual(3); // '-' street line
  }
});

test("tower shaft: corner piers hold one '|' band from belt to arcade — no density seam", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { arcadeTop, cols, rampLen, shaftL, shaftR, shaftTop } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Exactly the '|' band the whole way down: the density break lands on
  // the arcade entablature datum, never mid-shaft (the seam critique).
  for (let y = shaftTop + 1; y < arcadeTop; y++) {
    expect(band(shaftL, y)).toBe(4);
    expect(band(shaftR, y)).toBe(4);
  }

  // The pier base still outshines the pier top within the band (street
  // light climbs the tower), and the entablature below is denser yet.
  const lum = (x: number, y: number): number => context.buffer.data[y * cols + x] ?? 0;
  expect(lum(shaftL, arcadeTop - 2)).toBeGreaterThan(lum(shaftL, shaftTop + 2));
  expect(band(shaftL, arcadeTop)).toBeGreaterThanOrEqual(5);
});

test("tower neck: the corner piers climb unbroken from the shaft to the crown sill", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, loggiaBot, rampLen, shaftL, shaftR, shaftTop } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (let y = loggiaBot; y <= shaftTop; y++) {
    expect(band(shaftL, y)).toBeGreaterThanOrEqual(4); // '|' or brighter
    expect(band(shaftR, y)).toBeGreaterThanOrEqual(4);
  }

  // Heavy crown corners land directly over the piers ('=' or brighter).
  expect(band(shaftL + 1, loggiaBot - 2)).toBeGreaterThanOrEqual(5);
  expect(band(shaftR - 1, loggiaBot - 2)).toBeGreaterThanOrEqual(5);
});

test("tower shaft rhythm: three lit floor bands glow '-' across the bays", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { arcadeTop, cols, pierW, rampLen, shaftL, shaftR, shaftTop } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const span = Math.max(1, arcadeTop - shaftTop);
  const winL = shaftL + pierW;
  const winR = shaftR - pierW;

  for (const tb of [0.3, 0.52, 0.76]) {
    const y = shaftTop + 4 * Math.round((span * tb) / 4) + 1;

    for (let x = winL; x <= winR; x++) {
      if ((x - winL) % 4 === 0) {
        continue; // mullions stay dark across the band
      }

      expect(band(x, y)).toBeGreaterThanOrEqual(3); // '-' or brighter
    }
  }
});

test("tower neighbors: the low buildings at the edges carry lit windows", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, rampLen, rows } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const roofReach = Math.max(3, Math.round(cols * 0.11));
  const roofLY = Math.round(rows * 0.72);
  const roofRY = Math.round(rows * 0.75);
  const wx = Math.round(roofReach * 0.25);

  expect(band(wx, roofLY + 2)).toBeGreaterThanOrEqual(3); // '-' lit window
  expect(band(cols - 1 - wx, roofRY + 2)).toBeGreaterThanOrEqual(3);
});

test("tower crown: the loggia cornice reads '+' across its full projection", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, cx, loggiaHalf, loggiaTop, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (let x = cx - loggiaHalf; x <= cx + loggiaHalf; x++) {
    expect(band(x, loggiaTop)).toBeGreaterThanOrEqual(6); // '+'
  }
});

test("tower night: the sky above the heartbeat and beside the crown stays dark", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 2;
  scene.update(1 / 60, context);

  const { cols, cx, ekgRow, loggiaHalf, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // The R spikes climb 14 rows above the baseline, so night starts above.
  for (let y = 1; y <= ekgRow - 17; y++) {
    for (let x = 4; x < cx - loggiaHalf - 4; x++) {
      expect(band(x, y)).toBeLessThanOrEqual(1); // ' ' or '·' only
    }

    for (let x = cx + loggiaHalf + 5; x < cols - 4; x++) {
      expect(band(x, y)).toBeLessThanOrEqual(1);
    }
  }
});

test("tower heartbeat: the pulse train repeats along the horizon and the shaft occludes it", () => {
  const context = makeContext();
  scene.init(context);
  context.time = 2;
  scene.update(1 / 60, context);

  const { cols, ekgRow, pierW, rampLen, shaftL, shaftR } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // The baseline exists at '·' level in the open sky.
  expect(band(4, ekgRow)).toBeGreaterThanOrEqual(1);
  expect(band(cols - 5, ekgRow)).toBeGreaterThanOrEqual(1);

  // The beat spacing (76) is narrower than either sky flank, so at EVERY
  // phase a complex spikes to '#' both left AND right of the tower — the
  // repeating strip, not a lone blip.
  for (const t of [2, 7.8, 11, 16]) {
    context.time = t;
    scene.update(1 / 60, context);

    let peakL = 0;
    let peakR = 0;

    for (let y = ekgRow - 16; y <= ekgRow + 3; y++) {
      for (let x = 0; x < shaftL; x++) {
        peakL = Math.max(peakL, band(x, y));
      }

      for (let x = shaftR + 1; x < cols; x++) {
        peakR = Math.max(peakR, band(x, y));
      }
    }

    expect(peakL).toBeGreaterThanOrEqual(7);
    expect(peakR).toBeGreaterThanOrEqual(7);

    // Behind the shaft the heartbeat never shows: the inner shaft face
    // around the EKG row stays at architecture levels at every phase.
    for (let y = ekgRow - 16; y <= ekgRow + 2; y++) {
      for (let x = shaftL + pierW; x <= shaftR - pierW; x++) {
        expect(band(x, y)).toBeLessThanOrEqual(5);
      }
    }
  }
});
