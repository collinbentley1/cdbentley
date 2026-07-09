/**
 * The always-on ocean field (WS-C Phase C) — the water between the dioramas.
 * A viewport-sized glyph grid breathing on the sparse ramp end via value
 * noise; scroll velocity feeds turbulence slightly (fast scroll = churn,
 * stillness = calm — subtle, discovered, not announced).
 *
 * This is the ONLY always-on sim; every scene sleeps offscreen.
 */

import { createBuffer, createGlyphRenderer, createValueNoise, fbm2, type GlyphRenderer, type LuminanceBuffer } from "../sdk/index.ts";

const FIELD_RAMP = " ·:~≈";

export interface OceanField {
  /** Advance dt seconds with the current turbulence (0..1) and repaint. */
  step(dt: number, turbulence: number): number;
  /** Rebuild the grid for a new viewport size. */
  resize(widthPx: number, heightPx: number): void;
  stop(): void;
}

export function createOceanField(canvas: HTMLCanvasElement): OceanField {
  const noise = createValueNoise(7);
  let renderer: GlyphRenderer | null = null;
  let buffer: LuminanceBuffer | null = null;
  let drift = 0;

  const resize = (widthPx: number, heightPx: number): void => {
    const cell = widthPx < 720 ? 7 : 9;
    const cols = Math.max(16, Math.ceil(widthPx / cell));
    const rows = Math.max(16, Math.ceil(heightPx / cell));
    renderer = createGlyphRenderer(canvas, { cellH: cell, cellW: cell, cols, rows });
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    buffer = createBuffer(cols, rows);
  };

  return {
    resize,
    step(dt: number, turbulence: number): number {
      if (!renderer || !buffer) {
        return 0;
      }

      const started = performance.now();
      // Turbulence advances the field faster and lifts the churn octave.
      drift += dt * (0.05 + 0.35 * turbulence);
      const gain = 0.5 + 0.25 * turbulence;
      const { width, height, data } = buffer;

      for (let y = 0; y < height; y++) {
        const ny = y * 0.09;

        for (let x = 0; x < width; x++) {
          const value = fbm2(noise, x * 0.055 + drift, ny + drift * 0.6, 2, 2, gain);
          // Keep the open water on the sparse ramp end (0..~0.35).
          const idx = y * width + x;
          data[idx] = value * (0.22 + 0.13 * turbulence);
        }
      }

      renderer.draw(buffer, FIELD_RAMP);
      return performance.now() - started;
    },
    stop(): void {
      renderer?.clear();
    },
  };
}
