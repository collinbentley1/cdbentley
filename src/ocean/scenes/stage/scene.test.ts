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
import { stageScene } from "./scene.ts";

function makeContext(cols = stageScene.tuning.cols, rows = stageScene.tuning.rows): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(cols, rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

/** Landmarks mirrored from the scene's proportional geometry (full-bleed). */
function landmarks(cols = stageScene.tuning.cols, rows = stageScene.tuning.rows) {
  const jambW = Math.max(4, Math.round(cols * 0.065));
  const openTop = Math.round(rows * 0.135);
  const floorRow = Math.round(rows * 0.82);

  return {
    bulbRow: Math.max(openTop + 2, floorRow - Math.max(4, Math.round(rows * 0.145))),
    cols,
    cx: Math.round(cols * 0.5),
    figTop: Math.max(openTop + 1, floorRow - Math.max(8, Math.round(rows * 0.17))),
    floorRow,
    jambW,
    openL: 2 + jambW,
    openR: cols - 3 - jambW,
    openTop,
    rampLen: Array.from(stageScene.tuning.ramp).length,
    rows,
  };
}

/** Temporarily override motion tunables (restores in a finally). */
function withMotion<T>(overrides: Record<string, number>, run: () => T): T {
  const motion = stageScene.tuning.motion;
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

test("stage obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(stageScene);
  }).not.toThrow();
});

test("stage buffer stays finite in [0,1] across long runs and sleep gaps", () => {
  const context = makeContext();
  stageScene.init(context);

  for (let frame = 0; frame < 240; frame++) {
    context.time += 1 / 60;
    stageScene.update(1 / 60, context);
  }

  // Arbitrary sleep gap: the runner clamps dt to 0.1 but time may jump.
  context.time += 300;
  stageScene.update(0.1, context);

  // Deep-scroll depths never change what the sim writes (compaction is SDK-side).
  context.depth = 2.5;
  context.time += 1 / 60;
  stageScene.update(1 / 60, context);

  assertBufferShape(context.buffer, stageScene.tuning.cols, stageScene.tuning.rows);
  assertBufferInRange(context.buffer);
});

test("stage adapts to arbitrary small grids without wrapping or stray lights", () => {
  for (const [cols, rows] of [
    [20, 10],
    [64, 36],
  ] as const) {
    const context = makeContext(cols, rows);
    stageScene.init(context);
    context.time = 1;
    stageScene.update(1 / 60, context);

    assertBufferShape(context.buffer, cols, rows);
    assertBufferInRange(context.buffer);

    const light = context.lights[0]!;
    expect(light.y).toBeGreaterThanOrEqual(0);
    expect(light.y).toBeLessThan(rows);
    expect(light.x).toBeGreaterThanOrEqual(0);
    expect(light.x).toBeLessThan(cols);
  }

  // Restore the module-level base cache for the tuned grid.
  const context = makeContext();
  stageScene.init(context);
});

test("stage compaction is monotone and pure (scene uses SDK defaults)", () => {
  expect(() => {
    assertResolutionMonotone(stageScene.tuning.resolution ?? {});
  }).not.toThrow();
});

test("stage compaction round-trips: descending then ascending depths agree", () => {
  const config = stageScene.tuning.resolution ?? {};
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

test("stage is steady: identical time yields byte-identical buffers (no flicker)", () => {
  const a = makeContext();
  stageScene.init(a);
  a.time = 2.5;
  stageScene.update(1 / 60, a);
  const first = Float32Array.from(a.buffer.data);

  stageScene.update(1 / 60, a);

  expect(Array.from(a.buffer.data)).toEqual(Array.from(first));
});

test("stage breathes: the teaser hem moves even with the haze stilled", () => {
  withMotion({ hazeAmount: 0, hazeFloor: 0 }, () => {
    const context = makeContext();
    stageScene.init(context);

    context.time = 1;
    stageScene.update(1 / 60, context);
    const before = Float32Array.from(context.buffer.data);

    context.time = 6.5;
    stageScene.update(1 / 60, context);

    const { cols, openL, openR, openTop } = landmarks();
    let hemChanged = 0;

    for (let y = openTop; y < openTop + 16; y++) {
      for (let x = openL; x <= openR; x++) {
        if (Math.abs((before[y * cols + x] ?? 0) - (context.buffer.data[y * cols + x] ?? 0)) > 1e-6) {
          hemChanged++;
        }
      }
    }

    expect(hemChanged).toBeGreaterThan(0);
  });
});

test("stage proscenium: solid jambs frame the opening down to the floor", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);

  const { cols, floorRow, jambW, openL, openR, openTop, rampLen, rows } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const fluteDx = jambW >= 12 ? [5, 9] : [];

  // Jamb fill fades upward but never below the '|' band (panel grooves
  // excepted): lit from below.
  for (let y = openTop; y <= floorRow; y++) {
    for (let dx = 2; dx <= jambW; dx++) {
      if (fluteDx.includes(dx)) {
        continue;
      }

      expect(band(openL - dx, y)).toBeGreaterThanOrEqual(4); // '|' or brighter
      expect(band(openR + dx, y)).toBeGreaterThanOrEqual(4);
    }
  }

  // The jamb base outshines the jamb top (one low light source).
  expect(band(openL - 3, floorRow - 2)).toBeGreaterThan(band(openL - 3, openTop + 2));

  // Entablature: the cornice band spans the full canvas width.
  const entabTop = Math.max(1, Math.round(rows * 0.05));

  for (let x = 0; x < cols; x++) {
    expect(band(x, entabTop)).toBeGreaterThanOrEqual(5); // '=' cornice
  }

  // Above the cornice and outside the jambs stays dark (full-bleed frame).
  expect(band(2, Math.max(0, entabTop - 1))).toBeLessThanOrEqual(1);
  expect(band(0, Math.round(rows * 0.55))).toBeLessThanOrEqual(1);
  expect(band(1, Math.round(rows * 0.55))).toBeLessThanOrEqual(1);
});

test("stage ghost light: the bulb is the brightest cell and pools on the deck", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);

  const { bulbRow, cols, floorRow, openL, rampLen } = landmarks();
  const standX = Math.round((stageScene.tuning.motion.lightX ?? 0.46) * (cols - 1));
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Pre-light, the bulb is already the scene maximum.
  let max = 0;

  for (const v of context.buffer.data) {
    max = Math.max(max, v);
  }

  expect(context.buffer.data[bulbRow * cols + standX]).toBe(max);
  expect(band(standX, bulbRow)).toBe(rampLen - 1); // '@'

  // The floor line glows around the stand: at least one band brighter at
  // the stand than at the opening's edge.
  expect(band(standX, floorRow)).toBeGreaterThanOrEqual(band(openL + 2, floorRow) + 1);

  // The deck pool exists above the floor line near the base.
  expect(band(standX - 3, floorRow - 2)).toBeGreaterThanOrEqual(2);
});

test("stage figure: 2-cell head, sloped shoulders, one mass, dimmer than the bulb", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);
  applyLights(context.buffer, context.lights); // the runner's post-update pass

  const { bulbRow, cols, figTop, floorRow, rampLen } = landmarks();
  const figX = Math.round((stageScene.tuning.motion.figureX ?? 0.55) * (cols - 1));
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Head: exactly 2 cells wide, flanked by darker air, connected below.
  const headBand = Math.min(band(figX, figTop), band(figX + 1, figTop));
  expect(headBand).toBeGreaterThanOrEqual(band(figX - 1, figTop) + 2);
  expect(headBand).toBeGreaterThanOrEqual(band(figX + 2, figTop) + 2);
  expect(headBand).toBeGreaterThanOrEqual(band(figX, figTop - 1) + 2);
  expect(band(figX, figTop + 3)).toBeGreaterThanOrEqual(headBand); // one contiguous mass

  // Shoulder slope: 6 cells wide at its widest, flanked by darker air.
  const shoulderY = figTop + 4;
  let shoulderBand = rampLen;

  for (let dx = -2; dx <= 3; dx++) {
    shoulderBand = Math.min(shoulderBand, band(figX + dx, shoulderY));
  }

  expect(shoulderBand).toBeGreaterThanOrEqual(band(figX - 3, shoulderY) + 2);
  expect(shoulderBand).toBeGreaterThanOrEqual(band(figX + 4, shoulderY) + 2);

  // The figure stays dimmer than the bulb: the light source wins.
  const standX = Math.round((stageScene.tuning.motion.lightX ?? 0.46) * (cols - 1));

  for (let y = figTop; y < floorRow; y++) {
    for (let dx = -2; dx <= 3; dx++) {
      expect(band(figX + dx, y)).toBeLessThan(band(standX, bulbRow));
    }
  }
});

test("stage registers exactly one light that tracks its motion tunables", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);

  expect(context.lights.length).toBe(1);
  const light = context.lights[0]!;
  expect(light.intensity).toBeGreaterThan(0);
  expect(light.intensity).toBeLessThanOrEqual(1);
  expect(light.radius).toBeGreaterThan(0);

  withMotion({ lightIntensity: 0.4, lightRadius: 7, lightX: 0.3 }, () => {
    context.time += 1 / 60;
    stageScene.update(1 / 60, context);

    expect(light.x).toBe(Math.round(0.3 * (stageScene.tuning.cols - 1)));
    expect(light.radius).toBe(7);
    expect(light.intensity).toBeCloseTo(0.4, 5);
  });
});

test("stage house: seat rows exist and the widening center aisle stays clear", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);

  const { cols, cx, floorRow, rampLen, rows } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // The aisle column stays dark all the way down.
  for (let y = floorRow + 3; y < rows; y++) {
    expect(band(cx, y)).toBeLessThanOrEqual(1); // ' ' or '·'
  }

  // Seat backs actually exist off-aisle at each seat arc (the arcs bend, so
  // scan a small window around the nominal row).
  for (const offset of [0.048, 0.086, 0.125, 0.163]) {
    const row = floorRow + Math.round(rows * offset);
    let found = 0;

    for (let y = row - 4; y <= Math.min(rows - 1, row + 1); y++) {
      for (let x = Math.round(cols * 0.2); x < Math.round(cols * 0.8); x++) {
        if (band(x, y) >= 2) {
          found++;
        }
      }
    }

    expect(found).toBeGreaterThan(8);
  }
});

test("stage teaser hem: every opening column carries a connected hem", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 2;
  stageScene.update(1 / 60, context);

  const { cols, openL, openR, openTop, rampLen } = landmarks();
  const hemBand = quantizeIndex(0.38, rampLen);
  let prev: number[] = [];

  for (let x = openL + 1; x <= openR - 1; x++) {
    const ys: number[] = [];

    for (let y = openTop; y < openTop + 16; y++) {
      if (quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen) === hemBand) {
        ys.push(y);
      }
    }

    expect(ys.length).toBeGreaterThan(0); // a hem cell in every column

    if (prev.length > 0) {
      // Adjacent columns' hem cells touch (share a row or neighbor one).
      const connected = ys.some((y) => prev.some((p) => Math.abs(p - y) <= 1));
      expect(connected).toBe(true);
    }

    prev = ys;
  }
});
