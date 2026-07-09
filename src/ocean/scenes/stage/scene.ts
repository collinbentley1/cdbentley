/**
 * Scene 2 — "stage": a stage after the audience leaves.
 *
 * Rigging lines over an empty house. The fly system sways — the ONE quiet
 * idiomatic motion: each lineset (pick lines + batten, one carrying a border
 * curtain) is a slow rigid pendulum from the loft, periods scaled by line
 * length, amplitudes modulated by a slower "air current" so nothing loops
 * visibly. Everything else stands still: the grid iron, the stage floor, the
 * apron edge, rows of empty seats receding into the dark. A ghost light
 * (one SDK light source on a stand, downstage) lifts the ramp out of the
 * black around it; low haze breathes on the sparse end of the ramp
 * (water-adjacent breath per the brief). Steady by default — no flicker
 * (that motion belongs to the corridor scene).
 *
 * Claim-slot notes for the Phase C integrator (nothing rendered here):
 * the slot beside this scene carries Yale material using FACTS.md R9 and C4
 * phrasing only (President 2017 per C3); receipt rail: yale.edu packets swim
 * in from the LEFT edge. All human-readable copy in this scene is a
 * TODO(collin) placeholder.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hashNoise = createValueNoise(83);
const hazeNoise = createValueNoise(19);
const seatNoise = createValueNoise(47);

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const LOFT_LUM = 0.3; // ':' — grid iron line across the top
const PULLEY_LUM = 0.68; // '+' — loft blocks the pick lines hang from
const LINE_LUM = 0.52; // '|' — pick lines (anti-aliased when swaying)
const BATTEN_LUM = 0.6; // '=' — the pipes
const CURTAIN_LUM = 0.25; // ':' base, '·'..':' folds
const STAND_LUM = 0.68; // '+' — ghost light stand
const BULB_LUM = 0.93; // '@' — the bulb itself
const FLOOR_LUM = 0.16; // '·' — stage floor
const APRON_LUM = 0.27; // ':' — downstage edge

interface StageGeometry {
  apronRow: number;
  battenMax: number;
  battenMin: number;
  bulbRow: number;
  floorTop: number;
  houseTop: number;
}

interface Lineset {
  battenRow: number;
  curtainRows: number;
  cx: number;
  gustPhase: number;
  halfW: number;
  period: number;
  phase: number;
  picks: readonly number[];
}

let base = new Float32Array(0);
let baseCols = 0;
let baseRows = 0;
let hazeLattice = new Float32Array(0);

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

/** Decorrelated deterministic [0,1] hash for lineset layout. */
function hash(i: number, k: number): number {
  return hashNoise(i * 37.91 + 11.33, k * 17.71 + 5.17);
}

function geometry(rows: number): StageGeometry {
  const floorTop = Math.floor(rows * 0.62);

  return {
    apronRow: floorTop + 3,
    battenMax: Math.max(10, floorTop - 11),
    battenMin: Math.max(6, Math.floor(rows * 0.12)),
    bulbRow: floorTop - 5,
    floorTop,
    houseTop: Math.floor(rows * 0.72),
  };
}

/** Static architecture: loft line, stage floor, apron edge, empty house. */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(rows);

  for (let x = 0; x < cols; x++) {
    base[x] = LOFT_LUM;
  }

  for (let y = geo.floorTop; y <= Math.min(rows - 1, geo.floorTop + 2); y++) {
    for (let x = 0; x < cols; x++) {
      base[y * cols + x] = FLOOR_LUM;
    }
  }

  if (geo.apronRow < rows) {
    for (let x = 2; x < cols - 2; x++) {
      base[geo.apronRow * cols + x] = APRON_LUM;
    }
  }

  const aisleA = Math.round(cols * 0.3);
  const aisleB = Math.round(cols * 0.7);

  for (let r = geo.houseTop + 2; r < rows - 1; r += 3) {
    const t = (r - geo.houseTop) / Math.max(1, rows - geo.houseTop);
    const rowLum = 0.19 + 0.12 * t;
    const margin = Math.round(4 + (1 - t) * 10);

    for (let x = margin; x < cols - margin; x++) {
      if (Math.abs(x - aisleA) <= 1 || Math.abs(x - aisleB) <= 1) {
        continue; // aisles
      }

      if (x % 3 === 2) {
        continue; // gap between seat backs
      }

      const jitter = (seatNoise(x * 13.7, r * 7.3) - 0.5) * 0.05;
      base[r * cols + x] = Math.min(0.32, Math.max(0.13, rowLum + jitter));
    }
  }
}

/** Max-write with bounds check. */
function putMax(data: Float32Array, w: number, h: number, x: number, y: number, v: number): void {
  if (x < 0 || x >= w || y < 0 || y >= h) {
    return;
  }

  const i = y * w + x;

  if ((data[i] ?? 0) < v) {
    data[i] = clamp01(v);
  }
}

/** Energy-preserving additive splat capped at `cap` (horizontal runs). */
function splatAdd(data: Float32Array, w: number, h: number, x: number, y: number, v: number, cap: number): void {
  const x0 = Math.floor(x);
  const f = x - x0;

  addCapped(data, w, h, x0, y, v * (1 - f), cap);
  addCapped(data, w, h, x0 + 1, y, v * f, cap);
}

function addCapped(data: Float32Array, w: number, h: number, x: number, y: number, v: number, cap: number): void {
  if (x < 0 || x >= w || y < 0 || y >= h) {
    return;
  }

  const i = y * w + x;
  const current = data[i] ?? 0;
  data[i] = clamp01(Math.max(current, Math.min(cap, current + v)));
}

function buildLinesets(cols: number, rows: number, count: number, swayPeriod: number): Lineset[] {
  const geo = geometry(rows);
  const n = Math.max(0, Math.min(12, Math.floor(count)));
  const margin = Math.max(6, Math.round(cols * 0.07));
  const usable = cols - margin * 2;
  const linesets: Lineset[] = [];

  for (let i = 0; i < n; i++) {
    const slot = usable / n;
    const cx = margin + slot * (i + 0.5) + (hash(i, 1) - 0.5) * slot * 0.4;
    const halfW = Math.min(Math.round(5 + hash(i, 2) * 5), Math.max(4, Math.floor(slot * 0.45)));
    const depthFrac = (i * 0.618034 + hash(i, 3) * 0.2) % 1;
    const battenRow = Math.round(geo.battenMin + (geo.battenMax - geo.battenMin) * depthFrac);
    const length = Math.max(1, battenRow - 1);
    const lengthMax = Math.max(1, geo.battenMax - 1);
    const period = Math.max(0.5, swayPeriod) * Math.max(0.35, Math.sqrt(length / lengthMax));
    const picks = halfW >= 9 ? [-halfW, 0, halfW] : [-halfW, halfW];

    linesets.push({
      battenRow,
      curtainRows: i === 0 ? 5 : 0,
      cx,
      gustPhase: hash(i, 5) * Math.PI * 2,
      halfW,
      period,
      phase: hash(i, 4) * Math.PI * 2,
      picks,
    });
  }

  return linesets;
}

export const stageScene: SceneModule = {
  dockGlyph: [
    " |  |  |  | ",
    " |  |  |  | ",
    " |==|  |==| ",
    "     @      ",
    "-----+------",
    "  ·:·:·:·:  ",
  ],
  id: "stage",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    buildBase(width, height);

    if (context.lights.length === 0) {
      const geo = geometry(height);

      context.lights.push({
        intensity: 0.5,
        radius: 11,
        x: Math.round(0.46 * width),
        y: geo.bulbRow,
      });
    }
  },
  summaryChip: "TODO(collin): stage summary — Yale material per FACTS R9 + C4 (President 2017 per C3)",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 176,
    minimalGlyph: "·",
    motion: {
      gustDepth: 0.4,
      gustRate: 0.02,
      hazeAmount: 0.09,
      hazeFloor: 0.04,
      hazeScale: 0.055,
      hazeSpeed: 0.045,
      lightBreath: 0,
      lightIntensity: 0.5,
      lightRadius: 11,
      lightX: 0.46,
      lineSets: 5,
      swayAmplitude: 2.2,
      swayPeriod: 9,
    },
    ramp: " ·:-|=+#@",
    rows: 80,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, lights, time } = context;
    const {
      gustDepth = 0.4,
      gustRate = 0.02,
      hazeAmount = 0.09,
      hazeFloor = 0.04,
      hazeScale = 0.055,
      hazeSpeed = 0.045,
      lightBreath = 0,
      lightIntensity = 0.5,
      lightRadius = 11,
      lightX = 0.46,
      lineSets = 5,
      swayAmplitude = 2.2,
      swayPeriod = 9,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if (baseCols !== w || baseRows !== h) {
      buildBase(w, h);
    }

    // 1) Air: low haze breathing on the sparse end of the ramp, sampled on a
    // coarse lattice and bilinearly upsampled (value noise is smooth anyway).
    const stride = 4;
    const gw = Math.floor(w / stride) + 2;
    const gh = Math.floor(h / stride) + 2;

    if (hazeLattice.length !== gw * gh) {
      hazeLattice = new Float32Array(gw * gh);
    }

    for (let gy = 0; gy < gh; gy++) {
      const ny = gy * stride * hazeScale * 1.4 + time * hazeSpeed * 0.6;

      for (let gx = 0; gx < gw; gx++) {
        hazeLattice[gy * gw + gx] = fbm2(hazeNoise, gx * stride * hazeScale + time * hazeSpeed, ny, 2);
      }
    }

    for (let y = 0; y < h; y++) {
      const gy = y / stride;
      const gy0 = Math.floor(gy);
      const fy = gy - gy0;
      const rowA = gy0 * gw;
      const rowB = (gy0 + 1) * gw;

      for (let x = 0; x < w; x++) {
        const gx = x / stride;
        const gx0 = Math.floor(gx);
        const fx = gx - gx0;
        const top = (hazeLattice[rowA + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowA + gx0 + 1] ?? 0) * fx;
        const bottom = (hazeLattice[rowB + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowB + gx0 + 1] ?? 0) * fx;
        const air = clamp01(hazeFloor + hazeAmount * (top * (1 - fy) + bottom * fy));
        const i = y * w + x;
        const b = base[i] ?? 0;
        data[i] = air > b ? air : b;
      }
    }

    // 2) The fly system: rigid pendulums from the loft, one quiet motion.
    const linesets = buildLinesets(w, h, lineSets, swayPeriod);
    const geo = geometry(h);

    for (const set of linesets) {
      const gust = 1 - gustDepth + gustDepth * (0.5 + 0.5 * Math.sin(Math.PI * 2 * gustRate * time + set.gustPhase));
      const sway = swayAmplitude * gust * Math.sin((Math.PI * 2 * time) / set.period + set.phase);
      const length = Math.max(1, set.battenRow - 1);

      for (const pick of set.picks) {
        putMax(data, w, h, Math.round(set.cx + pick), 1, PULLEY_LUM);

        for (let y = 2; y <= set.battenRow; y++) {
          const depthFrac = (y - 1) / length;

          // Rounded to whole cells on purpose: a swaying line stays a crisp
          // '|' staircase instead of anti-aliasing into dim doubled dots.
          putMax(data, w, h, Math.round(set.cx + pick + sway * depthFrac), y, LINE_LUM);
        }
      }

      for (let dx = -set.halfW; dx <= set.halfW; dx++) {
        splatAdd(data, w, h, set.cx + dx + sway, set.battenRow, BATTEN_LUM, BATTEN_LUM);
      }

      for (let cy = 1; cy <= set.curtainRows; cy++) {
        const y = set.battenRow + cy;

        if (y >= geo.floorTop - 2) {
          break;
        }

        for (let dx = -set.halfW + 1; dx <= set.halfW - 1; dx++) {
          const fold = CURTAIN_LUM + 0.05 * Math.sin(dx * 0.9);
          putMax(data, w, h, Math.round(set.cx + dx + sway), y, fold);
        }
      }
    }

    // 3) The ghost light: stand, bulb, and the SDK light source that lifts
    // the ramp out of the black (stamped by the runner after update).
    const standX = Math.round(clamp01(lightX) * (w - 1));

    for (let y = geo.bulbRow + 1; y <= Math.min(h - 1, geo.floorTop); y++) {
      putMax(data, w, h, standX, y, STAND_LUM);
    }

    putMax(data, w, h, standX - 1, geo.floorTop, 0.5);
    putMax(data, w, h, standX + 1, geo.floorTop, 0.5);
    putMax(data, w, h, standX, geo.bulbRow, BULB_LUM);

    const light = lights[0];

    if (light) {
      light.x = standX;
      light.y = geo.bulbRow;
      light.radius = Math.max(0.5, lightRadius);
      light.intensity = clamp01(lightIntensity * (1 + lightBreath * Math.sin(time * 1.7)));
    }
  },
};
