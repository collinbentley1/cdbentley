/**
 * Decorative Golden Gate Bridge layer for the beach handoff.
 *
 * This is intentionally not a descent SceneModule: it has no prose, depth,
 * shelf slot, or claim surface. It does use the same luminance-buffer and
 * glyph-grid renderer as every ocean scene, so the bridge belongs to the
 * visual system without changing the frozen scene order.
 */

import { createBuffer, createGlyphRenderer, type LuminanceBuffer } from "../../sdk/index.ts";

export const BRIDGE_GRID = {
  cellH: 8,
  cellW: 8,
  cols: 120,
  ramp: " ·:-|=+#@",
  rows: 36,
} as const;

export interface BridgeLayer {
  /** Render deterministic seconds-since-load; returns measured CPU ms. */
  draw(time: number): number;
}

function putMax(buffer: LuminanceBuffer, x: number, y: number, value: number): void {
  if (x < 0 || x >= buffer.width || y < 0 || y >= buffer.height) {
    return;
  }

  const index = y * buffer.width + x;
  const current = buffer.data[index] ?? 0;

  if (value > current) {
    buffer.data[index] = value;
  }
}

function hash(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function smoothstep(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  return p * p * (3 - 2 * p);
}

/** Fixed cable geometry sampled once per x; the architecture never moves. */
export function bridgeCableRow(x: number): number {
  const leftTower = 34;
  const rightTower = 86;

  if (x <= leftTower) {
    return Math.round(13 - 8 * smoothstep(x / leftTower));
  }

  if (x >= rightTower) {
    return Math.round(5 + 8 * smoothstep((x - rightTower) / (BRIDGE_GRID.cols - 1 - rightTower)));
  }

  const t = (x - leftTower) / (rightTower - leftTower);
  return Math.round(5 + 13 * 4 * t * (1 - t));
}

/** Pure frame writer used by both the browser layer and focused tests. */
export function renderBridgeFrame(buffer: LuminanceBuffer, time: number): void {
  const { width: w, height: h, data } = buffer;
  data.fill(0);

  // Sparse breathing fog: fixed motes, brightness only. The structure stays
  // still while the air makes it feel alive.
  for (let y = 2; y < 25; y++) {
    for (let x = 0; x < w; x++) {
      const seed = hash(x, y);

      if (seed > 0.972) {
        const breath = 0.5 + 0.5 * Math.sin(time * 0.32 + seed * Math.PI * 2);
        data[y * w + x] = 0.08 + breath * 0.08;
      }
    }
  }

  // Moving water lives below the deck. Two quiet wave families cross, which
  // changes glyphs without making the bridge itself sway or flicker.
  for (let y = 29; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const waveA = Math.sin(x * 0.24 - time * 0.55 + y * 1.7);
      const waveB = Math.sin(x * 0.11 + time * 0.31 - y * 0.9);
      const crest = Math.max(0, waveA * 0.7 + waveB * 0.3);
      const sparkle = hash(x + y * 3, y) > 0.94 ? 0.035 : 0;
      data[y * w + x] = Math.min(0.28, 0.035 + crest * 0.14 + sparkle);
    }
  }

  const deckTop = 26;

  // Main cable and vertical suspenders.
  for (let x = 1; x < w - 1; x++) {
    const cableY = bridgeCableRow(x);
    putMax(buffer, x, cableY, 0.78);

    if (x % 5 === 0 && x !== 35 && x !== 85) {
      for (let y = cableY + 1; y < deckTop; y++) {
        putMax(buffer, x, y, 0.43);
      }
    }
  }

  // Deck and its lower truss.
  for (let x = 1; x < w - 1; x++) {
    putMax(buffer, x, deckTop, 0.72);
    putMax(buffer, x, deckTop + 1, x % 3 === 0 ? 0.68 : 0.56);
  }

  // Golden Gate tower pairs and crossbars.
  for (const [outer, inner] of [
    [32, 36],
    [83, 87],
  ] as const) {
    for (let y = 5; y <= 28; y++) {
      putMax(buffer, outer, y, 0.9);
      putMax(buffer, inner, y, 0.9);
    }

    for (const y of [9, 15, 21]) {
      for (let x = outer; x <= inner; x++) {
        putMax(buffer, x, y, 0.78);
      }
    }
  }
}

export function createBridgeLayer(canvas: HTMLCanvasElement): BridgeLayer {
  const buffer = createBuffer(BRIDGE_GRID.cols, BRIDGE_GRID.rows);
  const renderer = createGlyphRenderer(canvas, BRIDGE_GRID);
  canvas.style.maxWidth = "100%";
  canvas.style.height = "auto";

  return {
    draw(time: number): number {
      const started = performance.now();
      renderBridgeFrame(buffer, time);
      renderer.draw(buffer, BRIDGE_GRID.ramp);
      return performance.now() - started;
    },
  };
}
