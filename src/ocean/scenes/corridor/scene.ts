/**
 * Scene 4 — "corridor": the Humana tower at night, with the city's heartbeat.
 *
 * A monumental postmodern skyscraper in the spirit of Michael Graves'
 * Humana Building in Louisville. A broad arcade base spans the full canvas
 * width — a colonnade of tall post-and-lintel openings under a bright
 * entablature — and out of it rises a centered shaft carrying a regular
 * bay rhythm: corner piers, mullions every bay, a brighter pier-line every
 * other bay, and three lit floor bands — storeys where the night shift is
 * still working. The corner piers run unbroken from the arcade through an
 * attic neck storey into the crown, so the wide loggia capital reads as
 * load-bearing; above it a cap slab and a small beacon. City darkness all
 * around; two low neighbor buildings sleep at the canvas edges, a couple
 * of windows lit.
 *
 * THE LIGHT EVENT + ONE MOTION: the city's heartbeat — an EKG strip of
 * light riding the horizon a third from the top, passing BEHIND the tower
 * (the shaft occludes it). A '·'-level baseline carries a repeating
 * P-QRS-T pulse train ('-'/'='/'+' strokes with a tall R spike tipped by
 * the scene's one '@'-hot cell per beat), the whole strip translating
 * slowly rightward: one beat every ~8 s.
 * Health as the pulse of a corporate city — advising the C-suite on
 * keeping it safe. The strip is a pure function of context.time (no
 * frame-to-frame randomness); a slow breathing city-glow haze confined to
 * the low sky is the allowed secondary motion.
 *
 * Nothing human-readable is rendered here; the chapter prose beside this
 * scene is DOM.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(41);

/** Deterministic per-cell white noise in [0, 1) for lit-band window variety. */
function cellHash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const SHAFT_FACE_LUM = 0.13; // '·' — the dark tower face against darker sky
const MULLION_LUM = 0.24; // ':' — vertical window-grid lines, every bay
const MAJOR_MULLION_LUM = 0.35; // '-' — brighter pier-line every other bay
const FLOOR_LINE_LUM = 0.19; // '·' — horizontal spandrel lines
const PIER_LO_LUM = 0.52; // '|' — shaft corner piers, top
const PIER_HI_LUM = 0.55; // '|' — piers at the arcade (same glyph: no seam;
// the density break lands exactly on the entablature datum below)
const LIT_BAND_LUM = 0.38; // '-' — a lit working floor
const LIT_BAND_HOT_LUM = 0.46; // '|' — the occasional brighter office
const BELT_LUM = 0.62; // '=' — belt course where the neck meets the shaft
const NECK_FACE_LUM = 0.11; // ' ' — the dark attic storey below the crown
const NECK_PIER_LUM = 0.55; // '|' — corner piers continuing through the neck
const LOGGIA_CORNICE_LUM = 0.68; // '+' — crown cornice, the architecture's peak
const LOGGIA_POST_LUM = 0.6; // '=' — loggia colonnade posts
const LOGGIA_CORNER_LUM = 0.62; // '=' — heavy crown corners over the shaft piers
const LOGGIA_VOID_LUM = 0.1; // ' ' — dark slots between the posts
const LOGGIA_SILL_LUM = 0.56; // '=' — projecting bracket underside
const CAP_LUM = 0.6; // '=' — cap slab above the loggia
const BEACON_LUM = 0.72; // '+' — the two-cell summit beacon
const LINTEL_LUM = 0.62; // '=' — arcade entablature, full canvas width
const LINTEL_EDGE_LUM = 0.66; // '=' — its top course
const ARCADE_PIER_LO_LUM = 0.5; // '|' — arcade piers under the lintel
const ARCADE_PIER_HI_LUM = 0.58; // '=' — arcade piers at street level
const ARCADE_VOID_LUM = 0.05; // ' ' — deep colonnade openings
const ARCADE_GLOW_LUM = 0.24; // ':' — lobby light pooling at the floor line
const CENTER_GLOW_LUM = 0.34; // '-' — the grand center entry glows warmer
const GROUND_LUM = 0.42; // '-' — the street line, full width
const BELOW_GROUND_LUM = 0.07; // ' ' — foreground darkness
const ROOFLINE_LUM = 0.2; // '·' — faint neighbor parapets at the edges
const NEIGHBOR_WINDOW_LUM = 0.34; // '-' — a lit window in a sleeping neighbor

/** Lit floor bands, as fractions of the shaft's height (top to street). */
const LIT_BAND_TS = [0.3, 0.52, 0.76] as const;

/**
 * The P-QRS-T complex, indexed by u = distance in columns behind the beat
 * front (u = 0 is the trailing-edge lead-out on the right; the highest u
 * is the lead-in on the left, so the complex reads P-QRS-T left to right
 * as the strip travels rightward). DY is the vertical offset in rows
 * (negative = up); LUM is the stroke luminance.
 */
const COMPLEX_DY = [0, 0, -1, -2, -3, -4, -4, -3, -2, -1, 0, 2, -14, 1, 0, 0, -1, -2, -3, -3, -2, -1, 0, 0, 0, 0, 0, 0] as const;
const COMPLEX_LUM = [0.3, 0.32, 0.42, 0.48, 0.52, 0.55, 0.52, 0.46, 0.4, 0.36, 0.4, 0.52, 0.74, 0.55, 0.4, 0.36, 0.42, 0.46, 0.5, 0.5, 0.46, 0.4, 0.32, 0.3, 0.28, 0.28, 0.28, 0.28] as const;
const COMPLEX_SPAN = COMPLEX_DY.length;
const R_INDEX = 12; // the tall spike column, tipped with a single '#' cell

interface TowerGeometry {
  arcadeTop: number;
  capHalf: number;
  crownCapTop: number;
  cx: number;
  ekgRow: number;
  groundRow: number;
  lintelRows: number;
  loggiaBot: number;
  loggiaHalf: number;
  loggiaTop: number;
  pierW: number;
  shaftL: number;
  shaftR: number;
  shaftTop: number;
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
 * Landmarks from proportions. The arcade base is full-bleed (its
 * entablature crosses every column); the shaft is centered with corner
 * piers thick enough to survive bin-4 pooling; the crown is a projecting
 * loggia met by the piers through an attic neck, a cap slab and a beacon.
 */
function geometry(cols: number, rows: number): TowerGeometry {
  const cx = Math.round(cols * 0.5);
  const shaftHalf = Math.max(3, Math.round(cols * 0.14));
  // Snap the shaft to the 4-cell pooling lattice so its corner piers (4
  // cells wide) each fill whole bin-4 columns: at deep scroll the tower
  // survives as two dotted verticals rising to the crown.
  const shaftL = 4 * Math.max(0, Math.round((cx - shaftHalf) / 4));
  const shaftW = 4 * Math.max(2, Math.round((2 * shaftHalf + 1) / 4));

  return {
    arcadeTop: Math.round(rows * 0.8),
    capHalf: Math.max(2, Math.round(shaftHalf * 0.4)),
    crownCapTop: Math.max(0, Math.round(rows * 0.05)),
    cx,
    ekgRow: Math.round(rows * 0.33),
    groundRow: Math.min(rows - 2, Math.round(rows * 0.955)),
    lintelRows: Math.max(2, Math.round(rows * 0.035)),
    loggiaBot: Math.round(rows * 0.155),
    loggiaHalf: shaftHalf + Math.max(2, Math.round(cols * 0.02)),
    loggiaTop: Math.round(rows * 0.08),
    pierW: Math.max(2, Math.round(cols * 0.018)),
    shaftL,
    shaftR: shaftL + shaftW - 1,
    shaftTop: Math.round(rows * 0.2),
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
 * Static architecture: the full-width arcade base and street line, the
 * shaft with its bay rhythm, corner piers and three lit floor bands, the
 * belt course, the attic neck the piers climb through, the projecting
 * loggia crown with heavy corners over the piers, cap slab and beacon,
 * and two sleeping neighbor buildings low at the canvas edges.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);

  // Neighbor buildings: a parapet per edge dropping a jamb at its inner
  // end onto the arcade entablature, each with two lit windows so they
  // read as low sleeping buildings, not unfinished boxes.
  const roofReach = Math.max(3, Math.round(cols * 0.11));
  const roofLY = Math.round(rows * 0.72);
  const roofRY = Math.round(rows * 0.75);

  for (let x = 0; x <= roofReach; x++) {
    putSet(base, cols, rows, x, roofLY, ROOFLINE_LUM);
    putSet(base, cols, rows, cols - 1 - x, roofRY, ROOFLINE_LUM);
  }

  for (let y = roofLY; y < geo.arcadeTop; y++) {
    putSet(base, cols, rows, roofReach, y, ROOFLINE_LUM * 0.8);
  }

  for (let y = roofRY; y < geo.arcadeTop; y++) {
    putSet(base, cols, rows, cols - 1 - roofReach, y, ROOFLINE_LUM * 0.8);
  }

  const winXs = [Math.round(roofReach * 0.25), Math.round(roofReach * 0.6)];

  for (const wx of winXs) {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        putSet(base, cols, rows, wx + dx, roofLY + 2 + dy, NEIGHBOR_WINDOW_LUM);
        putSet(base, cols, rows, cols - 1 - wx - dx, roofRY + 2 + dy, NEIGHBOR_WINDOW_LUM);
      }
    }
  }

  // The shaft: dark face carrying a regular bay rhythm — a mullion every
  // bay, a brighter pier-line every other bay — spandrel lines every
  // floor, and corner piers holding one '|' glyph band the whole way (the
  // density break lands exactly on the arcade entablature datum below).
  const shaftSpan = Math.max(1, geo.arcadeTop - geo.shaftTop);

  for (let y = geo.shaftTop; y < geo.arcadeTop; y++) {
    const t = (y - geo.shaftTop) / shaftSpan; // 0 at the belt, 1 at street
    const pier = PIER_LO_LUM + (PIER_HI_LUM - PIER_LO_LUM) * t;
    const floorLine = (y - geo.shaftTop) % 4 === 0;

    for (let x = geo.shaftL; x <= geo.shaftR; x++) {
      const dl = x - geo.shaftL;
      const dr = geo.shaftR - x;

      if (dl < geo.pierW || dr < geo.pierW) {
        putSet(base, cols, rows, x, y, pier);
        continue;
      }

      if (floorLine) {
        putSet(base, cols, rows, x, y, FLOOR_LINE_LUM);
        continue;
      }

      const d = x - geo.shaftL - geo.pierW;
      const lum = d % 8 === 0 ? MAJOR_MULLION_LUM : d % 4 === 0 ? MULLION_LUM : SHAFT_FACE_LUM;
      putSet(base, cols, rows, x, y, lum);
    }
  }

  // Three lit floor bands: whole storeys glowing '-' (with the occasional
  // '|' office, hashed deterministically per bay) — the night shift. The
  // mullions stay dark across them so the bays keep reading.
  const winL = geo.shaftL + geo.pierW;
  const winR = geo.shaftR - geo.pierW;

  for (let b = 0; b < LIT_BAND_TS.length; b++) {
    const tb = LIT_BAND_TS[b] ?? 0.5;
    const y0 = geo.shaftTop + 4 * Math.round((shaftSpan * tb) / 4) + 1;

    for (let dy = 0; dy < 3; dy++) {
      const y = y0 + dy;

      if (y <= geo.shaftTop || y >= geo.arcadeTop) {
        continue;
      }

      for (let x = winL; x <= winR; x++) {
        const d = x - winL;

        if (d % 4 === 0) {
          continue; // mullions stay dark across the band
        }

        const hot = cellHash(d >> 2, b) < 0.25;
        putSet(base, cols, rows, x, y, hot ? LIT_BAND_HOT_LUM : LIT_BAND_LUM);
      }
    }
  }

  // Belt course: a bright '=' line across the full shaft width where the
  // attic neck meets the shaft — the shoulder of the crown.
  for (let x = geo.shaftL; x <= geo.shaftR; x++) {
    putSet(base, cols, rows, x, geo.shaftTop, BELT_LUM);
  }

  // The attic neck between the belt and the loggia: full shaft width, a
  // dark windowless storey — but the corner piers keep climbing straight
  // through it to carry the crown.
  for (let y = geo.loggiaBot; y < geo.shaftTop; y++) {
    for (let x = geo.shaftL; x <= geo.shaftR; x++) {
      const dl = x - geo.shaftL;
      const dr = geo.shaftR - x;
      const pier = dl < geo.pierW || dr < geo.pierW;
      putSet(base, cols, rows, x, y, pier ? NECK_PIER_LUM : NECK_FACE_LUM);
    }
  }

  // The loggia crown: a projecting bracket wider than the shaft — a deep
  // bright cornice, a colonnade of posts over dark slots with heavy
  // corners landing on the shaft piers, a projecting sill underneath. The
  // brightest architecture in the scene.
  for (let y = geo.loggiaTop; y < geo.loggiaBot; y++) {
    const cornice = y <= geo.loggiaTop + 2;
    const sill = y === geo.loggiaBot - 1;

    for (let x = geo.cx - geo.loggiaHalf; x <= geo.cx + geo.loggiaHalf; x++) {
      if (cornice) {
        putSet(base, cols, rows, x, y, LOGGIA_CORNICE_LUM);
        continue;
      }

      if (sill) {
        putSet(base, cols, rows, x, y, LOGGIA_SILL_LUM);
        continue;
      }

      // Heavy crown corners directly over the shaft piers, so the load
      // path (and the bin-4 skeleton) runs unbroken from street to crown.
      const overPier =
        (x >= geo.shaftL && x < geo.shaftL + geo.pierW) || (x > geo.shaftR - geo.pierW && x <= geo.shaftR);

      if (overPier) {
        putSet(base, cols, rows, x, y, LOGGIA_CORNER_LUM);
        continue;
      }

      const post = ((x - geo.cx + geo.loggiaHalf) % 4) < 2;
      putSet(base, cols, rows, x, y, post ? LOGGIA_POST_LUM : LOGGIA_VOID_LUM);
    }
  }

  // Cap slab and beacon above the loggia.
  for (let y = geo.crownCapTop; y < geo.loggiaTop; y++) {
    for (let x = geo.cx - geo.capHalf; x <= geo.cx + geo.capHalf; x++) {
      putSet(base, cols, rows, x, y, CAP_LUM);
    }
  }

  putSet(base, cols, rows, geo.cx, Math.max(0, geo.crownCapTop - 1), BEACON_LUM);
  putSet(base, cols, rows, geo.cx - 1, Math.max(0, geo.crownCapTop - 1), BEACON_LUM);

  // The arcade base, full-bleed: an entablature across every column, then
  // a colonnade of piers and deep openings with lobby light pooling at the
  // floor line, a grand glowing center entry, and the street line.
  const lintelBot = geo.arcadeTop + geo.lintelRows - 1;

  for (let y = geo.arcadeTop; y <= Math.min(rows - 1, lintelBot); y++) {
    const lum = y === geo.arcadeTop ? LINTEL_EDGE_LUM : LINTEL_LUM;

    for (let x = 0; x < cols; x++) {
      putSet(base, cols, rows, x, y, lum);
    }
  }

  const pitch = Math.max(6, Math.round(cols * 0.045));
  const openW = pitch - Math.max(3, Math.round(pitch * 0.4));
  const arcadeSpan = Math.max(1, geo.groundRow - lintelBot);

  for (let y = lintelBot + 1; y < geo.groundRow; y++) {
    const t = (y - lintelBot) / arcadeSpan;

    for (let x = 0; x < cols; x++) {
      const m = (((x - geo.cx + (openW >> 1)) % pitch) + pitch) % pitch;

      if (m >= openW) {
        putSet(base, cols, rows, x, y, ARCADE_PIER_LO_LUM + (ARCADE_PIER_HI_LUM - ARCADE_PIER_LO_LUM) * t);
        continue;
      }

      // Openings: deep dark, with light pooling toward the floor line —
      // strongest in the grand center entry under the shaft.
      const center = Math.abs(x - geo.cx) <= openW;
      const glow = (center ? CENTER_GLOW_LUM : ARCADE_GLOW_LUM) * t * t;
      putSet(base, cols, rows, x, y, Math.max(ARCADE_VOID_LUM, glow));
    }
  }

  for (let x = 0; x < cols; x++) {
    putSet(base, cols, rows, x, geo.groundRow, GROUND_LUM);

    for (let y = geo.groundRow + 1; y < rows; y++) {
      putSet(base, cols, rows, x, y, BELOW_GROUND_LUM);
    }
  }
}

export const scene: SceneModule = {
  dockGlyph: [
    "    ·++·    ",
    "    |::|    ",
    "·:=#+|::|·:·",
    "    |==|    ",
    "    |::|    ",
    "=|==|==|==|=",
  ],
  id: "corridor",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    buildBase(width, height);
  },
  summaryChip: "Humana, 2020–2024 — safe rails for AI products.",
  tuning: {
    cellH: 6,
    cellW: 6,
    cols: 224,
    minimalGlyph: "·",
    motion: {
      baselineLum: 0.16,
      beatSpacing: 76,
      hazeAmount: 0.07,
      hazeFloor: 0.02,
      hazeScale: 0.05,
      hazeSpeed: 0.04,
      pulseGain: 1,
      spikeTip: 0.92,
      sweepPeriod: 24,
    },
    ramp: " ·:-|=+#@",
    rows: 104,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, time } = context;
    const {
      baselineLum = 0.16,
      beatSpacing = 76,
      hazeAmount = 0.07,
      hazeFloor = 0.02,
      hazeScale = 0.05,
      hazeSpeed = 0.04,
      pulseGain = 1,
      spikeTip = 0.92,
      sweepPeriod = 24,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if (baseCols !== w || baseRows !== h) {
      buildBase(w, h);
    }

    const geo = geometry(w, h);

    data.set(base);

    // 1) Air: a city-glow haze breathing in the low sky, between the EKG
    // line and the arcade entablature — sodium light off a sleeping city —
    // sampled on a coarse lattice and bilinearly upsampled.
    const glowRow = Math.round(h * 0.74);
    const glowSigma = Math.max(2, h * 0.07);
    const hazeTop = Math.max(0, glowRow - Math.round(3 * glowSigma));
    const hazeBot = Math.min(geo.arcadeTop - 1, glowRow + Math.round(3 * glowSigma));
    const stride = 4;
    const gw = Math.floor(w / stride) + 2;
    const gh = Math.floor((hazeBot - hazeTop) / stride) + 3;

    if (hazeLattice.length !== gw * gh) {
      hazeLattice = new Float32Array(gw * gh);
    }

    for (let gy = 0; gy < gh; gy++) {
      const ny = (hazeTop + gy * stride) * hazeScale * 1.4 + time * hazeSpeed * 0.6;

      for (let gx = 0; gx < gw; gx++) {
        hazeLattice[gy * gw + gx] = fbm2(hazeNoise, gx * stride * hazeScale + time * hazeSpeed, ny, 2);
      }
    }

    for (let y = hazeTop; y <= hazeBot; y++) {
      const dyGlow = (y - glowRow) / glowSigma;
      const envelope = Math.exp(-dyGlow * dyGlow);
      const gy = (y - hazeTop) / stride;
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
        const air = clamp01((hazeFloor + hazeAmount * (top * (1 - fy) + bottom * fy)) * envelope);
        const i = y * w + x;

        if (air > (data[i] ?? 0)) {
          data[i] = air;
        }
      }
    }

    // 2) The heartbeat: a baseline carrying a repeating P-QRS-T pulse
    // train — an EKG strip translating slowly rightward, one beat per
    // spacing — all pure f(time), all occluded by the shaft.
    const occludedL = geo.shaftL;
    const occludedR = geo.shaftR;
    const period = Math.max(4, sweepPeriod);
    const spacing = Math.max(COMPLEX_SPAN + 8, Math.round(beatSpacing));
    const speed = w / period; // columns per second
    const offset = (((time * speed) % spacing) + spacing) % spacing;

    for (let x = 0; x < w; x++) {
      if (x >= occludedL && x <= occludedR) {
        continue;
      }

      putMax(data, w, h, x, geo.ekgRow, baselineLum);
    }

    for (let front = Math.floor(offset) - spacing; front < w + COMPLEX_SPAN; front += spacing) {
      let prevY = geo.ekgRow + (COMPLEX_DY[COMPLEX_SPAN - 1] ?? 0);

      for (let u = COMPLEX_SPAN - 1; u >= 0; u--) {
        const x = front - u;
        const y = geo.ekgRow + (COMPLEX_DY[u] ?? 0);
        const lum = clamp01((COMPLEX_LUM[u] ?? 0.3) * pulseGain);

        if (x >= 0 && x < w && !(x >= occludedL && x <= occludedR)) {
          // Connect each column to its neighbor (like the stage hem) so the
          // trace never breaks into floating dashes; the R column becomes a
          // single tall bright stroke.
          for (let yy = Math.min(prevY, y); yy <= Math.max(prevY, y); yy++) {
            putMax(data, w, h, x, yy, lum);
          }

          if (u === R_INDEX) {
            putMax(data, w, h, x, y, clamp01(spikeTip * pulseGain));
          }
        }

        prevY = y;
      }
    }
  },
};
