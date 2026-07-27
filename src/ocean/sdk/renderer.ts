/**
 * The glyph-grid renderer. Interface FROZEN at scene-sdk-v1; the
 * implementation behind it is the Phase A spike winner:
 *
 *   WebGL2 — a fullscreen pass sampling a glyph-atlas texture from a
 *   luminance texture (the shader does the luminance -> ramp mapping),
 *   with automatic Canvas2D glyph-atlas fallback where WebGL2 is
 *   unavailable. Numbers and rationale: reports/renderer-spike.md.
 *
 * Canvas-based, never per-character DOM. devicePixelRatio capped at
 * OCEAN_THEME.dprCap. Scenes never call this directly — the runner does —
 * which is exactly why the implementation can change without touching
 * scene code.
 */

import type { LuminanceBuffer } from "./buffer.ts";
import { createCanvas2dRenderer } from "./renderer-canvas2d.ts";
import { createWebglRenderer } from "./renderer-webgl.ts";

export interface GlyphRendererOptions {
  /** Full-resolution grid size (must equal the scene buffer dims). */
  cols: number;
  rows: number;
  /** Cell size in CSS px (desktop 8-9, mobile 6-7). */
  cellW: number;
  cellH: number;
  ink?: string;
  background?: string;
  fontFamily?: string;
  fontScale?: number;
  /** Hard cap on devicePixelRatio. Default OCEAN_THEME.dprCap (2). */
  dprCap?: number;
}

export interface GlyphRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly cols: number;
  readonly rows: number;
  readonly cellW: number;
  readonly cellH: number;
  readonly dpr: number;
  /**
   * Quantize `buffer` through `ramp` (dark -> bright) at grid stride `bin`
   * and repaint. `buffer` is always full-resolution; binning happens inside.
   */
  draw(buffer: LuminanceBuffer, ramp: string, options?: { bin?: 1 | 2 | 4 }): void;
  /** Fill with the background and forget any cached frame state. */
  clear(): void;
  /** Instrumentation: cells repainted by the last draw / cells in the grid. */
  stats(): { dirtyCells: number; totalCells: number };
}

/** WebGL2 first (the spike winner); Canvas2D fallback otherwise. */
export function createGlyphRenderer(canvas: HTMLCanvasElement, options: GlyphRendererOptions): GlyphRenderer {
  const webgl = createWebglRenderer(canvas, options);

  if (webgl) {
    return webgl;
  }

  console.info("ocean: webgl2 unavailable, using canvas2d fallback renderer");
  return createCanvas2dRenderer(canvas, options);
}
