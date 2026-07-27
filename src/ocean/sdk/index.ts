/**
 * Scene SDK public surface — FROZEN at tag scene-sdk-v1.
 * Scene agents import ONLY from this module (via ../../sdk/index.ts) and
 * never edit anything under src/ocean/sdk/. See src/ocean/sdk/README.md.
 */

export { assertBufferInRange, assertBufferShape, assertRampApplied, assertResolutionMonotone, assertSceneContract } from "./assert.ts";
export { createGlyphAtlas, type GlyphAtlas, type GlyphAtlasOptions } from "./atlas.ts";
export { binBuffer, cellIndex, clearBuffer, createBuffer, type LuminanceBuffer } from "./buffer.ts";
export { createDockAnimation, type DockAnimation, type DockFrame, type DockOptions, type Rect } from "./dock.ts";
export { runHarness, type HarnessOptions } from "./harness.ts";
export { applyLights, type LightSource } from "./light.ts";
export { createValueNoise, fbm2, type Noise2 } from "./noise.ts";
export { applyRamp, quantizeIndex, simplifyRamp } from "./ramp.ts";
export { createGlyphRenderer, type GlyphRenderer, type GlyphRendererOptions } from "./renderer.ts";
export { createCanvas2dRenderer } from "./renderer-canvas2d.ts";
export { createWebglRenderer } from "./renderer-webgl.ts";
export {
  DEFAULT_RESOLUTION,
  resolutionForDepth,
  smoothDetail,
  validateResolutionConfig,
  type Resolution,
  type ResolutionConfig,
} from "./resolution.ts";
export { bindSleepWake, createSceneRunner, type SceneRunner, type SceneRunnerOptions } from "./runner.ts";
export { OCEAN_THEME } from "./theme.ts";
export { DOCK_GLYPH_COLS, DOCK_GLYPH_ROWS, type SceneContext, type SceneModule, type SceneTuning } from "./types.ts";
