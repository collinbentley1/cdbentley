/**
 * Scene 5 — "trading-floor": the exchange at night — a stock-exchange
 * TEMPLE FACADE, the NYSE archetype, drawn full-bleed in the proscenium's
 * own vocabulary.
 *
 * Silhouette before texture. Broad entry steps rise from the bottom edge
 * across the full width — wide horizontal courses, brighter toward the
 * viewer — up to a stylobate carrying a colonnade of SIX monumental
 * fluted columns (jamb grammar: '|'/'=' fills, panel-groove flutes,
 * bright bases and capitals, lit from below). Above them a full
 * entablature — architrave band, frieze, dentil course, cornice — and
 * the triangular pediment rising to the top center, its tympanum a dark
 * field with a faint geometric relief hint. Between the columns: the
 * vast dark negative space of a sleeping porch, where haze breathes.
 *
 * THE LIGHT EVENT + THE ONE MOTION: an abstract ticker band of light
 * flowing slowly right-to-left along the architrave, between the frieze
 * and the columns — not letters, a stream of varied bright tick marks
 * and short dashes ('='/'+' with occasional '#'), spacing and lengths
 * hashed on floor(position), drifting at ~6 cells/s, pure f(time). The
 * one lit strip of a sleeping temple of money.
 *
 * Nothing human-readable is rendered here; the chapter prose beside this
 * scene is DOM.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(23);

/** Deterministic integer hash -> [0, 1). Keeps the ticker reproducible. */
function hash(seed: number, a: number, b: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const TYMPANUM_LUM = 0.05; // ' ' — dark pediment field
const RELIEF_LUM = 0.17; // '·' — faint geometric relief hint in the tympanum
const RAKE_LUM = 0.62; // '=' — raking cornice of the pediment
const CORNICE_LUM = 0.64; // '=' — horizontal cornice band
const DENTIL_LUM = 0.54; // '|' — dentil blocks under the cornice
const DENTIL_GAP_LUM = 0.2; // '·' — gaps between dentils
const FRIEZE_LUM = 0.54; // '|' — frieze band (dense enough to survive bin 4)
const CHANNEL_LUM = 0.08; // ' ' — the shadowed architrave the ticker flows along
const CAP_ABACUS_LUM = 0.68; // '+' — capital abacus (top slab)
const CAP_ECHINUS_LUM = 0.58; // '=' — capital echinus
const SHAFT_LOW_LUM = 0.63; // '=' — shaft nearest the step light
const SHAFT_MID_LUM = 0.55; // '|' — shaft middle
const SHAFT_HIGH_LUM = 0.5; // '|' — shaft top, fading into the dark
const FLUTE_LOW_LUM = 0.4; // '-' — panel-groove flutes, lower
const FLUTE_HIGH_LUM = 0.34; // '-' — panel-groove flutes, upper
const ARRIS_LOW_LUM = 0.7; // '+' — column edge catching the light, lower half
const ARRIS_HIGH_LUM = 0.55; // '|' — column edge, upper half
const BASE_TOP_LUM = 0.64; // '=' — base fillet under the shaft
const BASE_TORUS_LUM = 0.72; // '+' — base torus, hottest stone
const STYLOBATE_LUM = 0.66; // '=' — platform the colonnade stands on
const STEP_MIN_LUM = 0.3; // ':' — farthest step course
const STEP_MAX_LUM = 0.68; // '+' — nearest step course (brighter toward viewer)
const STEP_RISER_DROP = 0.08; // riser sits just below its tread

interface ExchangeGeometry {
  apexRow: number;
  archBot: number;
  archTop: number;
  baseTop: number;
  capBot: number;
  capTop: number;
  /** Column center columns, left to right (six of them). */
  centers: number[];
  colW: number;
  corniceBot: number;
  corniceTop: number;
  cx: number;
  dentilRow: number;
  friezeBot: number;
  friezeTop: number;
  shaftTop: number;
  stepH: number;
  stepTop: number;
  stylBot: number;
  stylTop: number;
  tickerRow: number;
}

let base = new Float32Array(0);
let baseCols = 0;
let baseRows = 0;
let hazeLattice = new Float32Array(0);

function clamp01(v: number): number {
  if (!Number.isFinite(v)) {
    return 0;
  }

  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

/**
 * Landmarks from proportions. The facade is full-bleed: pediment rake,
 * entablature, stylobate and steps all span every column of the canvas,
 * and the entablature stack is built downward row by row so no band ever
 * gaps or overlaps on any grid size. All writes are bounds-checked, so
 * tiny harness grids simply crop the lower architecture.
 */
function geometry(cols: number, rows: number): ExchangeGeometry {
  const corniceTop = Math.max(1, Math.round(rows * 0.175));
  const corniceBot = corniceTop + Math.max(0, Math.round(rows * 0.012));
  const dentilRow = corniceBot + 1;
  const friezeTop = dentilRow + 1;
  const friezeBot = friezeTop + Math.max(0, Math.round(rows * 0.02));
  const archTop = friezeBot + 1;
  const archBot = archTop + Math.max(2, Math.round(rows * 0.04));
  const tickerRow = archTop + Math.floor((archBot - archTop) / 2);
  const capTop = archBot + 1;
  const capBot = capTop + 1;
  const shaftTop = capBot + 1;
  const stylTop = Math.max(shaftTop + 2, Math.round(rows * 0.76));
  const colW = Math.max(4, Math.round(cols * 0.07));
  const edge = Math.round(cols * 0.075);
  const centers: number[] = [];

  for (let i = 0; i < 6; i++) {
    centers.push(Math.round(edge + (i * (cols - 1 - 2 * edge)) / 5));
  }

  return {
    apexRow: Math.max(0, Math.round(rows * 0.03)),
    archBot,
    archTop,
    baseTop: stylTop - 3,
    capBot,
    capTop,
    centers,
    colW,
    corniceBot,
    corniceTop,
    cx: (cols - 1) / 2,
    dentilRow,
    friezeBot,
    friezeTop,
    shaftTop,
    stepH: Math.max(2, Math.round(rows * 0.038)),
    stepTop: stylTop + 2,
    stylBot: stylTop + 1,
    stylTop,
    tickerRow,
  };
}

/** Bounds-checked assignment (buildBase writes never wrap on small grids). */
function putSet(data: Float32Array, w: number, h: number, x: number, y: number, v: number): void {
  if (x >= 0 && x < w && y >= 0 && y < h) {
    data[y * w + x] = clamp01(v);
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

/**
 * Static architecture: pediment (raking cornice, dark tympanum, faint
 * relief), the entablature stack, six fluted columns with capitals and
 * bases, the stylobate, and the full-width entry steps brightening
 * toward the viewer. Everything but the ticker and the haze.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);
  const halfSpan = Math.max(1, (cols - 1) / 2);
  const icx = Math.round(geo.cx);

  // Pediment: raking cornice descending from the apex to the canvas
  // edges at the cornice line; the tympanum inside stays a dark field.
  const rakeSpan = Math.max(1, geo.corniceTop - geo.apexRow);

  for (let x = 0; x < cols; x++) {
    const rx = Math.abs(x - geo.cx) / halfSpan;
    const rakeY = Math.round(geo.apexRow + rx * rakeSpan);

    putSet(base, cols, rows, x, rakeY, RAKE_LUM);
    putSet(base, cols, rows, x, rakeY + 1, RAKE_LUM);

    for (let y = rakeY + 2; y < geo.corniceTop; y++) {
      putSet(base, cols, rows, x, y, TYMPANUM_LUM);
    }
  }

  // Faint geometric relief hint in the tympanum: a dim stepped motif,
  // abstract, never brighter than the '·' band.
  const midY = Math.round((geo.apexRow + geo.corniceTop) / 2);
  const reliefTiers: ReadonlyArray<{ half: number; y0: number; y1: number }> = [
    { half: Math.round(cols * 0.02), y0: midY - 2, y1: midY - 1 },
    { half: Math.round(cols * 0.045), y0: midY, y1: midY + 1 },
    { half: Math.round(cols * 0.07), y0: midY + 2, y1: midY + 2 },
  ];

  for (const tier of reliefTiers) {
    for (let y = tier.y0; y <= tier.y1; y++) {
      for (let x = icx - tier.half; x <= icx + tier.half; x++) {
        if (x >= 0 && x < cols && y >= 0 && y < rows && base[y * cols + x] === TYMPANUM_LUM) {
          base[y * cols + x] = RELIEF_LUM;
        }
      }
    }
  }

  // Entablature, full width: cornice, dentil course, frieze, architrave.
  for (let x = 0; x < cols; x++) {
    for (let y = geo.corniceTop; y <= geo.corniceBot; y++) {
      putSet(base, cols, rows, x, y, CORNICE_LUM);
    }

    putSet(base, cols, rows, x, geo.dentilRow, x % 3 === 2 ? DENTIL_GAP_LUM : DENTIL_LUM);

    for (let y = geo.friezeTop; y <= geo.friezeBot; y++) {
      putSet(base, cols, rows, x, y, FRIEZE_LUM);
    }

    for (let y = geo.archTop; y <= geo.archBot; y++) {
      putSet(base, cols, rows, x, y, CHANNEL_LUM);
    }
  }

  // Colonnade: six columns, jamb grammar — lit from below, arris edges
  // hottest low, panel-groove flutes carved down each shaft.
  const shaftBot = geo.baseTop - 1;
  const span = Math.max(1, shaftBot - geo.shaftTop);

  for (const c of geo.centers) {
    const x0 = c - Math.floor(geo.colW / 2);

    // Capital: abacus slab over an echinus, both overhanging the shaft.
    for (let x = x0 - 2; x <= x0 + geo.colW + 1; x++) {
      putSet(base, cols, rows, x, geo.capTop, CAP_ABACUS_LUM);
      putSet(base, cols, rows, x, geo.capBot, CAP_ECHINUS_LUM);
    }

    // Shaft: '='/'|' fills fading upward, '-' flutes, bright arrises.
    for (let y = geo.shaftTop; y <= shaftBot; y++) {
      const t = (y - geo.shaftTop) / span;
      const fill = t > 0.66 ? SHAFT_LOW_LUM : t > 0.33 ? SHAFT_MID_LUM : SHAFT_HIGH_LUM;
      const flute = t > 0.66 ? FLUTE_LOW_LUM : FLUTE_HIGH_LUM;
      const arris = t > 0.5 ? ARRIS_LOW_LUM : ARRIS_HIGH_LUM;

      for (let dx = 0; dx < geo.colW; dx++) {
        const edgeCol = dx === 0 || dx === geo.colW - 1;
        const groove = geo.colW >= 12 && (dx === 5 || dx === geo.colW - 6);
        putSet(base, cols, rows, x0 + dx, y, edgeCol ? arris : groove ? flute : fill);
      }
    }

    // Base: fillet then torus, spreading wider, hottest stone in the scene.
    for (let x = x0 - 1; x <= x0 + geo.colW; x++) {
      putSet(base, cols, rows, x, geo.baseTop, BASE_TOP_LUM);
    }

    for (let y = geo.baseTop + 1; y < geo.stylTop; y++) {
      for (let x = x0 - 2; x <= x0 + geo.colW + 1; x++) {
        putSet(base, cols, rows, x, y, BASE_TORUS_LUM);
      }
    }
  }

  // Stylobate: the platform, full width.
  for (let y = geo.stylTop; y <= geo.stylBot; y++) {
    for (let x = 0; x < cols; x++) {
      putSet(base, cols, rows, x, y, STYLOBATE_LUM);
    }
  }

  // Entry steps: broad full-width courses down to the bottom edge, each
  // tread a shade brighter than its riser, the whole flight brightening
  // toward the viewer — rhyming with the stage's seat rows.
  const stepCount = Math.max(1, Math.ceil((rows - geo.stepTop) / geo.stepH));

  for (let y = geo.stepTop; y < rows; y++) {
    const s = Math.floor((y - geo.stepTop) / geo.stepH);
    const frac = stepCount > 1 ? s / (stepCount - 1) : 1;
    const tread = STEP_MIN_LUM + (STEP_MAX_LUM - STEP_MIN_LUM) * frac;
    const v = (y - geo.stepTop) % geo.stepH === 0 ? tread : tread - STEP_RISER_DROP;

    for (let x = 0; x < cols; x++) {
      putSet(base, cols, rows, x, y, v);
    }
  }
}

export const tradingFloorScene: SceneModule = {
  dockGlyph: [
    "   :-==-:   ",
    "============",
    "·=+·#·==·+=·",
    "| | |  | | |",
    "| | |  | | |",
    "============",
  ],
  id: "trading-floor",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    buildBase(width, height);
    context.lights.length = 0;
  },
  summaryChip: "OTseek, 2025 — zero to one with bond traders.",
  tuning: {
    cellH: 6,
    cellW: 6,
    cols: 224,
    minimalGlyph: "·",
    motion: {
      hazeAmount: 0.08,
      hazeFloor: 0.02,
      hazeScale: 0.055,
      hazeSpeed: 0.045,
      tickerEcho: 0.25,
      tickerHotChance: 0.15,
      tickerHotLum: 0.84,
      tickerLenVar: 6,
      tickerLum: 0.6,
      tickerLumVar: 0.16,
      tickerMinLen: 2,
      tickerPeriod: 9,
      tickerSpeed: 6,
    },
    ramp: " ·:-|=+#@",
    rows: 104,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, time } = context;
    const {
      hazeAmount = 0.08,
      hazeFloor = 0.02,
      hazeScale = 0.055,
      hazeSpeed = 0.045,
      tickerEcho = 0.25,
      tickerHotChance = 0.15,
      tickerHotLum = 0.84,
      tickerLenVar = 6,
      tickerLum = 0.6,
      tickerLumVar = 0.16,
      tickerMinLen = 2,
      tickerPeriod = 9,
      tickerSpeed = 6,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if (baseCols !== w || baseRows !== h) {
      buildBase(w, h);
    }

    const geo = geometry(w, h);

    // 1) Air: haze breathes only in the porch shadow between the
    // capitals and the stylobate (night air between the columns),
    // sampled on a coarse lattice and bilinearly upsampled.
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
      const inPorch = y >= geo.shaftTop && y < geo.stylTop;

      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const b = base[i] ?? 0;

        if (!inPorch) {
          data[i] = b;
          continue;
        }

        const gx = x / stride;
        const gx0 = Math.floor(gx);
        const fx = gx - gx0;
        const top = (hazeLattice[rowA + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowA + gx0 + 1] ?? 0) * fx;
        const bottom = (hazeLattice[rowB + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowB + gx0 + 1] ?? 0) * fx;
        const air = clamp01(hazeFloor + hazeAmount * (top * (1 - fy) + bottom * fy));
        data[i] = air > b ? air : b;
      }
    }

    // 2) The ticker: the one motion and the one lit strip — an abstract
    // band of tick marks and short dashes drifting right-to-left along
    // the architrave, between the frieze and the columns. Dash lengths,
    // gaps and brightness are hashed on floor(tape position): pure
    // f(time), no letters, no flicker. A dim echo softens the channel
    // rows above and below without leaving the '·' band.
    if (geo.tickerRow < h) {
      const shift = time * tickerSpeed;
      const period = Math.max(3, Math.round(tickerPeriod));
      const rowBase = geo.tickerRow * w;

      for (let x = 0; x < w; x++) {
        const tape = Math.floor(x + shift);
        const g = Math.floor(tape / period);
        const o = tape - g * period;
        const len = Math.max(1, Math.round(tickerMinLen) + Math.floor(hash(g, 3, 11) * tickerLenVar));

        if (o < len) {
          const hot = hash(g, 7, 13) < tickerHotChance;
          const v = hot ? tickerHotLum : tickerLum + tickerLumVar * (0.6 * hash(g, 5, 17) + 0.4 * hash(g, o + 7, 29));

          data[rowBase + x] = clamp01(v);
          putMax(data, w, h, x, geo.tickerRow - 1, v * tickerEcho);
          putMax(data, w, h, x, geo.tickerRow + 1, v * tickerEcho);
        }
      }
    }
  },
};
