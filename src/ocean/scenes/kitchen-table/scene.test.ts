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

/** Landmarks mirrored from the scene's proportional Super 55 geometry. */
function landmarks(cols = scene.tuning.cols, rows = scene.tuning.rows) {
  const cx = Math.round(cols * 0.5);
  const crownR = Math.max(4, Math.round(Math.min(rows * 0.26, cols * 0.115)));
  const headTop = Math.max(1, Math.round(rows * 0.04));
  const crownY = headTop + Math.max(3, Math.round(crownR * 0.55));
  const headBot = Math.min(rows - 4, crownY + Math.max(4, Math.round(crownR * 1.3)));
  const chinHalf = Math.max(2, Math.round(crownR * 0.35));
  const bandMid = Math.min(headBot - 1, crownY + Math.max(1, Math.round((headBot - crownY) * 0.62)));
  const pivotY = Math.min(bandMid - 1, crownY + Math.max(1, Math.round((headBot - crownY) * 0.5)));
  const uBot = Math.min(rows - 3, headBot + Math.max(3, Math.round(rows * 0.058)));
  const knuckleBot = Math.min(rows - 2, uBot + 3);
  const floorRow = Math.max(knuckleBot + 1, rows - 3);

  // The egg half-width at the pivot row (mirrors scene.ts eggHalfWidth),
  // giving the yoke-arm column: round(hw) + YOKE_GAP(3) + 1.
  const tPivot = (pivotY - crownY) / Math.max(1, headBot - crownY);
  const cPivot = Math.cos((tPivot * Math.PI) / 2);
  const armX = Math.round(chinHalf + (crownR - chinHalf) * cPivot * cPivot) + 4;

  return {
    armX,
    bandMid,
    baseHalf: Math.max(chinHalf + 4, Math.round(cols * 0.103)),
    baseTop: Math.max(knuckleBot + 1, floorRow - Math.max(3, Math.round(rows * 0.05))),
    chinHalf,
    cols,
    crownR,
    crownY,
    cx,
    floorRow,
    headBot,
    headTop,
    knuckleBot,
    pivotY,
    rampLen: Array.from(scene.tuning.ramp).length,
    rows,
    uBot,
    waveRow: Math.round(rows * 0.78),
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

test("kitchen-table obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});

test("kitchen-table buffer stays finite in [0,1] across long runs and sleep gaps", () => {
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

test("kitchen-table adapts to arbitrary small grids without wrapping or stray lights", () => {
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

test("kitchen-table compaction is monotone and pure (scene uses SDK defaults)", () => {
  expect(() => {
    assertResolutionMonotone(scene.tuning.resolution ?? {});
  }).not.toThrow();
});

test("kitchen-table compaction round-trips: descending then ascending depths agree", () => {
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

test("kitchen-table is steady: identical time yields byte-identical buffers (no flicker)", () => {
  const a = makeContext();
  scene.init(a);
  a.time = 2.5;
  scene.update(1 / 60, a);
  const first = Float32Array.from(a.buffer.data);

  scene.update(1 / 60, a);

  expect(Array.from(a.buffer.data)).toEqual(Array.from(first));
});

test("kitchen-table is a pure function of time: identical buffers across dt partitions", () => {
  const a = makeContext();
  const b = makeContext();
  scene.init(a);
  scene.init(b);

  for (let i = 0; i < 6; i++) {
    a.time += 0.1;
    scene.update(0.1, a);
  }

  for (let i = 0; i < 2; i++) {
    b.time += 0.3;
    scene.update(0.3, b);
  }

  expect(a.time).toBeCloseTo(b.time, 12);
  expect(Array.from(a.buffer.data)).toEqual(Array.from(b.buffer.data));
});

test("kitchen-table speaks: the voice arcs propagate even with haze and waveform stilled", () => {
  withMotion({ hazeAmount: 0, hazeFloor: 0, waveAmp: 0 }, () => {
    const context = makeContext();
    scene.init(context);

    context.time = 1;
    scene.update(1 / 60, context);
    const before = Float32Array.from(context.buffer.data);

    // Half a wavelength later (speed 4, wavelength 16): crests at new radii.
    context.time = 3;
    scene.update(1 / 60, context);

    const { bandMid, cols, crownR, cx } = landmarks();
    let changed = 0;

    for (let y = bandMid - 10; y <= bandMid + 10; y++) {
      for (let x = cx + crownR + 12; x <= Math.min(cols - 2, cx + 92); x++) {
        if (Math.abs((before[y * cols + x] ?? 0) - (context.buffer.data[y * cols + x] ?? 0)) > 1e-6) {
          changed++;
        }
      }
    }

    expect(changed).toBeGreaterThan(20);
  });
});

test("kitchen-table head is an egg: wide crown, narrow chin, the band core hottest", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);
  applyLights(context.buffer, context.lights); // the runner's post-update pass

  expect(context.lights.length).toBe(0);

  const { armX, bandMid, chinHalf, cols, crownR, crownY, cx, headBot, headTop, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Crown: '+'-weight outline at the apex and at both widest shoulders.
  expect(band(cx, headTop)).toBeGreaterThanOrEqual(6);
  expect(band(cx - crownR, crownY)).toBeGreaterThanOrEqual(6);
  expect(band(cx + crownR, crownY)).toBeGreaterThanOrEqual(6);

  // The chin is narrow: the wedge between chin and yoke arms is dark on
  // both sides — chin-adjacent AND arm-adjacent columns are empty air at
  // chin height (no dome-on-shaft).
  expect(band(cx - chinHalf - 5, headBot - 2)).toBeLessThanOrEqual(1);
  expect(band(cx + chinHalf + 5, headBot - 2)).toBeLessThanOrEqual(1);
  expect(band(cx - armX + 3, headBot - 2)).toBeLessThanOrEqual(1);
  expect(band(cx + armX - 3, headBot - 2)).toBeLessThanOrEqual(1);

  // The nameplate band core is '@' and the global maximum lives there.
  expect(band(cx, bandMid)).toBe(8);

  let maxV = -1;
  let maxY = -1;

  for (let i = 0; i < context.buffer.data.length; i++) {
    const v = context.buffer.data[i] ?? 0;

    if (v > maxV) {
      maxV = v;
      maxY = Math.floor(i / cols);
    }
  }

  expect(Math.abs(maxY - bandMid)).toBeLessThanOrEqual(1);
});

test("kitchen-table cradle: yoke arms, pivot bosses, and a strap under the chin", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { armX, chinHalf, cols, cx, headBot, pivotY, rampLen, uBot } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Pivot-screw bosses cap both arms beside the head ('#' screw centers).
  expect(band(cx - armX - 2, pivotY)).toBeGreaterThanOrEqual(7);
  expect(band(cx + armX + 2, pivotY)).toBeGreaterThanOrEqual(7);

  // Straight vertical arms run down the sides at '|' weight or better.
  expect(band(cx - armX - 1, pivotY + 6)).toBeGreaterThanOrEqual(4);
  expect(band(cx + armX + 1, pivotY + 6)).toBeGreaterThanOrEqual(4);

  // The dark wedge between the narrowing egg and the arms: the cradle
  // HOLDS the head across visible empty air.
  expect(band(cx - chinHalf - 5, headBot - 3)).toBeLessThanOrEqual(1);
  expect(band(cx + chinHalf + 5, headBot - 3)).toBeLessThanOrEqual(1);

  // The U-strap closes under the chin, with a dark throat above it.
  expect(band(cx, uBot - 1)).toBeGreaterThanOrEqual(4);
  expect(band(cx, headBot + 1)).toBeLessThanOrEqual(1);
});

test("kitchen-table stand: thin pole, low wide two-tier base, full-bleed floor line", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { baseHalf, baseTop, cols, cx, floorRow, knuckleBot, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // The pole is present ('=' or better) top and bottom...
  expect(band(cx, knuckleBot + 4)).toBeGreaterThanOrEqual(5);
  expect(band(cx, baseTop - 5)).toBeGreaterThanOrEqual(5);

  // ...and THIN: a few cells off-center the air is dark (the old thick
  // fluted column would have lit these).
  expect(band(cx - 6, baseTop - 6)).toBeLessThanOrEqual(1);
  expect(band(cx + 8, baseTop - 6)).toBeLessThanOrEqual(1);

  // The base: a '+' tier top on the axis, '|'-weight fill out wide, and
  // nothing but dark air just above it beyond the pole.
  expect(band(cx, baseTop)).toBeGreaterThanOrEqual(6);
  expect(band(cx + 10, floorRow - 1)).toBeGreaterThanOrEqual(4);
  expect(band(cx + 1 + baseHalf - 4, floorRow - 1)).toBeGreaterThanOrEqual(4);
  expect(band(cx + 15, baseTop - 2)).toBeLessThanOrEqual(1);

  // The floor line crosses every column at '|' weight or better.
  for (let x = 0; x < cols; x++) {
    expect(band(x, floorRow)).toBeGreaterThanOrEqual(4);
  }
});

test("kitchen-table air: voice arcs ring the head and fade before the canvas edges", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 2;
  scene.update(1 / 60, context);

  const { bandMid, cols, crownR, cx, rampLen } = landmarks();
  const data = context.buffer.data;

  // Arcs exist in the side field beyond the haze halo.
  let lit = 0;

  for (let y = bandMid - 8; y <= bandMid + 8; y++) {
    for (let x = cx + crownR + 12; x <= Math.min(cols - 2, cx + 92); x++) {
      if ((data[y * cols + x] ?? 0) > 0.07) {
        lit++;
      }
    }
  }

  expect(lit).toBeGreaterThan(20);

  // The air falls silent before the edges: outer margins above the floor
  // zone stay at '·' or black on both sides.
  const band = (x: number, y: number): number => quantizeIndex(data[y * cols + x] ?? 0, rampLen);

  for (let y = 0; y <= 70; y++) {
    for (let x = 0; x <= 7; x++) {
      expect(band(x, y)).toBeLessThanOrEqual(1);
      expect(band(cols - 1 - x, y)).toBeLessThanOrEqual(1);
    }
  }

  // The dark negative space holds the top corners.
  expect(band(2, 2)).toBeLessThanOrEqual(1);
  expect(band(cols - 3, 2)).toBeLessThanOrEqual(1);
});

test("kitchen-table waveform: a connected quiet trace crosses the full width", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 2;
  scene.update(1 / 60, context);

  const { cols, rampLen, waveRow } = landmarks();
  let prev: number[] = [];

  for (let x = 0; x < cols; x++) {
    const ys: number[] = [];

    for (let y = waveRow - 6; y <= waveRow + 6; y++) {
      if (quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen) >= 1) {
        ys.push(y);
      }
    }

    expect(ys.length).toBeGreaterThan(0); // a trace cell in every column

    if (prev.length > 0) {
      const connected = ys.some((y) => prev.some((p) => Math.abs(p - y) <= 1));
      expect(connected).toBe(true);
    }

    prev = ys;
  }
});
