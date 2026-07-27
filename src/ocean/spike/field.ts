/**
 * The value-noise water field used to drive BOTH spike renderers with
 * identical CPU-side sim work. Two modes:
 *   - drift (default): the brief's slow water breathing — few cells cross a
 *     ramp bin per frame, the dirty-cell renderer's best case.
 *   - churn (?churn=1): speed multiplied so most cells change glyph every
 *     frame — the dirty-cell renderer's worst case (fast scroll turbulence).
 */

import { createValueNoise, fbm2, type LuminanceBuffer } from "../sdk/index.ts";

export interface WaterField {
  write(buffer: LuminanceBuffer, time: number): void;
}

export function createWaterField(seed = 3, speedMultiplier = 1): WaterField {
  const noise = createValueNoise(seed);
  const scale = 0.045;
  const speed = 0.22 * speedMultiplier;
  const contrast = 1.15;

  return {
    write(buffer: LuminanceBuffer, time: number): void {
      const data = buffer.data;
      const drift = time * speed;

      for (let y = 0; y < buffer.height; y++) {
        const ny = y * scale * 1.7 + drift * 0.4;
        const row = y * buffer.width;

        for (let x = 0; x < buffer.width; x++) {
          const v = fbm2(noise, x * scale + drift, ny, 2);
          const shaped = (v - 0.5) * contrast + 0.35;
          data[row + x] = shaped <= 0 ? 0 : shaped >= 1 ? 1 : shaped;
        }
      }
    },
  };
}

/** Ramp used by both spike pages (10 glyphs, dark -> bright). */
export const SPIKE_RAMP = " ·:~≈=+*#@";

export interface SpikeParams {
  cols: number;
  rows: number;
  cell: number;
  churn: boolean;
  /** Canvas2D absolute worst case: invalidate every cell every frame. */
  full: boolean;
}

/** Multiplier applied to the field speed in churn mode. */
export const CHURN_SPEED_MULTIPLIER = 40;

/** Grid parameters from the page query string; defaults to desktop density. */
export function spikeParams(search: string): SpikeParams {
  const query = new URLSearchParams(search);
  const cols = clampInt(query.get("cols"), 200);
  const rows = clampInt(query.get("rows"), 90);
  const cell = clampInt(query.get("cell"), 8);
  const churn = query.get("churn") === "1";
  const full = query.get("full") === "1";

  return { cell, churn, cols, full, rows };
}

function clampInt(raw: string | null, fallback: number): number {
  const value = raw === null ? Number.NaN : Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 && value <= 4096 ? value : fallback;
}
