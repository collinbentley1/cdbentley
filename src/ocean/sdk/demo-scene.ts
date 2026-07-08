/**
 * SDK reference scene ("demo") — NOT one of the eight site scenes. It exists
 * so the harness pattern is runnable out of the box and so tests can exercise
 * the full contract: a breathing value-noise pool, one drifting light source,
 * tunable motion constants, and a dock glyph.
 *
 * Scene agents: copy the SHAPE of this file into src/ocean/scenes/<id>/scene.ts;
 * do not import it.
 */

import { cellIndex } from "./buffer.ts";
import { createValueNoise, fbm2 } from "./noise.ts";
import type { SceneContext, SceneModule } from "./types.ts";

const noise = createValueNoise(7);

export const demoScene: SceneModule = {
  dockGlyph: [
    "    ····    ",
    "  ·:~~~~:·  ",
    " ·~≈≈≈≈≈≈~· ",
    " ·~≈≈≈≈≈≈~· ",
    "  ·:~~~~:·  ",
    "    ····    ",
  ],
  id: "demo",
  init(context: SceneContext): void {
    context.lights.push({ intensity: 0.9, radius: 9, x: context.buffer.width / 2, y: context.buffer.height / 2 });
  },
  summaryChip: "TODO(collin): demo scene summary line",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 120,
    minimalGlyph: "·",
    motion: {
      contrast: 1.1,
      driftSpeed: 0.16,
      lightOrbit: 0.35,
      scale: 0.045,
    },
    ramp: " ·:~≈=+*#@",
    rows: 56,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, lights, time } = context;
    const { contrast = 1, driftSpeed = 0.15, lightOrbit = 0.35, scale = 0.05 } = this.tuning.motion;
    const data = buffer.data;

    for (let y = 0; y < buffer.height; y++) {
      const ny = y * scale * 1.7;

      for (let x = 0; x < buffer.width; x++) {
        const v = fbm2(noise, x * scale + time * driftSpeed, ny + time * driftSpeed * 0.4, 2);
        const shaped = (v - 0.5) * contrast + 0.32;
        data[cellIndex(buffer, x, y)] = shaped <= 0 ? 0 : shaped >= 1 ? 1 : shaped;
      }
    }

    const light = lights[0];

    if (light) {
      light.x = buffer.width / 2 + Math.cos(time * lightOrbit) * buffer.width * 0.3;
      light.y = buffer.height / 2 + Math.sin(time * lightOrbit * 1.3) * buffer.height * 0.25;
    }
  },
};
