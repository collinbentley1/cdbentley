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
import { tradingFloorScene } from "./scene.ts";

function makeContext(cols = tradingFloorScene.tuning.cols, rows = tradingFloorScene.tuning.rows): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(cols, rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

/** Landmarks mirrored from the scene's proportional geometry (full-bleed). */
function landmarks(cols = tradingFloorScene.tuning.cols, rows = tradingFloorScene.tuning.rows) {
  const corniceTop = Math.max(1, Math.round(rows * 0.175));
  const corniceBot = corniceTop + Math.max(0, Math.round(rows * 0.012));
  const dentilRow = corniceBot + 1;
  const friezeTop = dentilRow + 1;
  const friezeBot = friezeTop + Math.max(0, Math.round(rows * 0.02));
  const archTop = friezeBot + 1;
  const archBot = archTop + Math.max(2, Math.round(rows * 0.04));
  const tickerRow = archTop + Math.floor((archBot - archTop) / 2);
  const capTop = archBot + 1;
  const capBot = capTop + 1;
  const shaftTop = capBot + 1;
  const stylTop = Math.max(shaftTop + 2, Math.round(rows * 0.76));
  const colW = Math.max(4, Math.round(cols * 0.07));
  const edge = Math.round(cols * 0.075);
  const centers: number[] = [];

  for (let i = 0; i < 6; i++) {
    centers.push(Math.round(edge + (i * (cols - 1 - 2 * edge)) / 5));
  }

  return {
    apexRow: Math.max(0, Math.round(rows * 0.03)),
    archBot,
    archTop,
    baseTop: stylTop - 3,
    capBot,
    capTop,
    centers,
    colW,
    cols,
    corniceBot,
    corniceTop,
    cx: Math.round((cols - 1) / 2),
    dentilRow,
    friezeBot,
    friezeTop,
    rampLen: Array.from(tradingFloorScene.tuning.ramp).length,
    rows,
    shaftTop,
    stepH: Math.max(2, Math.round(rows * 0.038)),
    stepTop: stylTop + 2,
    stylBot: stylTop + 1,
    stylTop,
    tickerRow,
  };
}

/** Temporarily override motion tunables (restores in a finally). */
function withMotion<T>(overrides: Record<string, number>, run: () => T): T {
  const motion = tradingFloorScene.tuning.motion;
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

test("trading-floor obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(tradingFloorScene);
  }).not.toThrow();
});

test("trading-floor buffer stays finite in [0,1] across long runs and sleep gaps", () => {
  const context = makeContext();
  tradingFloorScene.init(context);

  for (let frame = 0; frame < 240; frame++) {
    context.time += 1 / 60;
    tradingFloorScene.update(1 / 60, context);
  }

  // Arbitrary sleep gap: the runner clamps dt to 0.1 but time may jump.
  context.time += 300;
  tradingFloorScene.update(0.1, context);

  // Deep-scroll depths never change what the sim writes (compaction is SDK-side).
  context.depth = 2.5;
  context.time += 1 / 60;
  tradingFloorScene.update(1 / 60, context);

  assertBufferShape(context.buffer, tradingFloorScene.tuning.cols, tradingFloorScene.tuning.rows);
  assertBufferInRange(context.buffer);
});

test("trading-floor adapts to arbitrary small grids without wrapping or stray lights", () => {
  for (const [cols, rows] of [
    [20, 10],
    [64, 36],
  ] as const) {
    const context = makeContext(cols, rows);
    tradingFloorScene.init(context);
    context.time = 1;
    tradingFloorScene.update(1 / 60, context);

    assertBufferShape(context.buffer, cols, rows);
    assertBufferInRange(context.buffer);
    expect(context.lights.length).toBe(0);
  }

  // Restore the module-level base cache for the tuned grid.
  const context = makeContext();
  tradingFloorScene.init(context);
});

test("trading-floor compaction is monotone and pure (scene uses SDK defaults)", () => {
  expect(() => {
    assertResolutionMonotone(tradingFloorScene.tuning.resolution ?? {});
  }).not.toThrow();
});

test("trading-floor compaction round-trips: descending then ascending depths agree", () => {
  const config = tradingFloorScene.tuning.resolution ?? {};
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

test("trading-floor is steady: identical time yields byte-identical buffers (no flicker)", () => {
  const a = makeContext();
  tradingFloorScene.init(a);
  a.time = 2.5;
  tradingFloorScene.update(1 / 60, a);
  const first = Float32Array.from(a.buffer.data);

  tradingFloorScene.update(1 / 60, a);

  expect(Array.from(a.buffer.data)).toEqual(Array.from(first));
});

test("trading-floor ticker drifts: the band moves even with the haze stilled", () => {
  withMotion({ hazeAmount: 0, hazeFloor: 0 }, () => {
    const context = makeContext();
    tradingFloorScene.init(context);

    context.time = 1;
    tradingFloorScene.update(1 / 60, context);
    const before = Float32Array.from(context.buffer.data);

    context.time = 1.5;
    tradingFloorScene.update(1 / 60, context);

    const { cols, tickerRow } = landmarks();
    let moved = 0;

    for (let x = 0; x < cols; x++) {
      if (Math.abs((before[tickerRow * cols + x] ?? 0) - (context.buffer.data[tickerRow * cols + x] ?? 0)) > 1e-6) {
        moved++;
      }
    }

    expect(moved).toBeGreaterThan(0);
  });
});

test("trading-floor colonnade: six columns stand between dark bays", () => {
  const context = makeContext();
  tradingFloorScene.init(context);

  context.time = 1 / 60;
  tradingFloorScene.update(1 / 60, context);

  const { centers, cols, rampLen, shaftTop, stylTop } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const midShaft = Math.round((shaftTop + stylTop) / 2);

  expect(centers).toHaveLength(6);

  for (const cx of centers) {
    // Shaft fill holds the '|' band or brighter at mid-height.
    expect(band(cx, midShaft)).toBeGreaterThanOrEqual(4);
    // The base course under each column is hotter than its mid shaft.
    expect(band(cx, stylTop - 1)).toBeGreaterThan(band(cx, shaftTop + 1));
  }

  // Bays between neighboring columns stay deep shadow (haze at most '·').
  for (let i = 0; i < centers.length - 1; i++) {
    const mid = Math.round(((centers[i] ?? 0) + (centers[i + 1] ?? 0)) / 2);
    expect(band(mid, midShaft)).toBeLessThanOrEqual(1);
  }
});

test("trading-floor entablature and pediment: bands span full width, tympanum stays dark", () => {
  const context = makeContext();
  tradingFloorScene.init(context);

  context.time = 1 / 60;
  tradingFloorScene.update(1 / 60, context);

  const { apexRow, cols, corniceTop, cx, friezeTop, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (let x = 0; x < cols; x++) {
    expect(band(x, corniceTop)).toBeGreaterThanOrEqual(5); // '=' cornice
    expect(band(x, friezeTop)).toBeGreaterThanOrEqual(4); // '|' frieze
  }

  // Raking cornice peaks bright at the apex; the sky corners above it and
  // the tympanum field below it stay dark.
  expect(band(cx, apexRow)).toBeGreaterThanOrEqual(5);
  expect(band(2, Math.max(0, apexRow - 1))).toBeLessThanOrEqual(1);
  expect(band(cols - 3, Math.max(0, apexRow - 1))).toBeLessThanOrEqual(1);
  expect(band(cx, apexRow + 3)).toBeLessThanOrEqual(1);
});

test("trading-floor steps: full-width courses brighten toward the viewer", () => {
  const context = makeContext();
  tradingFloorScene.init(context);

  context.time = 1 / 60;
  tradingFloorScene.update(1 / 60, context);

  const { cols, rampLen, rows, stepH, stepTop } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const treads: number[] = [];

  for (let y = stepTop; y < rows; y += stepH) {
    treads.push(y);
  }

  expect(treads.length).toBeGreaterThanOrEqual(3);

  // Every tread is a continuous course across the full canvas width.
  const lastTread = treads[treads.length - 1] ?? stepTop;

  for (let x = 0; x < cols; x++) {
    expect(band(x, lastTread)).toBeGreaterThanOrEqual(5);
  }

  // The flight brightens toward the viewer (bottom outshines top).
  const firstTread = treads[0] ?? stepTop;
  expect(band(Math.round(cols / 2), lastTread)).toBeGreaterThan(band(Math.round(cols / 2), firstTread));
});

test("trading-floor ticker: lit marks live on the ticker row, its channel stays quiet", () => {
  const context = makeContext();
  tradingFloorScene.init(context);

  context.time = 2;
  tradingFloorScene.update(1 / 60, context);
  applyLights(context.buffer, context.lights); // the runner's post-update pass

  expect(context.lights.length).toBe(0);

  const { archBot, archTop, cols, rampLen, tickerRow } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  let lit = 0;
  let hot = 0;

  for (let x = 0; x < cols; x++) {
    const b = band(x, tickerRow);

    if (b >= 5) {
      lit++; // '=' or brighter tick marks
    }

    if (b === 7) {
      hot++; // occasional '#' dashes
    }

    // The channel rows above and below carry at most the dim '·' echo.
    for (let y = archTop; y <= archBot; y++) {
      if (y !== tickerRow) {
        expect(band(x, y)).toBeLessThanOrEqual(1);
      }
    }
  }

  expect(lit).toBeGreaterThan(cols * 0.2);
  expect(lit).toBeLessThan(cols * 0.8);
  expect(hot).toBeGreaterThan(0);

  // '@' stays reserved: this scene never reaches the ramp's hottest glyph.
  for (let i = 0; i < context.buffer.data.length; i++) {
    expect(quantizeIndex(context.buffer.data[i] ?? 0, rampLen)).toBeLessThanOrEqual(7);
  }
});

test("trading-floor dock glyph uses only glyphs from the scene ramp", () => {
  const allowed = new Set(Array.from(tradingFloorScene.tuning.ramp + (tradingFloorScene.tuning.minimalGlyph ?? "·")));

  for (const row of tradingFloorScene.dockGlyph) {
    for (const glyph of row) {
      expect(allowed.has(glyph)).toBe(true);
    }
  }
});

test("trading-floor motion tunables are finite numbers (harness live-edit contract)", () => {
  const entries = Object.values(tradingFloorScene.tuning.motion);
  expect(entries.length).toBeGreaterThan(0);

  for (const value of entries) {
    expect(Number.isFinite(value)).toBe(true);
  }
});
