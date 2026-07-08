/**
 * The Scene contract. A scene is a simulation that writes a luminance buffer;
 * the SDK quantizes it through the scene's hand-tunable ramp into the glyph
 * grid, applies depth-driven resolution, lights, sleep/wake and docking.
 * Scene agents implement SceneModule and touch NOTHING in src/ocean/sdk/.
 */

import type { LuminanceBuffer } from "./buffer.ts";
import type { LightSource } from "./light.ts";
import type { ResolutionConfig } from "./resolution.ts";

export const DOCK_GLYPH_COLS = 12;
export const DOCK_GLYPH_ROWS = 6;

export interface SceneTuning {
  /** Glyph ramp, DARK -> BRIGHT (index 0 = darkest). Collin hand-tunes this. */
  ramp: string;
  /** Level-2 residue glyph for simplifyRamp. Default "·". */
  minimalGlyph?: string;
  /** Full-resolution luminance grid size (cells). */
  cols: number;
  rows: number;
  /** Cell size hint in CSS px for the harness/renderer (desktop 8-9, mobile 6-7). */
  cellW?: number;
  cellH?: number;
  /**
   * Scene-specific motion constants (speeds, amplitudes, thresholds), all
   * numeric so they can be hand-tuned live in the harness without code edits.
   */
  motion: Record<string, number>;
  /** Optional per-scene overrides of the compaction thresholds. */
  resolution?: Partial<ResolutionConfig>;
}

export interface SceneContext {
  /** Write luminance in [0, 1] here every update. Cleared by nobody but you. */
  readonly buffer: LuminanceBuffer;
  /**
   * Lights the runner stamps into the buffer after update() returns.
   * Mutate freely (push/splice/move). Empty by default.
   */
  readonly lights: LightSource[];
  /** Seconds since init. */
  time: number;
  /** Depth past the memory line, in viewport heights. <= 0 = fully remembered. */
  depth: number;
  /** False while the scene is offscreen/asleep (update is not called then). */
  awake: boolean;
}

export interface SceneModule {
  /**
   * Kebab-case id, unique across scenes; used for harness URLs and dock slots.
   * Reserved ids: beach, stage, classroom, corridor, trading-floor,
   * airport-gate, subway-platform, ocean-floor, anglerfish, deep-shape, demo.
   */
  readonly id: string;
  /** Hand-tunable constants; the harness edits these live. */
  readonly tuning: SceneTuning;
  /**
   * Compacted-memory glyph: exactly DOCK_GLYPH_ROWS strings of
   * DOCK_GLYPH_COLS characters each. This is what drifts to the shelf.
   */
  readonly dockGlyph: readonly string[];
  /** One-line shelf hover summary. Collin's pen: keep as TODO(collin) text. */
  readonly summaryChip?: string;
  /** Called once before the first update. Seed state, precompute tables. */
  init(context: SceneContext): void;
  /** Advance the sim by dt seconds and rewrite context.buffer. */
  update(dt: number, context: SceneContext): void;
  /** Optional: entering the viewport after sleep (context.awake already true). */
  wake?(context: SceneContext): void;
  /** Optional: leaving the viewport (context.awake already false). */
  sleep?(context: SceneContext): void;
}
