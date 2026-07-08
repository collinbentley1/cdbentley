import { describe, expect, test } from "bun:test";

import {
  applyLights,
  applyRamp,
  assertRampApplied,
  assertResolutionMonotone,
  assertSceneContract,
  binBuffer,
  createBuffer,
  createDockAnimation,
  createValueNoise,
  fbm2,
  quantizeIndex,
  resolutionForDepth,
  simplifyRamp,
  smoothDetail,
} from "../src/ocean/sdk/index.ts";
import { demoScene } from "../src/ocean/sdk/demo-scene.ts";

describe("buffer", () => {
  test("createBuffer shapes and zeroes", () => {
    const buffer = createBuffer(7, 3);
    expect(buffer.width).toBe(7);
    expect(buffer.height).toBe(3);
    expect(buffer.data.length).toBe(21);
    expect(buffer.data.every((v) => v === 0)).toBe(true);
  });

  test("createBuffer rejects bad dims", () => {
    expect(() => createBuffer(0, 4)).toThrow();
    expect(() => createBuffer(4.5, 4)).toThrow();
  });

  test("binBuffer average-pools with edge blocks", () => {
    const buffer = createBuffer(3, 3);
    buffer.data.set([0, 1, 0.5, 1, 0, 0.5, 0.5, 0.5, 1]);
    const binned = binBuffer(buffer, 2);
    expect(binned.width).toBe(2);
    expect(binned.height).toBe(2);
    expect(binned.data[0]).toBeCloseTo(0.5); // (0+1+1+0)/4
    expect(binned.data[1]).toBeCloseTo(0.5); // (0.5+0.5)/2
    expect(binned.data[2]).toBeCloseTo(0.5); // (0.5+0.5)/2
    expect(binned.data[3]).toBeCloseTo(1); // lone corner
  });
});

describe("ramp", () => {
  test("quantizeIndex covers bins with top-inclusive clamp", () => {
    expect(quantizeIndex(-1, 10)).toBe(0);
    expect(quantizeIndex(0, 10)).toBe(0);
    expect(quantizeIndex(0.999, 10)).toBe(9);
    expect(quantizeIndex(1, 10)).toBe(9);
    expect(quantizeIndex(2, 10)).toBe(9);

    let previous = 0;
    for (let v = 0; v <= 1.0001; v += 0.001) {
      const index = quantizeIndex(v, 10);
      expect(index).toBeGreaterThanOrEqual(previous);
      previous = index;
    }
  });

  test("applyRamp renders rows dark to bright", () => {
    const buffer = createBuffer(4, 1);
    buffer.data.set([0, 0.34, 0.67, 1]);
    expect(applyRamp(buffer, " .:#")).toEqual([" .:#"]);
    expect(() => {
      assertRampApplied(buffer, " .:#", [" .:#"]);
    }).not.toThrow();
    expect(() => {
      assertRampApplied(buffer, " .:#", [" ..#"]);
    }).toThrow();
  });

  test("simplifyRamp implements full -> sampled -> residue", () => {
    const ramp = " .:-=+*#%@";
    expect(simplifyRamp(ramp, 0)).toBe(ramp);
    const level1 = simplifyRamp(ramp, 1);
    expect(Array.from(level1).length).toBe(5);
    expect(level1.startsWith(" ")).toBe(true);
    expect(level1.endsWith("@")).toBe(true);
    expect(simplifyRamp(ramp, 2)).toBe(" ·");
    expect(simplifyRamp(ramp, 2, "*")).toBe(" *");
  });
});

describe("resolution (the compaction contract)", () => {
  test("full detail before the memory line", () => {
    const res = resolutionForDepth(-0.2);
    expect(res.detail).toBe(1);
    expect(res.bin).toBe(1);
    expect(res.rampLevel).toBe(0);
    expect(res.collapse).toBe(0);
  });

  test("fully docked past collapse end", () => {
    const res = resolutionForDepth(2);
    expect(res.detail).toBe(0);
    expect(res.bin).toBe(4);
    expect(res.rampLevel).toBe(2);
    expect(res.collapse).toBe(1);
  });

  test("monotone and hysteresis-free (default + overridden config)", () => {
    expect(() => {
      assertResolutionMonotone();
    }).not.toThrow();
    expect(() => {
      assertResolutionMonotone({ binDepths: [0.2, 0.6], collapseDepths: [0.8, 1.2], rampDepths: [0.3, 0.7] });
    }).not.toThrow();
  });

  test("down-then-up traversal is exactly symmetric (bidirectional)", () => {
    const depths = Array.from({ length: 101 }, (_, i) => i * 0.03);
    const down = depths.map((d) => resolutionForDepth(d));
    const up = [...depths].reverse().map((d) => resolutionForDepth(d)).reverse();
    expect(down).toEqual(up);
  });

  test("invalid configs are rejected", () => {
    expect(() => resolutionForDepth(0.5, { binDepths: [0.8, 0.4] })).toThrow();
    expect(() => resolutionForDepth(0.5, { dampingTau: -1 })).toThrow();
  });

  test("smoothDetail converges without overshoot", () => {
    let value = 1;
    for (let i = 0; i < 240; i++) {
      value = smoothDetail(value, 0, 1 / 60);
      expect(value).toBeGreaterThanOrEqual(0);
    }
    expect(value).toBeLessThan(0.01);
    expect(smoothDetail(0.4, 0.7, 1, 0)).toBe(0.7);
  });
});

describe("lights", () => {
  test("adds a clamped radial bump", () => {
    const buffer = createBuffer(11, 11);
    buffer.data.fill(0.2);
    applyLights(buffer, [{ intensity: 1, radius: 4, x: 5, y: 5 }]);
    expect(buffer.data[5 * 11 + 5]).toBe(1); // 0.2 + 1 clamps
    expect(buffer.data[0]).toBeCloseTo(0.2); // outside the radius
    const mid = buffer.data[5 * 11 + 7] ?? 0; // 2 cells away
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(1);
  });

  test("zero radius or intensity is a no-op", () => {
    const buffer = createBuffer(4, 4);
    applyLights(buffer, [
      { intensity: 0, radius: 3, x: 2, y: 2 },
      { intensity: 1, radius: 0, x: 2, y: 2 },
    ]);
    expect(buffer.data.every((v) => v === 0)).toBe(true);
  });
});

describe("dock (spring on bezier)", () => {
  const from = { h: 300, w: 600, x: 100, y: 100 };
  const to = { h: 48, w: 96, x: 900, y: 20 };

  test("endpoints match the rects", () => {
    const dock = createDockAnimation(from, to);
    const start = dock.frameAt(0);
    expect(start.x + start.w / 2).toBeCloseTo(from.x + from.w / 2);
    expect(start.y + start.h / 2).toBeCloseTo(from.y + from.h / 2);
    expect(start.w).toBeCloseTo(from.w);
    const end = dock.frameAt(1);
    expect(end.x + end.w / 2).toBeCloseTo(to.x + to.w / 2);
    expect(end.w).toBeCloseTo(to.w);
    expect(end.h).toBeCloseTo(to.h);
  });

  test("restore replays the same path (frameAt is direction-independent)", () => {
    const dock = createDockAnimation(from, to);
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const before = dock.frameAt(t);
      dock.reverse();
      const after = dock.frameAt(t);
      expect(after).toEqual(before);
      dock.reverse();
    }
  });

  test("spring settles at the shelf, then reverses home", () => {
    const dock = createDockAnimation(from, to);
    for (let i = 0; i < 600 && !dock.settled; i++) {
      dock.step(1 / 60);
    }
    expect(dock.settled).toBe(true);
    expect(dock.progress).toBeCloseTo(1);

    dock.reverse();
    expect(dock.direction).toBe(-1);
    for (let i = 0; i < 600 && !dock.settled; i++) {
      dock.step(1 / 60);
    }
    expect(dock.settled).toBe(true);
    expect(dock.progress).toBeCloseTo(0);
  });
});

describe("noise", () => {
  test("deterministic per seed, in [0, 1]", () => {
    const a = createValueNoise(42);
    const b = createValueNoise(42);
    const c = createValueNoise(43);
    let differs = false;

    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const y = i * 0.19;
      expect(a(x, y)).toBe(b(x, y));

      if (Math.abs(a(x, y) - c(x, y)) > 1e-6) {
        differs = true;
      }

      const value = fbm2(a, x, y, 3);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }

    expect(differs).toBe(true);
  });
});

describe("scene contract", () => {
  test("demo scene passes", () => {
    expect(() => {
      assertSceneContract(demoScene);
    }).not.toThrow();
  });

  test("broken dock glyph fails", () => {
    const broken = {
      ...demoScene,
      dockGlyph: ["too short"],
      id: "broken-demo",
    };
    expect(() => {
      assertSceneContract(broken);
    }).toThrow(/dockGlyph/);
  });

  test("out-of-range luminance fails", () => {
    const hot = {
      ...demoScene,
      id: "hot-demo",
      update(_dt: number, context: Parameters<typeof demoScene.update>[1]): void {
        context.buffer.data.fill(2);
      },
    };
    expect(() => {
      assertSceneContract(hot);
    }).toThrow(/\[0, 1\]/);
  });
});
