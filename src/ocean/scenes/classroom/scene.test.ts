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

/** Landmarks mirrored from the scene's proportional geometry (full-bleed). */
function landmarks(cols = scene.tuning.cols, rows = scene.tuning.rows) {
  const jambW = Math.max(4, Math.round(cols * 0.08));
  const cornTop = Math.max(1, Math.round(rows * 0.04));
  const cornBot = cornTop + 3;
  const shelfTop = cornBot + 1;
  const floorRow = Math.round(rows * 0.66);
  const shelfPitch = Math.max(4, Math.round(rows * 0.058));
  const bayW = Math.max(7, Math.round(cols * 0.088));
  const uprightW = Math.max(2, Math.round(cols * 0.022));
  const innerL = jambW;
  const innerR = cols - 1 - jambW;
  const wallSpan = Math.max(1, floorRow - shelfTop);
  const shelfRows: number[] = [];
  let galleryY = -1;
  let galleryDist = Infinity;

  for (let y = floorRow - shelfPitch; y >= cornBot + 5; y -= shelfPitch) {
    shelfRows.push(y);

    const d = Math.abs((y - shelfTop) / wallSpan - 0.5);

    if (d < galleryDist) {
      galleryDist = d;
      galleryY = y;
    }
  }

  const uprightXs: number[] = [];

  for (let x = innerL + bayW; x <= innerR - uprightW - 1; x += bayW) {
    uprightXs.push(x);
  }

  return {
    bayW,
    cols,
    cornBot,
    cornTop,
    cx: Math.round(cols * 0.5),
    floorRow,
    galleryY,
    innerL,
    innerR,
    jambW,
    rampLen: Array.from(scene.tuning.ramp).length,
    rows,
    shelfPitch,
    shelfRows,
    shelfTop,
    uprightW,
    uprightXs,
    wallSpan,
  };
}

/** The orb's parametric path at default tuning, mirrored from update(). */
function orbAt(time: number, cols = scene.tuning.cols, rows = scene.tuning.rows) {
  const { cx, floorRow, innerL, innerR } = landmarks(cols, rows);
  const floorTop = floorRow + 2;
  const floorBot = rows - 2;
  const cy = (floorTop + floorBot) / 2;
  const ax = Math.max(0, (innerR - innerL) / 2 - 2) * 0.8;
  const ay = Math.max(0, (floorBot - floorTop) / 2 - 3) * 0.8;
  const omega = (Math.PI * 2) / 21;

  return {
    x: cx + ax * Math.sin(omega * time),
    y: cy + ay * Math.sin(2 * omega * time + 0.9),
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

test("classroom obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});

test("classroom buffer stays finite in [0,1] across long runs and sleep gaps", () => {
  const context = makeContext();
  scene.init(context);

  for (let frame = 0; frame < 400; frame++) {
    context.time += 1 / 60;
    context.depth = Math.sin(frame / 90) + 0.6; // wander across the memory line
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

test("classroom adapts to arbitrary small grids without wrapping or stray lights", () => {
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

test("classroom survives extreme live-tuned motion values", () => {
  withMotion(
    {
      coreLum: 40,
      orbCore: 12,
      orbPeriod: 0,
      orbSigma: 0,
      sheenAmount: 9,
      trailAge: 0,
      trailPeak: 40,
      trailPow: 0,
      trailSteps: 5000,
    },
    () => {
      const context = makeContext();
      scene.init(context);

      for (let frame = 0; frame < 30; frame++) {
        context.time += 1 / 60;
        scene.update(1 / 60, context);
      }

      assertBufferInRange(context.buffer);
    },
  );
});

test("classroom compaction is monotone and pure (scene uses SDK defaults)", () => {
  expect(() => {
    assertResolutionMonotone(scene.tuning.resolution ?? {});
  }).not.toThrow();
});

test("classroom compaction round-trips: descending then ascending depths agree", () => {
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

test("classroom is steady: identical time yields byte-identical buffers (no flicker)", () => {
  const a = makeContext();
  scene.init(a);
  a.time = 2.5;
  scene.update(1 / 60, a);
  const first = Float32Array.from(a.buffer.data);

  scene.update(1 / 60, a);

  expect(Array.from(a.buffer.data)).toEqual(Array.from(first));
});

test("classroom glides: the orb and trail move even with the haze stilled", () => {
  withMotion({ hazeAmount: 0, hazeFloor: 0 }, () => {
    const context = makeContext();
    scene.init(context);

    context.time = 1;
    scene.update(1 / 60, context);
    const before = Float32Array.from(context.buffer.data);

    context.time = 6.5;
    scene.update(1 / 60, context);

    const { cols, floorRow, rows } = landmarks();
    let floorChanged = 0;

    for (let y = floorRow + 2; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (Math.abs((before[y * cols + x] ?? 0) - (context.buffer.data[y * cols + x] ?? 0)) > 1e-6) {
          floorChanged++;
        }
      }
    }

    expect(floorChanged).toBeGreaterThan(0);
  });
});

test("classroom frame: heavy cornice spans every column and massive jambs hold the edges", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, cornBot, cornTop, floorRow, jambW, rampLen, shelfTop } = landmarks();
  const data = context.buffer.data;
  const band = (x: number, y: number): number => quantizeIndex(data[y * cols + x] ?? 0, rampLen);

  // The cornice crown and base courses cross the full canvas width at '+'.
  for (let x = 0; x < cols; x++) {
    expect(band(x, cornTop)).toBeGreaterThanOrEqual(6);
    expect(band(x, cornBot)).toBeGreaterThanOrEqual(6);
  }

  // Above the cornice stays dark (full-bleed frame, nothing floats).
  expect(band(5, Math.max(0, cornTop - 1))).toBeLessThanOrEqual(1);
  expect(band(cols - 6, Math.max(0, cornTop - 1))).toBeLessThanOrEqual(1);

  // Proscenium jambs: solid '+' masonry down to the floor, the two carved
  // grooves excepted.
  for (let y = shelfTop; y <= floorRow; y++) {
    for (let dx = 0; dx < jambW; dx++) {
      if ((jambW >= 12 && dx === 5) || (jambW >= 16 && dx === 11)) {
        continue;
      }

      expect(band(dx, y)).toBeGreaterThanOrEqual(6);
      expect(band(cols - 1 - dx, y)).toBeGreaterThanOrEqual(6);
    }
  }

  // The jamb base outshines the jamb top (lit from the floor).
  expect(data[(floorRow - 1) * cols + 2] ?? 0).toBeGreaterThan(data[(shelfTop + 1) * cols + 2] ?? 0);
});

test("classroom skeleton: the colonnade, gallery band, rules, and baseline all hold", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, floorRow, galleryY, innerL, innerR, rampLen, shelfPitch, shelfRows, shelfTop, uprightW, uprightXs, wallSpan } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Thick bay uprights run '+' from under the cornice to the floor.
  expect(uprightXs.length).toBeGreaterThanOrEqual(6);

  for (const ux of uprightXs) {
    for (let y = shelfTop; y < floorRow; y++) {
      for (let dx = 0; dx < uprightW; dx++) {
        expect(band(ux + dx, y)).toBeGreaterThanOrEqual(6);
      }
    }
  }

  // The solid gallery band crosses the whole wall at mid-height.
  expect(galleryY).toBeGreaterThan(0);

  for (let y = galleryY - 2; y <= galleryY; y++) {
    for (let x = innerL; x <= innerR; x++) {
      expect(band(x, y)).toBeGreaterThanOrEqual(6);
    }
  }

  // Every course rule crosses the wall; the four eye-level courses sit on
  // continuous '+' rules so books visibly stand on shelves.
  expect(shelfRows.length).toBeGreaterThanOrEqual(6);

  for (const shelfY of shelfRows) {
    const eye = (shelfY - shelfTop) / wallSpan >= 0.55;

    for (let x = innerL; x <= innerR; x++) {
      expect(band(x, shelfY)).toBeGreaterThanOrEqual(eye ? 6 : 4);
    }
  }

  expect(shelfRows.filter((y) => (y - shelfTop) / wallSpan >= 0.55).length).toBeGreaterThanOrEqual(4);

  // The baseline shadow row crosses the full canvas width at '+'.
  for (let x = 0; x < cols; x++) {
    expect(band(x, floorRow)).toBeGreaterThanOrEqual(6);
  }

  // The plinth cabinet course under the lowest shelf is near-solid: only
  // its door seams dip below the '|' band.
  let solid = 0;
  let total = 0;

  for (let y = floorRow - shelfPitch + 1; y < floorRow; y++) {
    for (let x = innerL; x <= innerR; x++) {
      total++;

      if (band(x, y) >= 4) {
        solid++;
      }
    }
  }

  expect(solid / Math.max(1, total)).toBeGreaterThan(0.9);
});

test("classroom hierarchy: eye-level courses outshine the attic under dark air", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, galleryY, innerL, innerR, rampLen, shelfRows, shelfTop, uprightW, uprightXs, wallSpan } = landmarks();
  const data = context.buffer.data;
  const band = (x: number, y: number): number => quantizeIndex(data[y * cols + x] ?? 0, rampLen);
  const onUpright = (x: number): boolean => uprightXs.some((ux) => x >= ux && x < ux + uprightW);

  // Mean brightness of the book zones (the rows spines stand in) per tier.
  const zoneMean = (courses: number[]): number => {
    let sum = 0;
    let count = 0;

    for (const shelfY of courses) {
      for (let dy = 1; dy <= 3; dy++) {
        for (let x = innerL + 1; x < innerR; x++) {
          if (onUpright(x)) {
            continue;
          }

          sum += data[(shelfY - dy) * cols + x] ?? 0;
          count++;
        }
      }
    }

    return sum / Math.max(1, count);
  };

  const eyeCourses = shelfRows.filter((y) => y !== galleryY && (y - shelfTop) / wallSpan >= 0.55);
  const atticCourses = shelfRows.filter((y) => y !== galleryY && (y - shelfTop) / wallSpan < 0.38);

  expect(eyeCourses.length).toBeGreaterThanOrEqual(3);
  expect(atticCourses.length).toBeGreaterThanOrEqual(2);
  expect(zoneMean(eyeCourses)).toBeGreaterThan(zoneMean(atticCourses) * 1.5);

  // Hundreds of spines, in several distinct luminance bands (the glitter).
  const bands = new Set<number>();
  let bookCells = 0;

  for (const shelfY of shelfRows) {
    if (shelfY === galleryY) {
      continue;
    }

    for (let dy = 1; dy <= 4; dy++) {
      for (let x = innerL + 1; x < innerR; x++) {
        if (onUpright(x)) {
          continue;
        }

        const b = band(x, shelfY - dy);

        if (b >= 2) {
          bookCells++;
          bands.add(b);
        }
      }
    }
  }

  expect(bookCells).toBeGreaterThan(1500);
  expect(bands.size).toBeGreaterThanOrEqual(3);

  // The air just under the cornice stays dark — the wall fades up.
  for (let y = shelfTop; y <= shelfTop + 2; y++) {
    for (let x = innerL + 1; x < innerR; x++) {
      if (onUpright(x)) {
        continue;
      }

      expect(band(x, y)).toBeLessThanOrEqual(1); // ' ' or '·'
    }
  }
});

test("classroom floor: the lower third recedes instead of sitting empty", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 2;
  scene.update(1 / 60, context);

  const { cols, floorRow, rows } = landmarks();
  const data = context.buffer.data;

  // Visible texture — floorboard joints, seams, grain, trail — fills the
  // floor zone with hundreds of low-band cells.
  let lit = 0;

  for (let y = floorRow + 2; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((data[y * cols + x] ?? 0) >= 1 / 9) {
        lit++;
      }
    }
  }

  expect(lit).toBeGreaterThan(500);

  // The texture falls off with distance from the wall's baseline: the
  // first floorboard joint outshines a deep one (sampled off the path).
  const near = data[(floorRow + 2) * cols + 5] ?? 0;
  const far = data[(floorRow + 14) * cols + 5] ?? 0;

  expect(near).toBeGreaterThan(far);
  expect(near).toBeGreaterThan(0.15);
});

test("classroom orb: a compact max-density core towing a comet trail, no lights", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 2;
  scene.update(1 / 60, context);
  applyLights(context.buffer, context.lights); // the runner's post-update pass

  expect(context.lights.length).toBe(0);

  const { cols, floorRow, rampLen, rows } = landmarks();
  const data = context.buffer.data;

  // The core is a compact 3-6 cell '@'-hot block, all on the open floor —
  // the scene's only max-density light.
  let hotCells = 0;
  let hotOnFloor = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if ((data[y * cols + x] ?? 0) >= 8 / 9) {
        hotCells++;

        if (y > floorRow + 1) {
          hotOnFloor++;
        }
      }
    }
  }

  expect(hotCells).toBeGreaterThanOrEqual(3);
  expect(hotCells).toBeLessThanOrEqual(6);
  expect(hotOnFloor).toBe(hotCells);

  // The luminous trail: lit floor cells well away from the orb itself.
  const orb = orbAt(2);
  let trailCells = 0;

  for (let y = floorRow + 2; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (Math.hypot(x - orb.x, y - orb.y) <= 12) {
        continue;
      }

      if (quantizeIndex(data[y * cols + x] ?? 0, rampLen) >= 2) {
        trailCells++;
      }
    }
  }

  expect(trailCells).toBeGreaterThan(30);

  // Comet ramp: the trail brightens toward the robot — a fresh sample of
  // the path far outshines an old one.
  const fresh = orbAt(1);
  const stale = orbAt(-3);
  const freshLum = data[Math.round(fresh.y) * cols + Math.round(fresh.x)] ?? 0;
  const staleLum = data[Math.round(stale.y) * cols + Math.round(stale.x)] ?? 0;

  expect(freshLum).toBeGreaterThan(staleLum + 0.15);
});
