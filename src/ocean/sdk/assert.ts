/**
 * Assertion helpers — DOM-free, runnable under `bun test` and importable by
 * harness pages. Every scene test should call assertSceneContract(scene).
 */

import { createBuffer, type LuminanceBuffer } from "./buffer.ts";
import { applyRamp } from "./ramp.ts";
import { DEFAULT_RESOLUTION, resolutionForDepth, validateResolutionConfig, type ResolutionConfig } from "./resolution.ts";
import { DOCK_GLYPH_COLS, DOCK_GLYPH_ROWS, type SceneContext, type SceneModule } from "./types.ts";

export function assertBufferShape(buffer: LuminanceBuffer, cols: number, rows: number): void {
  if (buffer.width !== cols || buffer.height !== rows) {
    throw new Error(`buffer shape ${buffer.width}x${buffer.height}, expected ${cols}x${rows}`);
  }

  if (buffer.data.length !== cols * rows) {
    throw new Error(`buffer data length ${buffer.data.length}, expected ${cols * rows}`);
  }
}

export function assertBufferInRange(buffer: LuminanceBuffer): void {
  const data = buffer.data;

  for (let i = 0; i < data.length; i++) {
    const v = data[i] ?? 0;

    if (!Number.isFinite(v) || v < 0 || v > 1) {
      const x = i % buffer.width;
      const y = Math.floor(i / buffer.width);
      throw new Error(`buffer[${x},${y}] = ${v}; scenes must write finite luminance in [0, 1]`);
    }
  }
}

/** Checks that quantizing `buffer` through `ramp` yields exactly `expected` rows. */
export function assertRampApplied(buffer: LuminanceBuffer, ramp: string, expected: readonly string[]): void {
  const rows = applyRamp(buffer, ramp);

  if (rows.length !== expected.length) {
    throw new Error(`applyRamp produced ${rows.length} rows, expected ${expected.length}`);
  }

  for (let y = 0; y < rows.length; y++) {
    if (rows[y] !== expected[y]) {
      throw new Error(`row ${y}: ${JSON.stringify(rows[y])} != ${JSON.stringify(expected[y])}`);
    }
  }
}

/**
 * Verifies the compaction function is monotone (detail never increases, bin
 * and rampLevel never decrease with depth) and hysteresis-free (re-evaluating
 * any depth gives identical results) for the given config.
 */
export function assertResolutionMonotone(config: Partial<ResolutionConfig> = {}, samples = 512, maxDepth = 4): void {
  if (Object.keys(config).length > 0) {
    validateResolutionConfig({ ...DEFAULT_RESOLUTION, ...config });
  }

  let previousDetail = Number.POSITIVE_INFINITY;
  let previousBin = 0;
  let previousRampLevel = -1;
  let previousCollapse = -1;

  for (let i = 0; i <= samples; i++) {
    const depth = -0.5 + ((maxDepth + 0.5) * i) / samples;
    const forward = resolutionForDepth(depth, config);
    const again = resolutionForDepth(depth, config);

    if (
      forward.detail !== again.detail ||
      forward.bin !== again.bin ||
      forward.rampLevel !== again.rampLevel ||
      forward.collapse !== again.collapse
    ) {
      throw new Error(`resolutionForDepth not pure at depth ${depth}`);
    }

    if (forward.detail > previousDetail + 1e-9) {
      throw new Error(`detail increased with depth at ${depth}`);
    }

    if (forward.bin < previousBin) {
      throw new Error(`bin decreased with depth at ${depth}`);
    }

    if (forward.rampLevel < previousRampLevel) {
      throw new Error(`rampLevel decreased with depth at ${depth}`);
    }

    if (forward.collapse < previousCollapse - 1e-9) {
      throw new Error(`collapse decreased with depth at ${depth}`);
    }

    previousDetail = forward.detail;
    previousBin = forward.bin;
    previousRampLevel = forward.rampLevel;
    previousCollapse = forward.collapse;
  }
}

/**
 * Structural + behavioral scene check: ids, ramp, dock glyph shape, and one
 * init + a few updates on a scratch context writing valid luminance.
 */
export function assertSceneContract(scene: SceneModule): void {
  if (!/^[a-z][a-z0-9-]*$/.test(scene.id)) {
    throw new Error(`scene id ${JSON.stringify(scene.id)} must be kebab-case`);
  }

  if (Array.from(scene.tuning.ramp).length < 2) {
    throw new Error(`scene ${scene.id}: tuning.ramp needs at least 2 glyphs`);
  }

  if (!Number.isInteger(scene.tuning.cols) || !Number.isInteger(scene.tuning.rows) || scene.tuning.cols <= 0 || scene.tuning.rows <= 0) {
    throw new Error(`scene ${scene.id}: tuning.cols/rows must be positive integers`);
  }

  if (scene.dockGlyph.length !== DOCK_GLYPH_ROWS) {
    throw new Error(`scene ${scene.id}: dockGlyph must have ${DOCK_GLYPH_ROWS} rows, got ${scene.dockGlyph.length}`);
  }

  for (const [index, row] of scene.dockGlyph.entries()) {
    if (Array.from(row).length !== DOCK_GLYPH_COLS) {
      throw new Error(`scene ${scene.id}: dockGlyph row ${index} must be ${DOCK_GLYPH_COLS} chars, got ${Array.from(row).length}`);
    }
  }

  if (scene.tuning.resolution) {
    assertResolutionMonotone(scene.tuning.resolution);
  }

  const context: SceneContext = {
    awake: true,
    buffer: createBuffer(scene.tuning.cols, scene.tuning.rows),
    depth: 0,
    lights: [],
    time: 0,
  };

  scene.init(context);

  for (let frame = 0; frame < 3; frame++) {
    context.time += 1 / 60;
    scene.update(1 / 60, context);
  }

  assertBufferShape(context.buffer, scene.tuning.cols, scene.tuning.rows);
  assertBufferInRange(context.buffer);
}
