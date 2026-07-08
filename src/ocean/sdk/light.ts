/**
 * Light sources — small radii where the ramp lifts.
 *
 * A light is additive luminance stamped into the buffer AFTER the scene's
 * update pass (the runner does this automatically for lights the scene keeps
 * in context.lights). Falloff is a smooth quartic-ish bump; the result is
 * clamped to [0, 1]. The deep-register lure is exactly this: a light whose
 * radius makes hidden detail resolve out of the black.
 */

import type { LuminanceBuffer } from "./buffer.ts";

export interface LightSource {
  /** Center, in buffer cell coordinates (fractional allowed). */
  x: number;
  y: number;
  /** Radius in cells; luminance contribution reaches zero here. */
  radius: number;
  /** Peak added luminance at the center, 0..1. */
  intensity: number;
}

export function applyLights(buffer: LuminanceBuffer, lights: readonly LightSource[]): void {
  const data = buffer.data;

  for (const light of lights) {
    if (light.radius <= 0 || light.intensity <= 0) {
      continue;
    }

    const x0 = Math.max(0, Math.floor(light.x - light.radius));
    const x1 = Math.min(buffer.width - 1, Math.ceil(light.x + light.radius));
    const y0 = Math.max(0, Math.floor(light.y - light.radius));
    const y1 = Math.min(buffer.height - 1, Math.ceil(light.y + light.radius));
    const invR2 = 1 / (light.radius * light.radius);

    for (let y = y0; y <= y1; y++) {
      const dy = y - light.y;
      const row = y * buffer.width;

      for (let x = x0; x <= x1; x++) {
        const dx = x - light.x;
        const q = 1 - (dx * dx + dy * dy) * invR2;

        if (q <= 0) {
          continue;
        }

        const added = (data[row + x] ?? 0) + light.intensity * q * q;
        data[row + x] = added >= 1 ? 1 : added;
      }
    }
  }
}
