import { expect, test } from "bun:test";

import {
  applyLights,
  assertBufferInRange,
  assertBufferShape,
  assertResolutionMonotone,
  assertSceneContract,
  createBuffer,
  resolutionForDepth,
  type SceneContext,
} from "../../sdk/index.ts";
import { subwayCopySlots, subwayPlatformScene } from "./scene.ts";

function makeContext(): SceneContext {
  return {
    awake: true,
    buffer: createBuffer(subwayPlatformScene.tuning.cols, subwayPlatformScene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };
}

test("subway-platform satisfies the frozen scene contract", () => {
  assertSceneContract(subwayPlatformScene);
});

test("buffer keeps shape and range across a long run with clamped-dt gaps and lights applied", () => {
  const context = makeContext();
  subwayPlatformScene.init(context);

  // 60 simulated seconds at the runner's maxDt (0.1s) — the shape of frames a
  // scene sees right after a sleep gap. Mirrors the frozen frame order:
  // update, then applyLights.
  for (let i = 0; i < 600; i++) {
    const dt = 0.1;
    context.time += dt;
    subwayPlatformScene.update(dt, context);
    applyLights(context.buffer, context.lights);

    if (i % 60 === 0) {
      assertBufferInRange(context.buffer);
    }
  }

  assertBufferShape(context.buffer, subwayPlatformScene.tuning.cols, subwayPlatformScene.tuning.rows);
  assertBufferInRange(context.buffer);
});

test("compaction resolution is monotone and identical down and back up (bidirectional)", () => {
  const config = subwayPlatformScene.tuning.resolution ?? {};
  assertResolutionMonotone(config);

  const depths: number[] = [];
  for (let i = 0; i <= 120; i++) {
    depths.push(-0.5 + (3 * i) / 120);
  }

  const goingDown = depths.map((depth) => resolutionForDepth(depth, config));
  const goingUp = [...depths].reverse().map((depth) => resolutionForDepth(depth, config));
  goingUp.reverse();

  for (let i = 0; i < depths.length; i++) {
    expect(goingUp[i]).toEqual(goingDown[i]);
  }
});

test("the headlight arrives, stays in [0,1], and the platform goes dark between trains", () => {
  const context = makeContext();
  subwayPlatformScene.init(context);

  let maxIntensity = 0;
  let darkFrames = 0;
  let frames = 0;

  // Two full default cycles; the envelope is a pure function of time.
  const dt = 0.25;
  const period = subwayPlatformScene.tuning.motion["headlightPeriod"] ?? 42;
  const steps = Math.ceil((2 * period) / dt);

  for (let i = 0; i < steps; i++) {
    context.time += dt;
    subwayPlatformScene.update(dt, context);
    const intensity = context.lights[0]?.intensity ?? 0;

    expect(Number.isFinite(intensity)).toBe(true);
    expect(intensity).toBeGreaterThanOrEqual(0);
    expect(intensity).toBeLessThanOrEqual(1);

    maxIntensity = Math.max(maxIntensity, intensity);
    if (intensity === 0) {
      darkFrames++;
    }
    frames++;
  }

  expect(maxIntensity).toBeGreaterThan(0.3);
  expect(darkFrames / frames).toBeGreaterThan(0.2);
});

test("copy slots carry the final strings and stay inside the canvas — nothing rendered as glyphs", () => {
  expect(subwayPlatformScene.summaryChip).toBe("July 2026 — between trains, shipping open source.");

  const signSlot = subwayCopySlots.find((slot) => slot.id === "subway-sign");
  const bodySlot = subwayCopySlots.find((slot) => slot.id === "subway-body");
  expect(signSlot?.text).toBe("Up Next > NYRR Midnight Run > NYE 2026");
  expect(bodySlot?.text).toStartWith("It's July 2026 and I'm between things, building.");

  for (const slot of subwayCopySlots) {
    expect(slot.text.length).toBeGreaterThan(0);
    expect(slot.text).not.toContain("TODO");
    expect(slot.rect.x).toBeGreaterThanOrEqual(0);
    expect(slot.rect.y).toBeGreaterThanOrEqual(0);
    expect(slot.rect.x + slot.rect.w).toBeLessThanOrEqual(1);
    expect(slot.rect.y + slot.rect.h).toBeLessThanOrEqual(1);
  }
});
