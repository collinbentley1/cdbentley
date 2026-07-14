/**
 * Deep register — "anglerfish": a small light drifting on its own slow path
 * through the deepest, blackest water. The lure is the SDK light-source hook
 * used exactly as designed: one LightSource riding the esca, a small radius
 * where the ramp lifts and hidden detail — the jaw, the needle teeth, the
 * marine snow, the water's own texture — resolves out of the black. Outside
 * the pool the fish is a sub-threshold silhouette (a faint dotted rim at
 * most); the deep stays black.
 *
 * One quiet idiomatic motion: the patrol drift itself (incommensurate slow
 * sines + a value-noise wander; the body turns and compresses through its
 * about-faces, the tail sways, the lure bobs, the light breathes). A diorama,
 * not a screensaver.
 *
 * The sim is STATELESS by construction: every frame is a closed-form function
 * of context.time (no accumulators), so arbitrary sleep gaps land the fish
 * exactly where it should be — scene.test.ts proves buffer equality across
 * different dt partitions.
 *
 * Copy note (binding): this scene renders no text — pure scene craft.
 *
 * Ramp intent (hand-tunable, Collin's brush), dark -> bright:
 * " ·:~≈=+*#@" — the deep lives in the first two glyphs (black + rare '·'),
 * water inside the light pool breathes on ':~≈=', the lit face lands on
 * '≈=+', teeth on '+*', the esca core on '#@'. simplifyRamp level 2 residue
 * is " ·": the compacted memory of the deep is a few dots of drifting light.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const waterNoise = createValueNoise(83);
const pathNoise = createValueNoise(29);
const pulseNoise = createValueNoise(157);

/** Deterministic integer hash -> [0, 1). Keeps teeth and snow reproducible. */
function hash(seed: number, a: number, b: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Raise a cell to at least `v` (snow, rod, bulb sit on top of the water). */
function lift(data: Float32Array, index: number, v: number): void {
  if ((data[index] ?? 0) < v) {
    data[index] = v;
  }
}

export const anglerfishScene: SceneModule = {
  dockGlyph: [
    "    ·@      ",
    "   :        ",
    "  ~≈≈≈≈~·   ",
    " #≈≈≈≈≈≈≈~· ",
    "  #~≈≈≈~·   ",
    "            ",
  ],
  id: "anglerfish",
  init(context: SceneContext): void {
    context.lights.length = 0;
    context.lights.push({
      intensity: 0.8,
      radius: 15,
      x: context.buffer.width / 2,
      y: context.buffer.height / 2,
    });
  },
  summaryChip: "The deep — something carries its own light.",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 168,
    minimalGlyph: "·",
    motion: {
      ambientAmount: 0.04,
      ambientFloor: 0.05,
      ambientScale: 0.07,
      ambientSpeed: 0.05,
      bodyInk: 1,
      driftSpanX: 0.3,
      driftSpanY: 0.2,
      driftSpeed: 0.1,
      lureBob: 0.9,
      lureBobSpeed: 0.6,
      lureIntensity: 0.8,
      lurePulse: 0.12,
      lurePulseSpeed: 1.2,
      lureRadius: 15,
      lureReach: 4.5,
      snowBrightness: 0.13,
      snowCount: 70,
      snowSpeed: 0.8,
      swaySpeed: 1.3,
      tailSway: 0.9,
    },
    ramp: " ·:~≈=+*#@",
    rows: 84,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, lights, time: t } = context;
    const {
      ambientAmount = 0.05,
      ambientFloor = 0.05,
      ambientScale = 0.07,
      ambientSpeed = 0.05,
      bodyInk = 1,
      driftSpanX = 0.3,
      driftSpanY = 0.2,
      driftSpeed = 0.1,
      lureBob = 0.9,
      lureBobSpeed = 0.6,
      lureIntensity = 0.45,
      lurePulse = 0.2,
      lurePulseSpeed = 0.5,
      lureRadius = 15,
      lureReach = 3,
      snowBrightness = 0.13,
      snowCount = 70,
      snowSpeed = 0.8,
      swaySpeed = 1.3,
      tailSway = 0.9,
    } = this.tuning.motion;
    const width = buffer.width;
    const height = buffer.height;
    const data = buffer.data;

    // 1) The deep itself: black water breathing just under the first ramp
    //    threshold. Invisible in the dark; inside the light pool this texture
    //    is the "hidden detail" that resolves out of the black.
    const drift = t * ambientSpeed;

    for (let y = 0; y < height; y++) {
      const ny = y * ambientScale * 1.6;
      const rowBase = y * width;

      for (let x = 0; x < width; x++) {
        const n = fbm2(waterNoise, x * ambientScale + drift, ny + drift * 0.35, 2);
        data[rowBase + x] = clamp01(ambientFloor + (n - 0.5) * 2 * ambientAmount);
      }
    }

    // 2) Marine snow: stateless particles falling on hashed columns. The dim
    //    ones live below the threshold and only exist inside the pool.
    const flakes = Math.max(0, Math.floor(snowCount));

    for (let i = 0; i < flakes; i++) {
      const speedMul = 0.55 + 0.9 * hash(21, i, 2);
      const sx = hash(21, i, 1) * width + 2.2 * Math.sin(t * 0.13 + i * 1.7);
      const sy = hash(21, i, 3) * height + t * snowSpeed * speedMul;
      const x = ((Math.round(sx) % width) + width) % width;
      const y = ((Math.floor(sy) % height) + height) % height;
      lift(data, y * width + x, clamp01(snowBrightness * (0.5 + hash(21, i, 4))));
    }

    // 3) The patrol drift: incommensurate slow sines + a noise wander. All
    //    closed-form in t; vx is the analytic derivative, so the fish faces
    //    its direction of travel and compresses through its turns.
    const halfL = 15;
    const bodyH = 6;
    const ax = width * driftSpanX;
    const ay = height * driftSpanY;
    const fx = width * 0.5 + ax * Math.sin(0.9 * driftSpeed * t) + (pathNoise(t * 0.02, 11.7) - 0.5) * 8;
    const fy =
      height * 0.52 +
      ay * Math.sin(0.531 * driftSpeed * t + 1.7) +
      (pathNoise(t * 0.02, 91.3) - 0.5) * 6 +
      0.9 * Math.sin(t * 0.47);
    const vx = ax * 0.9 * driftSpeed * Math.cos(0.9 * driftSpeed * t);
    const steer = Math.tanh(vx / 0.55);
    const dir = steer >= 0 ? 1 : -1;
    const squish = Math.max(0.34, Math.abs(steer));
    // Canonical fish faces LEFT (mouth at localX = -halfL); flip mirrors it
    // toward the direction of travel and squishes it through the turn.
    const flip = -dir * squish;

    // 4) The body, written as luminance the light can find. Sub-threshold
    //    fill (invisible unlit), a faint '·' rim, dark gape, needle teeth.
    const x0 = Math.max(0, Math.floor(fx - (halfL + lureReach + 4)));
    const x1 = Math.min(width - 1, Math.ceil(fx + halfL + lureReach + 4));
    const y0 = Math.max(0, Math.floor(fy - bodyH * 2.4 - 3));
    const y1 = Math.min(height - 1, Math.ceil(fy + bodyH * 1.4 + 3));

    for (let y = y0; y <= y1; y++) {
      const rowBase = y * width;

      for (let x = x0; x <= x1; x++) {
        const lx = (x - fx) / flip;
        const s = lx / halfL;

        if (s < -1 || s > 1) {
          continue;
        }

        const swayAmp = Math.max(0, s + 0.25) ** 2 / 1.56;
        const ly = y - fy - tailSway * Math.sin(swaySpeed * t - (s + 1) * 2.6) * swayAmp;
        let half: number;
        let ink: number;

        if (s <= 0.62) {
          const e = 1 - ((s + 0.16) / 1.02) ** 2;
          const taper = s <= 0 ? 1 : Math.max(0.24, 1 - s * 1.05);
          half = bodyH * Math.sqrt(Math.max(0.1, e)) * taper;
          ink = s < 0.15 ? 0.13 : 0.088;
        } else {
          half = bodyH * (0.26 + ((s - 0.62) / 0.38) * 0.5);
          ink = 0.075;
        }

        const belly = Math.abs(ly);

        if (belly > half) {
          continue;
        }

        if (half - belly < 0.95) {
          // Rim: crisp at the brow/jaw where the light lives, fading to a
          // sub-threshold dotted trace along the tail.
          ink = 0.2 - 0.09 * ((s + 1) / 2);
        }

        // The gape: carved dark, lips left standing, teeth along both edges.
        if (s < -0.35) {
          const gapeHalf = bodyH * 0.62 * Math.min(1, (-s - 0.35) / 0.65);
          const md = Math.abs(ly - 0.12 * bodyH);

          if (md < gapeHalf) {
            const tooth = hash(9, Math.round(lx), ly > 0.12 * bodyH ? 1 : 0) < 0.62;
            ink = gapeHalf - md < 0.9 && tooth ? 0.42 : 0;
          }
        }

        // The eye, above and behind the jaw.
        const dex = lx + 0.52 * halfL;
        const dey = ly + 0.3 * bodyH;

        if (dex * dex + dey * dey < 2) {
          ink = 0.24;
        }

        data[rowBase + x] = clamp01(ink * bodyInk);
      }
    }

    // 5) The illicium: a faint arc from the brow out over the dark, ending in
    //    the esca. Sub-threshold unlit; resolves near its own light.
    const bobX = 0.9 * Math.sin(t * lureBobSpeed * 0.63 + 2.1);
    const bobY = lureBob * Math.sin(t * lureBobSpeed + 0.8);
    const baseX = -0.22 * halfL;
    const baseY = -bodyH;
    const ctrlX = -1.02 * halfL;
    const ctrlY = -2.1 * bodyH;
    const tipX = -halfL - lureReach + bobX;
    const tipY = -0.5 * bodyH + bobY;

    for (let k = 1; k <= 11; k++) {
      const q = k / 12;
      const inv = 1 - q;
      const rx = inv * inv * baseX + 2 * inv * q * ctrlX + q * q * tipX;
      const ry = inv * inv * baseY + 2 * inv * q * ctrlY + q * q * tipY;
      const wx = Math.round(fx + rx * flip);
      const wy = Math.round(fy + ry);

      if (wx >= 0 && wx < width && wy >= 0 && wy < height) {
        lift(data, wy * width + wx, 0.095);
      }
    }

    // 6) The esca: a tight bright core...
    const bulbX = fx + tipX * flip;
    const bulbY = fy + tipY;
    const bulbCol = Math.round(bulbX);
    const bulbRow = Math.round(bulbY);
    const bulb: ReadonlyArray<readonly [number, number, number]> = [
      [0, 0, 0.95],
      [1, 0, 0.42],
      [-1, 0, 0.42],
      [0, 1, 0.42],
      [0, -1, 0.42],
    ];

    for (const [ox, oy, v] of bulb) {
      const wx = bulbCol + ox;
      const wy = bulbRow + oy;

      if (wx >= 0 && wx < width && wy >= 0 && wy < height) {
        lift(data, wy * width + wx, v);
      }
    }

    // 7) ...and THE light: one LightSource riding the esca, breathing slowly
    //    (a pulse, never a flicker). The runner stamps it after update.
    const light = lights[0];

    if (light) {
      const pulse = 1 + lurePulse * (0.7 * Math.sin(t * lurePulseSpeed) + 0.6 * (pulseNoise(t * 0.31, 5.5) - 0.5));
      light.x = bulbX;
      light.y = bulbY;
      light.radius = Math.max(1, lureRadius);
      light.intensity = clamp01(lureIntensity * pulse);
    }
  },
};
