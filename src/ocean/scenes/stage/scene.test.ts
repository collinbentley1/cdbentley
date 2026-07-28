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
    cols,
    cx: Math.round(cols * 0.5),
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
    expect(context.lights.length).toBe(0);
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

test("stage floor: the '='-weight floor line spans the opening", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);

  const { cols, floorRow, openL, openR, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (let x = openL; x <= openR; x++) {
    expect(band(x, floorRow)).toBeGreaterThanOrEqual(5); // '='
  }
});

test("stage is empty: no objects on the deck and no registered lights", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);
  applyLights(context.buffer, context.lights); // the runner's post-update pass

  expect(context.lights.length).toBe(0);

  // The stage interior between the legs stays bare: nothing but haze
  // between the hem zone and the floor line.
  const { cols, floorRow, openL, openR, openTop, rampLen } = landmarks();
  const legW = Math.max(3, Math.round(cols * 0.03));
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (let y = openTop + 18; y < floorRow - 1; y++) {
    for (let x = openL + legW + 1; x <= openR - legW - 1; x++) {
      expect(band(x, y)).toBeLessThanOrEqual(1); // ' ' or '·' haze only
    }
  }
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
