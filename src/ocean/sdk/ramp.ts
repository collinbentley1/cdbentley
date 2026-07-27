/**
 * Ramp quantization — luminance in, glyphs out.
 *
 * FROZEN CONVENTION: ramps are ordered DARK -> BRIGHT. Index 0 is the darkest
 * glyph (usually a space); the last index is the brightest/heaviest. A water
 * ramp reads ` ·:~≈`, architecture ` |=#@`. Equal-width bins, top-inclusive:
 * quantizeIndex(v, n) = min(n - 1, floor(clamp01(v) * n)).
 */

import type { LuminanceBuffer } from "./buffer.ts";

export function quantizeIndex(value: number, rampLength: number): number {
  if (!Number.isInteger(rampLength) || rampLength < 1) {
    throw new Error(`quantizeIndex: rampLength must be a positive integer, got ${rampLength}`);
  }

  const v = value <= 0 ? 0 : value >= 1 ? 1 : value;
  return Math.min(rampLength - 1, Math.floor(v * rampLength));
}

/** Quantize a whole buffer through a ramp; returns one string per row. */
export function applyRamp(buffer: LuminanceBuffer, ramp: string): string[] {
  const chars = Array.from(ramp);
  const rows: string[] = [];

  for (let y = 0; y < buffer.height; y++) {
    let row = "";
    const base = y * buffer.width;
    for (let x = 0; x < buffer.width; x++) {
      row += chars[quantizeIndex(buffer.data[base + x] ?? 0, chars.length)] ?? " ";
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Compaction ramp simplification (the `@%#*+=-:. ` -> `#+-. ` -> `·` move,
 * in dark->bright order). Pure function of the scene's own ramp:
 *
 * - level 0: the ramp unchanged.
 * - level 1: ~half the glyphs, sampled evenly, endpoints kept.
 * - level 2: two glyphs — the scene's darkest glyph plus `minimalGlyph`
 *   (default "·"), so unlit cells stay dark and anything lit is residue.
 */
export function simplifyRamp(ramp: string, level: 0 | 1 | 2, minimalGlyph = "·"): string {
  const chars = Array.from(ramp);

  if (chars.length < 2) {
    throw new Error(`simplifyRamp: ramp needs at least 2 glyphs, got ${JSON.stringify(ramp)}`);
  }

  if (level === 0) {
    return ramp;
  }

  if (level === 2) {
    return `${chars[0] ?? " "}${minimalGlyph}`;
  }

  const count = Math.max(3, Math.ceil(chars.length / 2));

  if (count >= chars.length) {
    return ramp;
  }

  let out = "";
  for (let i = 0; i < count; i++) {
    out += chars[Math.round((i * (chars.length - 1)) / (count - 1))] ?? " ";
  }

  return out;
}
