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

function makeContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(stageScene.tuning.cols, stageScene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
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

test("stage sways: the fly system moves between frames", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1;
  stageScene.update(1 / 60, context);
  const before = Float32Array.from(context.buffer.data);

  context.time = 5.5;
  stageScene.update(1 / 60, context);

  let changed = 0;

  for (let i = 0; i < before.length; i++) {
    if (Math.abs((before[i] ?? 0) - (context.buffer.data[i] ?? 0)) > 1e-6) {
      changed++;
    }
  }

  expect(changed).toBeGreaterThan(0);
});

test("stage floor: one solid '='-weight proscenium line spans the full width", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);

  const { cols, rows, ramp } = stageScene.tuning;
  const rampLen = Array.from(ramp).length;
  const floorTop = Math.floor(rows * 0.62);

  for (let x = 0; x < cols; x++) {
    const lum = context.buffer.data[floorTop * cols + x] ?? 0;
    expect(quantizeIndex(lum, rampLen)).toBe(5); // '=' band, pre-light
  }
});

test("stage figure: 2-cell head over a 4-cell shoulder line, 2+ ramp steps above the pool", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);
  applyLights(context.buffer, context.lights); // the runner's post-update pass

  const { cols, rows, ramp } = stageScene.tuning;
  const rampLen = Array.from(ramp).length;
  const floorTop = Math.floor(rows * 0.62);
  const figX = Math.round((stageScene.tuning.motion.figureX ?? 0.535) * (cols - 1));
  const figTop = floorTop - 8;
  const band = (x: number, y: number): number => quantizeIndex(context.buffer.data[y * cols + x] ?? 0, rampLen);

  // Head: exactly 2 cells wide, flanked by darker air.
  const headBand = Math.min(band(figX, figTop), band(figX + 1, figTop));
  expect(headBand).toBeGreaterThanOrEqual(band(figX - 1, figTop) + 2);
  expect(headBand).toBeGreaterThanOrEqual(band(figX + 2, figTop) + 2);
  expect(headBand).toBeGreaterThanOrEqual(band(figX, figTop - 1) + 2);

  // Shoulder line: 4 cells wide, flanked by darker air.
  const shoulderY = figTop + 2;
  let shoulderBand = rampLen;

  for (let dx = -1; dx <= 2; dx++) {
    shoulderBand = Math.min(shoulderBand, band(figX + dx, shoulderY));
  }

  expect(shoulderBand).toBeGreaterThanOrEqual(band(figX - 2, shoulderY) + 2);
  expect(shoulderBand).toBeGreaterThanOrEqual(band(figX + 3, shoulderY) + 2);

  // The silhouette sits 2+ ramp steps above the spotlight pool beside it.
  expect(headBand).toBeGreaterThanOrEqual(band(figX - 3, shoulderY) + 2);
  expect(shoulderBand).toBeGreaterThanOrEqual(band(figX + 4, shoulderY) + 2);
});

test("stage registers exactly one light (the ghost light) with sane params", () => {
  const context = makeContext();
  stageScene.init(context);

  context.time = 1 / 60;
  stageScene.update(1 / 60, context);

  expect(context.lights.length).toBe(1);
  const light = context.lights[0]!;
  expect(light.intensity).toBeGreaterThan(0);
  expect(light.intensity).toBeLessThanOrEqual(1);
  expect(light.radius).toBeGreaterThan(0);
  expect(light.x).toBeGreaterThanOrEqual(0);
  expect(light.x).toBeLessThan(stageScene.tuning.cols);
  expect(light.y).toBeGreaterThanOrEqual(0);
  expect(light.y).toBeLessThan(stageScene.tuning.rows);
});
