/**
 * Pre-rasterized glyph atlas: every glyph of a ramp drawn ONCE into an
 * offscreen canvas strip; the renderer then blits cells with drawImage.
 * Cells are opaque (background baked in) so a dirty cell needs exactly one
 * drawImage — no clearRect.
 */

import { OCEAN_THEME } from "./theme.ts";

export interface GlyphAtlasOptions {
  /** The glyphs to rasterize, in ramp order. */
  glyphs: string;
  /** Cell size in CSS px. */
  cellW: number;
  cellH: number;
  /** Device pixel ratio the atlas is rasterized at (cap applied by caller). */
  dpr: number;
  ink?: string;
  background?: string;
  fontFamily?: string;
  /** Font size as a fraction of cellH. Default 0.95. */
  fontScale?: number;
}

export interface GlyphAtlas {
  readonly source: HTMLCanvasElement;
  /** Device-pixel size of one atlas cell. */
  readonly cellW: number;
  readonly cellH: number;
  readonly glyphs: readonly string[];
}

export function createGlyphAtlas(options: GlyphAtlasOptions): GlyphAtlas {
  const glyphs = Array.from(options.glyphs);
  const cellW = Math.max(1, Math.round(options.cellW * options.dpr));
  const cellH = Math.max(1, Math.round(options.cellH * options.dpr));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, cellW * glyphs.length);
  canvas.height = cellH;

  const ctx = canvas.getContext("2d", { alpha: false });

  if (!ctx) {
    throw new Error("createGlyphAtlas: 2d context unavailable");
  }

  ctx.fillStyle = options.background ?? OCEAN_THEME.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = options.ink ?? OCEAN_THEME.ink;
  ctx.font = `${Math.max(1, Math.floor(cellH * (options.fontScale ?? 0.95)))}px ${options.fontFamily ?? OCEAN_THEME.fontFamily}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i] ?? " ";
    if (glyph !== " ") {
      ctx.fillText(glyph, i * cellW + cellW / 2, cellH / 2 + cellH * 0.02);
    }
  }

  return { cellH, cellW, glyphs, source: canvas };
}
