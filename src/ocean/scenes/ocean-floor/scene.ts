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

/**
 * The two light shafts breathe on incommensurate periods (seconds) with a
 * phase offset, so one is always mid-inhale while the other exhales. Kept as
 * constants, not tunables: "never synchronized" is a law of the scene.
 */
const SHAFT_PERIOD_A = 9.5;
const SHAFT_PERIOD_B = 14.8;
const SHAFT_PHASE_B = 2.6;

/** How far (cells) each settled object's sediment skirt reaches past its edges. */
const SKIRT_REACH = 5;

/**
 * The seven settled memory-objects, in resting order along the floor. Each is a
 * verbatim copy of that scene's own shelf compaction-glyph (the dock glyph), so
 * the mounds are the docked memories themselves — half-buried, not generic
 * domes. The present (subway-platform) and the floor itself are not on the
 * floor: only what has already settled is here. Rows are top→bottom, 12 wide.
 * These drive the per-column silhouette height and the lit "@" beacon, not
 * literal text — at 8px the top profile is what reads.
 */
const SETTLED_GLYPHS: readonly (readonly string[])[] = [
  // beach — the name in the sand, waves settling
  ["·  ·   ·  · ", " C·LL·N ··  ", "·~·~·~·~·~·~", "~≈~≈≈~≈~≈≈~≈", "≈≈~≈≈≈~≈≈≈~≈", "≈≈≈≈≈≈≈≈≈≈≈≈"],
  // stage — twin rig towers
  [" |  |  |  | ", " |--|  |--| ", " |==|  |==| ", "    @   ++  ", "    +  ++++ ", "============"],
  // classroom — chalkboard block over desks
  ["#==========#", "| --- -- · |", "| -- ----  |", "#==========#", "  |·|  |·|  ", " -========- "],
  // corridor — a doorway
  ["=#==#==#==#=", "|·        ·|", "| :  ##  : |", "| :  ==  : |", "|·  ····  ·|", "-·--·--·--·-"],
  // kitchen-table — one phone face-up, glowing
  ["            ", "     ·:·    ", "    :·@·:   ", "  ========  ", "  |      |  ", "  |      |  "],
  // trading-floor — monitors and tickers
  [" 1739·317·9 ", "            ", " #9#·--·#7# ", "============", "·#79#··#31#·", "============"],
  // airport-gate — a departures board over linked seats
  [" ========== ", " =%%·---·:= ", " =%%·--··:= ", " ========== ", "  =·=·=·=·  ", "  | | | |   "],
];

const GLYPH_ROWS = 6;

interface Silhouette {
  /** Exposed height (cells above the sediment) per column, 0..GLYPH_ROWS-1. */
  readonly h: Float32Array;
  /** Column of the lit beacon (a settled "@"), or -1 if the memory has none. */
  readonly beaconCol: number;
  /** Height the beacon sits at, in cells above the sediment. */
  readonly beaconH: number;
}

/** Top profile + beacon of a settled glyph: the topmost ink in each column. */
function readSilhouette(glyph: readonly string[]): Silhouette {
  const h = new Float32Array(SLOT_W);
  let beaconCol = -1;
  let beaconH = 0;

  for (let c = 0; c < SLOT_W; c++) {
    for (let r = 0; r < GLYPH_ROWS; r++) {
      const ch = glyph[r]?.[c] ?? " ";

      if (ch !== " ") {
        h[c] = GLYPH_ROWS - 1 - r;
        break;
      }
    }

    for (let r = 0; r < GLYPH_ROWS; r++) {
      if ((glyph[r]?.[c] ?? " ") === "@") {
        beaconCol = c;
        beaconH = GLYPH_ROWS - 1 - r;
        break;
      }
    }
  }

  return { beaconCol, beaconH, h };
}

const SILHOUETTES: readonly Silhouette[] = SETTLED_GLYPHS.map(readSilhouette);

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
  summaryChip: "The floor — what stays when the rest is forgotten.",
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
      linkCarve: 0.12,
      moundBeacon: 0.26,
      moundBreath: 0.04,
      moundBreathRate: 0.09,
      moundExpose: 0.58,
      moundGlow: 0.66,
      moundSettle: 0.92,
      sedimentGrain: 0.12,
      shaftBreathe: 0.55,
      shaftCount: 2,
      shaftDrift: 0.05,
      shaftIntensity: 0.07,
      shaftWidth: 8,
      skirtGlow: 0.34,
      skirtRise: 2.8,
      snowCount: 70,
      snowFall: 2.4,
      snowSettle: 0.35,
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
      linkCarve = 0.12,
      moundBeacon = 0.26,
      moundBreath = 0.04,
      moundBreathRate = 0.09,
      moundExpose = 0.58,
      moundGlow = 0.66,
      moundSettle = 0.92,
      sedimentGrain = 0.12,
      shaftBreathe = 0.55,
      shaftCount = 2,
      shaftDrift = 0.05,
      shaftIntensity = 0.07,
      shaftWidth = 8,
      skirtGlow = 0.34,
      skirtRise = 2.8,
      snowCount = 70,
      snowFall = 2.4,
      snowSettle = 0.35,
      snowSway = 0.5,
      waterGlow = 0.14,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;
    const floorY = floor.floorY;

    // 1) Water column (breathes on the sparse end), seabed rim, sediment.
    const tx = time * driftSpeed;

    // One or two faint light shafts drift down from above. They fade in over the
    // first several rows (open water stays sparse) and dim toward the floor.
    const shafts = Math.max(0, Math.min(2, Math.round(shaftCount)));
    const shaftX0 = w * 0.34 + Math.sin(time * shaftDrift * TWO_PI) * w * 0.11;
    const shaftX1 = w * 0.66 + Math.sin(time * shaftDrift * TWO_PI * 0.73 + 2.2) * w * 0.1;
    const invShaftW2 = 1 / (shaftWidth * shaftWidth);

    // Each shaft breathes — swells and thins — on its own offset period, so
    // the two are never in phase: one arrives as the other leaves.
    const breathe = shaftBreathe < 0 ? 0 : shaftBreathe > 1 ? 1 : shaftBreathe;
    const shaftGainA = 1 - breathe * (0.5 + 0.5 * Math.sin((TWO_PI * time) / SHAFT_PERIOD_A));
    const shaftGainB = 1 - breathe * (0.5 + 0.5 * Math.sin((TWO_PI * time) / SHAFT_PERIOD_B + SHAFT_PHASE_B));

    for (let y = 0; y < h; y++) {
      const row = y * w;
      const depthGain = 0.75 + (0.35 * y) / h;

      for (let x = 0; x < w; x++) {
        const fy = floorY[x] ?? FLOOR_BASE;
        let v: number;

        if (y < fy) {
          v = fbm2(noise, x * 0.045 + tx, y * 0.075 + tx * 0.35, 2) * waterGlow * depthGain;

          if (shafts > 0) {
            const topFade = y < 10 ? y / 10 : 1;
            const floorFade = 1 - (0.5 * y) / (fy > 1 ? fy : 1);
            const d0 = x - shaftX0;
            let shaft = Math.exp(-d0 * d0 * invShaftW2) * shaftGainA;

            if (shafts > 1) {
              const d1 = x - shaftX1;
              shaft += Math.exp(-d1 * d1 * invShaftW2) * shaftGainB;
            }

            v += shaftIntensity * shaft * topFade * floorFade;
          }
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

    // 2) The shelf: seven settled memory-objects, half-buried in the sediment.
    //    Each mound wears its scene's own dock glyph: the per-column silhouette
    //    gives it a distinct top (rig towers, a doorway arch, a phone glow, a
    //    departures board) so the row reads as docked memories, not domes. A
    //    gentle sediment base under every column keeps the whole object above
    //    the level-2 quantize threshold (0.5), so the shelf row still survives
    //    bin-4 compaction as a line of residue dots — the story at low res.
    for (let s = 0; s < SHELF_SLOTS; s++) {
      const left = SLOT_X0 + s * SLOT_PITCH;
      const baseY = floor.moundBase[s] ?? FLOOR_BASE;
      const sil = SILHOUETTES[s % SILHOUETTES.length];
      const breath = moundBreath * Math.sin(TWO_PI * moundBreathRate * time + s * 1.7);

      if (!sil) {
        continue;
      }

      for (let i = 0; i < SLOT_W; i++) {
        const x = left + i;

        if (x < 0 || x >= w) {
          continue;
        }

        const wob = floor.moundWob[s * SLOT_W + i] ?? 1;
        const exposed = ((sil.h[i] ?? 0) * moundExpose + moundSettle) * wob;
        const rise = Math.round(exposed);
        const topY = baseY - (rise > 1 ? rise : 1);

        for (let y = topY < 0 ? 0 : topY; y <= baseY && y < h; y++) {
          const t01 = (y - topY) / (baseY - topY > 1 ? baseY - topY : 1);
          let v = moundGlow * (1 - 0.22 * t01) + breath;

          if (y === topY) {
            v += 0.08;
          }

          const idx = y * w + x;

          if (v > (data[idx] ?? 0)) {
            data[idx] = v;
          }
        }
      }

      // Sediment skirt: a tapered drift banked against each settled object,
      // highest where it meets the glyph and falling away over SKIRT_REACH
      // cells, so every memory sits IN the floor rather than ON it.
      for (let i = -SKIRT_REACH; i < SLOT_W + SKIRT_REACH; i++) {
        const x = left + i;

        if (x < 0 || x >= w) {
          continue;
        }

        const out = i < 0 ? -i : i >= SLOT_W ? i - SLOT_W + 1 : 0;
        const taper = 1 - out / (SKIRT_REACH + 1);
        // Convex profile: the drift banks steeply against the object, then
        // runs out in a long shallow tail, the way settled sediment actually
        // piles against an obstacle.
        const bank = taper * Math.sqrt(taper);
        const drift = 0.7 + 0.5 * noise(s * 3.17 + i * 0.61, 211.3);
        const rise = skirtRise * bank * drift;
        const rimY = floorY[x] ?? FLOOR_BASE;
        const skirtTop = Math.round(rimY - rise);

        for (let y = skirtTop < 0 ? 0 : skirtTop; y <= rimY && y < h; y++) {
          const t01 = (y - skirtTop) / (rimY - skirtTop > 1 ? rimY - skirtTop : 1);
          const v = skirtGlow * (0.55 + 0.45 * t01) * (0.75 + 0.25 * taper);
          const idx = y * w + x;

          if (v > (data[idx] ?? 0)) {
            data[idx] = v;
          }
        }
      }

      // The lit memory: a single settled "@" beacon (only a couple of scenes
      // carry one — a phone face-up, a spot on the rig). One bright core, a
      // one-cell halo, in the register of the deep's lure.
      if (sil.beaconCol >= 0) {
        const bx = left + sil.beaconCol;
        const brise = Math.round(sil.beaconH * moundExpose + moundSettle);
        const by = baseY - (brise > 1 ? brise : 1);

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const px = bx + dx;
            const py = by + dy;

            if (px < 0 || px >= w || py < 0 || py >= h) {
              continue;
            }

            const core = dx === 0 && dy === 0;
            const v = moundGlow + moundBeacon * (core ? 1 : 0.32) + breath;
            const idx = py * w + px;

            if (v > (data[idx] ?? 0)) {
              data[idx] = v;
            }
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
        // Snow thins toward the floor: at this depth most of it has already
        // settled, so flakes fade out over the last stretch of their fall.
        const fy = floorY[xi] ?? FLOOR_BASE;
        const settleBand = fy * (snowSettle < 0 ? 0 : snowSettle > 1 ? 1 : snowSettle);
        const remain = fy - py;
        const settle = settleBand > 0 && remain < settleBand ? (remain > 0 ? remain / settleBand : 0) : 1;
        const bright = (floor.snowBright[i] ?? 0.3) * (0.3 + 0.7 * settle);

        if (bright > (data[idx] ?? 0)) {
          data[idx] = bright;
        }
      }
    }

    // 4) Contact bars: never modulated, always full ink. Each bar is carved
    //    INTO the sediment: a one-cell recess around it drops the surround one
    //    ramp step, so the page's final action takes its quiet emphasis from
    //    contrast, not added brightness.
    for (const bar of CONTACT_BARS) {
      for (let y = bar.y - 1; y <= bar.y + bar.h && y < h; y++) {
        if (y < 0) {
          continue;
        }

        const row = y * w;

        for (let x = bar.x - 1; x <= bar.x + bar.w && x < w; x++) {
          if (x < 0) {
            continue;
          }

          const inside = x >= bar.x && x < bar.x + bar.w && y >= bar.y && y < bar.y + bar.h;

          if (inside) {
            data[row + x] = 1;
          } else if ((data[row + x] ?? 0) > linkCarve) {
            data[row + x] = linkCarve;
          }
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
