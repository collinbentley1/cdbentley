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
  const glassTop = Math.round(rows * 0.135);
  const floorRow = Math.round(rows * 0.8);
  const glassSpan = Math.max(1, floorRow - glassTop);
  const centerY = Math.round(rows * 0.6);
  const halfH = Math.max(1, Math.round(rows * 0.055));
  const belly = centerY + halfH;

  return {
    beaconX: Math.round(cols * 0.858),
    belly,
    centerY,
    cols,
    crownY: centerY - halfH,
    cx: Math.round(cols * 0.5),
    fasciaTop: Math.max(1, Math.round(rows * 0.045)),
    finTop: Math.round(rows * 0.31),
    floorRow,
    glassTop,
    leadRoot: Math.round(cols * 0.79),
    leadTip: Math.round(cols * 0.842),
    mullionStep: Math.max(8, Math.round(cols * 0.095)),
    nacAx0: Math.round(cols * 0.305),
    nacAx1: Math.round(cols * 0.305) + Math.max(7, Math.round(cols * 0.085)),
    nacBx0: Math.round(cols * 0.46),
    nacBx1: Math.round(cols * 0.46) + Math.max(5, Math.round(cols * 0.058)),
    noseX: Math.round(cols * 0.055),
    rampLen: Array.from(scene.tuning.ramp).length,
    rows,
    seatRowA: Math.round(rows * 0.875),
    seatRowB: Math.round(rows * 0.945),
    sillDepth: Math.max(2, Math.round(rows * 0.04)),
    trailRoot: Math.round(cols * 0.885),
    trailTip: Math.round(cols * 0.872),
    transomA: glassTop + Math.round(glassSpan * 0.32),
    transomB: glassTop + Math.round(glassSpan * 0.55),
    wingRootX: Math.round(cols * 0.56),
    wingTipX: Math.round(cols * 0.27),
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

test("airport-gate obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(scene);
  }).not.toThrow();
});

test("airport-gate buffer stays finite in [0,1] across long runs and sleep gaps", () => {
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

test("airport-gate adapts to arbitrary small grids without wrapping or stray lights", () => {
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

test("airport-gate compaction is monotone and pure (scene uses SDK defaults)", () => {
  expect(() => {
    assertResolutionMonotone(scene.tuning.resolution ?? {});
  }).not.toThrow();
});

test("airport-gate compaction round-trips: descending then ascending depths agree", () => {
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

test("airport-gate is steady: identical time yields byte-identical buffers (no flicker)", () => {
  const a = makeContext();
  scene.init(a);
  a.time = 2.5;
  scene.update(1 / 60, a);
  const first = Float32Array.from(a.buffer.data);

  scene.update(1 / 60, a);

  expect(Array.from(a.buffer.data)).toEqual(Array.from(first));
});

test("airport-gate beacon pulses: fin-tip cells move even with the haze stilled", () => {
  withMotion({ hazeAmount: 0, hazeFloor: 0 }, () => {
    const context = makeContext();
    scene.init(context);

    const period = scene.tuning.motion.beaconPeriod ?? 6;
    context.time = period * 0.25; // sine peak
    scene.update(1 / 60, context);
    const before = Float32Array.from(context.buffer.data);

    context.time = period * 0.75; // sine trough
    scene.update(1 / 60, context);

    const { beaconX, cols, finTop, rampLen } = landmarks();
    let changed = 0;

    for (let y = Math.max(0, finTop - 8); y <= finTop + 6; y++) {
      for (let x = beaconX - 8; x <= beaconX + 8; x++) {
        if (Math.abs((before[y * cols + x] ?? 0) - (context.buffer.data[y * cols + x] ?? 0)) > 1e-6) {
          changed++;
        }
      }
    }

    expect(changed).toBeGreaterThan(0);

    // At peak the beacon core reaches '@'; at trough it rests at '#' or below.
    const troughBand = quantizeIndex(context.buffer.data[(finTop - 1) * cols + beaconX] ?? 0, rampLen);
    expect(troughBand).toBeLessThanOrEqual(7);

    context.time = period * 0.25;
    scene.update(1 / 60, context);
    const peakBand = quantizeIndex(context.buffer.data[(finTop - 1) * cols + beaconX] ?? 0, rampLen);
    expect(peakBand).toBe(8);
  });
});

test("airport-gate fascia: the band crosses every column and the void above stays dark", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, fasciaTop, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (let x = 0; x < cols; x++) {
    expect(band(x, fasciaTop)).toBeGreaterThanOrEqual(5); // '=' fascia edge
  }

  for (let x = 0; x < cols; x++) {
    expect(band(x, Math.max(0, fasciaTop - 2))).toBeLessThanOrEqual(1); // void above
  }
});

test("airport-gate tail fin: one compact solid silhouette, and no second fin in the left glass", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, crownY, finTop, leadRoot, leadTip, rampLen, trailRoot, trailTip, transomA, transomB } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const finSpan = Math.max(1, crownY - finTop);

  // The fin interior holds '='-grade fill from tip to root.
  for (let y = finTop + 2; y <= crownY - 2; y++) {
    const u = (y - finTop) / finSpan;
    const le = Math.round(leadTip + (leadRoot - leadTip) * u);
    const te = Math.round(trailTip + (trailRoot - trailTip) * u);

    for (let x = le + 1; x <= te - 1; x++) {
      // The rudder hinge seam (te - 3) sits one band darker, by design.
      expect(band(x, y)).toBeGreaterThanOrEqual(x === te - 3 ? 4 : 5);
    }
  }

  // The fin stays compact: it never rises above its tip row (the mullion
  // shafts crossing the bay are the wall, not the fin).
  const { mullionStep } = landmarks();

  for (let x = leadRoot - 4; x <= Math.min(cols - 3, trailRoot + 4); x++) {
    if (x % mullionStep <= 1) {
      continue;
    }

    expect(band(x, finTop - 6)).toBeLessThanOrEqual(1);
  }

  // No mirrored ghost: the left glass at fin height stays night-dark.
  for (let y = finTop; y <= crownY - 1; y++) {
    if (y === transomA || y === transomB) {
      continue; // the transoms cross every bay, by design
    }

    for (let x = Math.round(cols * 0.13); x <= Math.round(cols * 0.22); x++) {
      if (x % mullionStep <= 1) {
        continue; // the wall's own shafts
      }

      expect(band(x, y)).toBeLessThanOrEqual(1);
    }
  }
});

test("airport-gate fuselage: rounded nose with a dark cockpit notch, tube solid to the fin", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { centerY, cols, crownY, leadRoot, noseX, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Upper tube and cheatline hold a '|'-grade band from the cabin to the fin root.
  for (const y of [centerY - 2, centerY]) {
    for (let x = noseX + 16; x <= leadRoot - 2; x++) {
      expect(band(x, y)).toBeGreaterThanOrEqual(4);
    }
  }

  // The cockpit-window notch reads dark just behind the rounded nose tip.
  expect(band(noseX + 4, crownY + 2)).toBeLessThanOrEqual(1);
  expect(band(noseX + 5, crownY + 2)).toBeLessThanOrEqual(1);
});

test("airport-gate wing and engines: a swept wing plank and two dense nacelles below", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { belly, cols, mullionStep, nacAx0, nacAx1, nacBx0, nacBx1, rampLen, wingTipX, wingRootX } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // The wing's lit top surface: a run of '='-grade cells sweeping below the
  // belly between tip and root (mullion columns excluded).
  let wingEdge = 0;

  for (let y = belly - 3; y <= belly + 6; y++) {
    for (let x = wingTipX + 6; x <= wingRootX - 4; x++) {
      if (x % mullionStep <= 1) {
        continue;
      }

      if (band(x, y) >= 5) {
        wingEdge++;
      }
    }
  }

  expect(wingEdge).toBeGreaterThan(25);

  // Both nacelles carry dense lozenge bodies under the wing.
  const boxes: ReadonlyArray<[number, number, number]> = [
    [nacAx0 + 4, nacAx1 - 1, 30],
    [nacBx0 + 4, nacBx1 - 1, 15],
  ];

  for (const [x0, x1, minCells] of boxes) {
    let dense = 0;

    for (let y = belly + 2; y <= belly + 12; y++) {
      for (let x = x0; x <= x1; x++) {
        if (band(x, y) >= 4) {
          dense++;
        }
      }
    }

    expect(dense).toBeGreaterThan(minCells);
  }
});

test("airport-gate curtain wall: paired mullions with caps, transoms at structural weight", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);
  applyLights(context.buffer, context.lights); // the runner's post-update pass

  expect(context.lights.length).toBe(0);

  const { cols, floorRow, glassTop, mullionStep, rampLen, transomA, transomB } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (let x = 0; x < cols - 2; x += mullionStep) {
    if (x % mullionStep !== 0) {
      continue;
    }

    // Two-cell shaft at '='-grade, mid-glass.
    const midY = transomA + 3;
    expect(band(x, midY)).toBeGreaterThanOrEqual(5);
    expect(band(x + 1, midY)).toBeGreaterThanOrEqual(5);

    // Head block under the fascia and base plate at the sill.
    expect(band(x, glassTop)).toBeGreaterThanOrEqual(5);
    expect(band(x, floorRow - 2)).toBeGreaterThanOrEqual(5);
  }

  // Transoms cross every column at mullion weight or better.
  for (const ty of [transomA, transomB]) {
    for (let x = 0; x < cols; x++) {
      expect(band(x, ty)).toBeGreaterThanOrEqual(5);
    }
  }
});

test("airport-gate sill band: a dense full-width base grounds the wall", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, floorRow, rampLen } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (let x = 0; x < cols; x++) {
    expect(band(x, floorRow)).toBeGreaterThanOrEqual(5); // '=' top edge
    expect(band(x, floorRow + 2)).toBeGreaterThanOrEqual(4); // '|' body
  }
});

test("airport-gate seats: two anchored rows with legs, seams, and a clear walkway", () => {
  const context = makeContext();
  scene.init(context);

  context.time = 1 / 60;
  scene.update(1 / 60, context);

  const { cols, cx, rampLen, seatRowA, seatRowB } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  for (const y of [seatRowA, seatRowB]) {
    let found = 0;

    for (let x = 0; x < cols; x++) {
      if (band(x, y) >= 2) {
        found++;
      }
    }

    expect(found).toBeGreaterThan(20); // seat backs exist
    expect(band(cx, y)).toBeLessThanOrEqual(1); // the walkway stays clear
    expect(band(cx - 1, y)).toBeLessThanOrEqual(1);
    expect(band(cx + 1, y)).toBeLessThanOrEqual(1);

    // The row stands on a continuous floor seam (present even in the walkway).
    expect(band(cx, y + 2)).toBeGreaterThanOrEqual(1);
  }
});

test("airport-gate summary chip carries the final shelf copy", () => {
  expect(scene.summaryChip).toBe("OTseek, 2026 — a ChatGPT app in the first public wave.");
});
