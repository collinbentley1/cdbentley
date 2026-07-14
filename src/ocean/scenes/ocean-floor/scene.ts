/**
 * Scene 8 — "ocean-floor": the floor of the ocean / the shelf, at rest.
 *
 * The diorama: a dark water column breathing on the sparse end of the ramp,
 * marine snow drifting down until the sediment absorbs it, an undulating
 * seabed, and seven resting memory mounds arranged in a row along the floor —
 * the compacted story at low resolution. Contact-link placeholder bars are
 * carved into the sediment at full luminance (solid @-weight ink; values are
 * integrator-filled).
 *
 * This module owns only the shelf's RESTING presentation. Runtime docking
 * mechanics are SDK-provided (dock.ts) and the integrator wires live state,
 * including the real never-compacted contact links.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const TWO_PI = Math.PI * 2;

/** Fixed grid for this scene (mirrored in tuning.cols/rows). */
const COLS = 160;
const ROWS = 72;

/** Seabed: mean surface row and vertical relief, in cells. */
const FLOOR_BASE = 58;
const FLOOR_RELIEF = 3.5;

/** The shelf: seven resting memory slots (the seven scenes above this one). */
const SHELF_SLOTS = 7;
const SLOT_W = 12;
const SLOT_PITCH = 20;
const SLOT_X0 = 14;

const MAX_SNOW = 160;

export interface CellRect {
  readonly h: number;
  readonly w: number;
  readonly x: number;
  readonly y: number;
}

/**
 * Contact-link placeholder bars, carved into the sediment at luminance 1.0 so
 * they quantize to the heaviest ramp glyph. Link labels/targets are
 * integrator-filled; exported so the integrator and tests agree on placement.
 */
export const CONTACT_BARS: readonly CellRect[] = [
  { h: 2, w: 8, x: 8, y: 66 },
  { h: 2, w: 8, x: 20, y: 66 },
  { h: 2, w: 8, x: 32, y: 66 },
];

/** Small deterministic PRNG for seeding the marine snow (no Math.random). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const noise = createValueNoise(8);

interface FloorState {
  readonly floorY: Int16Array;
  readonly moundBase: Int16Array;
  readonly moundHeight: Float32Array;
  readonly moundWob: Float32Array;
  readonly snowBright: Float32Array;
  readonly snowPhase: Float32Array;
  readonly snowSpeed: Float32Array;
  readonly snowX: Float32Array;
  readonly snowY: Float32Array;
}

let state: FloorState | null = null;

function buildState(): FloorState {
  const floorY = new Int16Array(COLS);

  for (let x = 0; x < COLS; x++) {
    const relief = (fbm2(noise, x * 0.05, 91.7, 2) - 0.5) * 2 * FLOOR_RELIEF;
    const y = Math.round(FLOOR_BASE + relief);
    floorY[x] = y < FLOOR_BASE - 4 ? FLOOR_BASE - 4 : y > FLOOR_BASE + 4 ? FLOOR_BASE + 4 : y;
  }

  const moundBase = new Int16Array(SHELF_SLOTS);
  const moundHeight = new Float32Array(SHELF_SLOTS);
  const moundWob = new Float32Array(SHELF_SLOTS * SLOT_W);

  for (let s = 0; s < SHELF_SLOTS; s++) {
    const center = SLOT_X0 + s * SLOT_PITCH + Math.floor(SLOT_W / 2);
    moundBase[s] = floorY[Math.min(COLS - 1, center)] ?? FLOOR_BASE;
    moundHeight[s] = 4.6 + 2.4 * noise(s * 7.31 + 2.13, 47.9);

    for (let i = 0; i < SLOT_W; i++) {
      moundWob[s * SLOT_W + i] = 0.8 + 0.4 * noise(s * 5.03 + i * 0.47, 63.1);
    }
  }

  const rand = mulberry32(20260707);
  const snowBright = new Float32Array(MAX_SNOW);
  const snowPhase = new Float32Array(MAX_SNOW);
  const snowSpeed = new Float32Array(MAX_SNOW);
  const snowX = new Float32Array(MAX_SNOW);
  const snowY = new Float32Array(MAX_SNOW);

  for (let i = 0; i < MAX_SNOW; i++) {
    snowX[i] = rand() * COLS;
    snowY[i] = rand() * ROWS;
    snowSpeed[i] = 0.7 + rand() * 0.6;
    snowPhase[i] = rand() * TWO_PI;
    snowBright[i] = 0.24 + rand() * 0.14;
  }

  return { floorY, moundBase, moundHeight, moundWob, snowBright, snowPhase, snowSpeed, snowX, snowY };
}

export const scene: SceneModule = {
  dockGlyph: [
    "            ",
    " * * * * *  ",
    " ========== ",
    "            ",
    "  @@@  @@@  ",
    "~≈~~≈≈~≈~~≈~",
  ],
  id: "ocean-floor",
  init(context: SceneContext): void {
    state = buildState();
    context.lights.length = 0;
    context.lights.push({ intensity: 0.1, radius: 15, x: context.buffer.width / 2, y: 44 });
  },
  summaryChip: "TODO(collin): ocean-floor summary line",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: COLS,
    minimalGlyph: "·",
    motion: {
      driftSpeed: 0.12,
      lightDrift: 0.06,
      lightIntensity: 0.1,
      lightRadius: 15,
      moundBreath: 0.04,
      moundBreathRate: 0.09,
      moundGlow: 0.66,
      sedimentGrain: 0.12,
      snowCount: 70,
      snowFall: 2.4,
      snowSway: 0.5,
      waterGlow: 0.14,
    },
    ramp: " ·:~≈=+*#@",
    rows: ROWS,
  },
  update(dt: number, context: SceneContext): void {
    const floor = state ?? buildState();
    state = floor;
    const { buffer, lights, time } = context;
    const {
      driftSpeed = 0.12,
      lightDrift = 0.06,
      lightIntensity = 0.1,
      lightRadius = 15,
      moundBreath = 0.04,
      moundBreathRate = 0.09,
      moundGlow = 0.66,
      sedimentGrain = 0.12,
      snowCount = 70,
      snowFall = 2.4,
      snowSway = 0.5,
      waterGlow = 0.14,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;
    const floorY = floor.floorY;

    // 1) Water column (breathes on the sparse end), seabed rim, sediment.
    const tx = time * driftSpeed;

    for (let y = 0; y < h; y++) {
      const row = y * w;
      const depthGain = 0.75 + (0.35 * y) / h;

      for (let x = 0; x < w; x++) {
        const fy = floorY[x] ?? FLOOR_BASE;
        let v: number;

        if (y < fy) {
          v = fbm2(noise, x * 0.045 + tx, y * 0.075 + tx * 0.35, 2) * waterGlow * depthGain;
        } else if (y === fy) {
          v = 0.3 + 0.14 * noise(x * 0.3, 5.3 + time * 0.05);
        } else {
          const under = y - fy;
          const fade = 0.19 - under * 0.01;
          v = 0.05 + (fade > 0 ? fade : 0) + sedimentGrain * noise(x * 0.21, y * 0.4 + 173.7 + time * 0.02);
        }

        data[row + x] = v;
      }
    }

    // 2) The shelf: seven resting mounds, each breathing on its own phase.
    for (let s = 0; s < SHELF_SLOTS; s++) {
      const left = SLOT_X0 + s * SLOT_PITCH;
      const baseY = floor.moundBase[s] ?? FLOOR_BASE;
      const height = floor.moundHeight[s] ?? 5;
      const breath = moundBreath * Math.sin(TWO_PI * moundBreathRate * time + s * 1.7);

      for (let i = 0; i < SLOT_W; i++) {
        const x = left + i;

        if (x < 0 || x >= w) {
          continue;
        }

        const u = (i - 5.5) / 6.4;
        const silhouette = Math.sqrt(1 - u * u > 0 ? 1 - u * u : 0);
        const hCol = height * silhouette * (floor.moundWob[s * SLOT_W + i] ?? 1);

        if (hCol < 0.8) {
          continue;
        }

        const rise = Math.round(hCol);
        const topY = baseY - (rise > 1 ? rise : 1);

        for (let y = topY < 0 ? 0 : topY; y <= baseY && y < h; y++) {
          // Shallow shading slope: keeps the whole mound above the level-2
          // quantize threshold (0.5) so the shelf row survives bin-4 compaction
          // as a line of residue dots — the story at low resolution.
          const t01 = (y - topY) / (baseY - topY > 1 ? baseY - topY : 1);
          let v = moundGlow * (1 - 0.22 * t01) + breath;

          if (y === topY) {
            v += 0.1;
          }

          const idx = y * w + x;

          if (v > (data[idx] ?? 0)) {
            data[idx] = v;
          }
        }
      }
    }

    // 3) Marine snow: falls until the sediment takes it, then resurfaces.
    const active = Math.min(MAX_SNOW, Math.max(0, Math.floor(snowCount)));

    for (let i = 0; i < active; i++) {
      let px = floor.snowX[i] ?? 0;
      let py = floor.snowY[i] ?? 0;
      py += (floor.snowSpeed[i] ?? 1) * snowFall * dt;
      px += Math.sin(time * 0.6 + (floor.snowPhase[i] ?? 0)) * snowSway * dt;

      if (px < 0) {
        px += w;
      } else if (px >= w) {
        px -= w;
      }

      const xi = Math.min(w - 1, Math.max(0, Math.floor(px)));

      if (py >= (floorY[xi] ?? FLOOR_BASE)) {
        py = -1 - (i % 7);
        px = noise(i * 3.7, time * 0.13) * (w - 1);
      }

      floor.snowX[i] = px;
      floor.snowY[i] = py;
      const yi = Math.floor(py);

      if (yi >= 0 && yi < h) {
        const idx = yi * w + xi;
        const bright = floor.snowBright[i] ?? 0.3;

        if (bright > (data[idx] ?? 0)) {
          data[idx] = bright;
        }
      }
    }

    // 4) Contact bars: never modulated, always full ink.
    for (const bar of CONTACT_BARS) {
      for (let y = bar.y; y < bar.y + bar.h && y < h; y++) {
        const row = y * w;

        for (let x = bar.x; x < bar.x + bar.w && x < w; x++) {
          data[row + x] = 1;
        }
      }
    }

    // 5) Contract guarantee: finite luminance in [0, 1] whatever the tunables.
    for (let i = 0; i < data.length; i++) {
      const v = data[i] ?? 0;
      data[i] = Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0;
    }

    // 6) A faint beam wanders the shelf; the runner stamps it after update.
    const light = lights[0];

    if (light) {
      light.intensity = lightIntensity < 0 ? 0 : lightIntensity > 1 ? 1 : lightIntensity;
      light.radius = lightRadius > 0 ? lightRadius : 0;
      light.x = w / 2 + Math.sin(time * lightDrift * TWO_PI) * w * 0.42;
      light.y = 44 + Math.sin(time * lightDrift * TWO_PI * 0.6 + 1.3) * 4;
    }
  },
};
