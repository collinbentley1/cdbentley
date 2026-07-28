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
import { subwayPlatformScene } from "./scene.ts";

function makeContext(cols = subwayPlatformScene.tuning.cols, rows = subwayPlatformScene.tuning.rows): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(cols, rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

/** Landmarks mirrored from the scene's proportional geometry. */
function landmarks(cols = subwayPlatformScene.tuning.cols, rows = subwayPlatformScene.tuning.rows) {
  const vx = Math.max(2, Math.round(cols * 0.36));
  const vy = Math.round(rows * 0.37);
  const faceL = Math.round(cols * 0.52);
  const faceR = Math.min(cols - 2, Math.round(cols * 0.975));
  const faceT = Math.round(rows * 0.1);
  const faceB = Math.round(rows * 0.92);
  const fw = Math.max(1, faceR - faceL);
  const fh = Math.max(1, faceB - faceT);
  const edgeY0 = rows * 1.5;

  return {
    bulletX: Math.round(faceL + 0.5 * fw),
    bulletY: Math.round(faceT + 0.075 * fh),
    cols,
    edgeAt: (x: number): number => vy + (edgeY0 - vy) * ((vx - x) / vx),
    faceB,
    faceL,
    faceR,
    faceT,
    fh,
    fw,
    lampLx: Math.round(faceL + 0.1 * fw),
    lampRx: Math.round(faceL + 0.9 * fw),
    lampY: Math.round(faceT + 0.78 * fh),
    rampLen: Array.from(subwayPlatformScene.tuning.ramp).length,
    rows,
    vx,
    vy,
    wallFoot: Math.round(rows * 0.52),
    winLx: Math.round(faceL + 0.2225 * fw),
    winRx: Math.round(faceL + 0.7775 * fw),
    winY: Math.round(faceT + 0.265 * fh),
  };
}

/** Temporarily override motion tunables (restores in a finally). */
function withMotion<T>(overrides: Record<string, number>, run: () => T): T {
  const motion = subwayPlatformScene.tuning.motion;
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

test("subway-platform obeys the scene contract", () => {
  expect(() => {
    assertSceneContract(subwayPlatformScene);
  }).not.toThrow();
});

test("subway-platform buffer stays finite in [0,1] across long runs and sleep gaps", () => {
  const context = makeContext();
  subwayPlatformScene.init(context);

  for (let frame = 0; frame < 240; frame++) {
    context.time += 1 / 60;
    subwayPlatformScene.update(1 / 60, context);
    applyLights(context.buffer, context.lights); // the runner's post-update pass
  }

  // Arbitrary sleep gap: the runner clamps dt to 0.1 but time may jump.
  context.time += 300;
  subwayPlatformScene.update(0.1, context);

  // Deep-scroll depths never change what the sim writes (compaction is SDK-side).
  context.depth = 2.5;
  context.time += 1 / 60;
  subwayPlatformScene.update(1 / 60, context);

  assertBufferShape(context.buffer, subwayPlatformScene.tuning.cols, subwayPlatformScene.tuning.rows);
  assertBufferInRange(context.buffer);
});

test("subway-platform adapts to arbitrary small grids without wrapping or stray lights", () => {
  for (const [cols, rows] of [
    [20, 10],
    [64, 36],
  ] as const) {
    const context = makeContext(cols, rows);
    subwayPlatformScene.init(context);

    for (const t of [1, 8, 17]) {
      context.time = t;
      subwayPlatformScene.update(1 / 60, context);
      assertBufferShape(context.buffer, cols, rows);
      assertBufferInRange(context.buffer);
    }

    expect(context.lights.length).toBe(0);
  }

  // Restore the module-level base cache for the tuned grid.
  const context = makeContext();
  subwayPlatformScene.init(context);
});

test("subway-platform compaction is monotone and pure (scene uses SDK defaults)", () => {
  expect(() => {
    assertResolutionMonotone(subwayPlatformScene.tuning.resolution ?? {});
  }).not.toThrow();
});

test("subway-platform compaction round-trips: descending then ascending depths agree", () => {
  const config = subwayPlatformScene.tuning.resolution ?? {};
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

test("subway-platform is steady: identical time yields byte-identical buffers (no flicker)", () => {
  const a = makeContext();
  subwayPlatformScene.init(a);
  a.time = 2.5;
  subwayPlatformScene.update(1 / 60, a);
  const first = Float32Array.from(a.buffer.data);

  subwayPlatformScene.update(1 / 60, a);

  expect(Array.from(a.buffer.data)).toEqual(Array.from(first));
});

test("subway-platform breathes: the headlight field surges between two instants with the haze stilled", () => {
  withMotion({ hazeAmount: 0, hazeFloor: 0 }, () => {
    const context = makeContext();
    subwayPlatformScene.init(context);

    const period = (subwayPlatformScene.tuning.motion["breathePeriod"] as number | undefined) ?? 11;
    context.time = period * 0.25;
    subwayPlatformScene.update(1 / 60, context);
    const before = Float32Array.from(context.buffer.data);

    context.time = period * 0.75;
    subwayPlatformScene.update(1 / 60, context);

    const { cols, faceL, rows, wallFoot } = landmarks();
    let changed = 0;

    // The beam wedge on the track bed and platform corner, left of the car.
    for (let y = wallFoot + 2; y < rows; y++) {
      for (let x = Math.round(cols * 0.1); x < faceL; x++) {
        if (Math.abs((before[y * cols + x] ?? 0) - (context.buffer.data[y * cols + x] ?? 0)) > 1e-6) {
          changed++;
        }
      }
    }

    expect(changed).toBeGreaterThan(150);
  });
});

test("subway-platform lamps: exactly two '@' cells, at the face's lower-corner lamp seats", () => {
  const context = makeContext();
  subwayPlatformScene.init(context);

  context.time = 2;
  subwayPlatformScene.update(1 / 60, context);

  const { cols, lampLx, lampRx, lampY, rampLen, rows } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const hot: Array<[number, number]> = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (band(x, y) === rampLen - 1) {
        hot.push([x, y]);
      }
    }
  }

  expect(hot.length).toBe(2);
  expect(hot).toContainEqual([lampLx, lampY]);
  expect(hot).toContainEqual([lampRx, lampY]);
});

test("subway-platform face: outlined slab, dark end windows, lit route bullet — the car front reads", () => {
  const context = makeContext();
  subwayPlatformScene.init(context);

  context.time = 2;
  subwayPlatformScene.update(1 / 60, context);

  const { bulletX, bulletY, cols, faceB, faceL, faceR, faceT, rampLen, winLx, winRx, winY } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // The roofline band and side borders hold '='-weight.
  for (let x = faceL + 6; x <= faceR - 6; x += 8) {
    expect(band(x, faceT + 1)).toBeGreaterThanOrEqual(5);
  }

  for (let y = faceT + 8; y <= faceB - 8; y += 10) {
    expect(band(faceL + 1, y)).toBeGreaterThanOrEqual(5);
    expect(band(faceR - 1, y)).toBeGreaterThanOrEqual(5);
  }

  // Both end windows stay dark glass; the route bullet burns '#'-bright.
  expect(band(winLx, winY)).toBeLessThanOrEqual(1);
  expect(band(winRx, winY)).toBeLessThanOrEqual(1);
  expect(band(bulletX, bulletY)).toBeGreaterThanOrEqual(7);
});

test("subway-platform mass: the car front keeps the lower-right quadrant alive", () => {
  const context = makeContext();
  subwayPlatformScene.init(context);

  context.time = 2;
  subwayPlatformScene.update(1 / 60, context);

  const { cols, rampLen, rows } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);
  const x0 = Math.round(cols * 0.6);
  const y0 = Math.round(rows * 0.55);
  const y1 = Math.round(rows * 0.9);
  let lit = 0;
  let total = 0;

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x < cols; x++) {
      total++;

      if (band(x, y) >= 2) {
        lit++;
      }
    }
  }

  expect(lit).toBeGreaterThan(total * 0.5);
});

test("subway-platform beam: the headlight cone reaches down-left and splashes the warning strip", () => {
  const context = makeContext();
  subwayPlatformScene.init(context);

  context.time = 2;
  subwayPlatformScene.update(1 / 60, context);

  const { cols, edgeAt, lampLx, lampY, rampLen, rows, vx } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Sample along the left lamp's aim line toward (0, 1.32 * rows): the cone
  // must lift the track bed well above its unlit ' ' base.
  const tx = 0 - lampLx;
  const ty = rows * 1.32 - lampY;

  for (const f of [0.15, 0.3, 0.45]) {
    const x = Math.round(lampLx + tx * f);
    const y = Math.round(lampY + ty * f);

    if (y < rows) {
      expect(band(x, y)).toBeGreaterThanOrEqual(2);
    }
  }

  // The warning strip catches the splash: bright cells along the edge ray.
  let bright = 0;

  for (let x = Math.round(cols * 0.16); x < vx - 2; x++) {
    const y = Math.round(edgeAt(x));

    if (y >= rows) {
      continue;
    }

    if (band(x, y) >= 4 || band(x, Math.min(rows - 1, y + 1)) >= 4) {
      bright++;
    }
  }

  expect(bright).toBeGreaterThan(Math.round(cols * 0.08));
});

test("subway-platform hierarchy: the tile wall stays dim so the light leads the eye", () => {
  const context = makeContext();
  subwayPlatformScene.init(context);

  context.time = 2;
  subwayPlatformScene.update(1 / 60, context);

  const { cols, rampLen, rows } = landmarks();
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Upper-left tile field (right of the near jamb, left of the portal).
  for (let y = 3; y <= Math.round(rows * 0.42); y += 4) {
    for (let x = Math.round(cols * 0.08); x <= Math.round(cols * 0.28); x += 5) {
      expect(band(x, y)).toBeLessThanOrEqual(2);
    }
  }
});
