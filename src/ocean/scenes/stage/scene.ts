/**
 * Scene 2 — "stage": the University Theatre at Yale, seen from the house.
 *
 * Silhouette before texture. The proscenium fills the frame edge to edge —
 * sitting close, the arch is the whole field of view — jambs with fluted
 * panels rising from bright bases into the dark, a full entablature
 * (cornice, dentil course, triglyph frieze, architrave) across the top.
 * Inside: a teaser curtain whose scalloped hem breathes — the ONE quiet
 * idiomatic motion — black velour legs behind a dark seam, and nothing
 * else: the stage stands empty, a vast dark opening over a bare floor
 * line. Below the apron an orchestra-pit gap, then four curved seat rows
 * whose center aisle widens toward the viewer. Haze breathes only inside
 * the opening (dust hanging in an empty house). Steady by default — no
 * flicker (that motion belongs to the corridor scene).
 *
 * Nothing human-readable is rendered here; the chapter prose beside this
 * scene is DOM.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(19);

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const CURTAIN_LUM = 0.28; // ':' — teaser body
const CURTAIN_HEM_LUM = 0.38; // '-' — teaser scalloped hem
const LEG_FOLD_LUM = 0.26; // ':' — velour leg fold (alternating with '·')
const LEG_SHADOW_LUM = 0.12; // '·' — velour leg counter-fold
const LEG_EDGE_LUM = 0.36; // '-' — the onstage edge of each leg
const SEAT_LUMS = [0.22, 0.28, 0.36, 0.42] as const; // back arc -> front arc
const APRON_LUM = 0.5; // '|' — apron lip below the arch (survives bin 4)
const FRAME_LOW_LUM = 0.62; // '=' — jamb bases nearest the bulb
const FRAME_MID_LUM = 0.54; // '|' — jamb middles
const FRAME_HIGH_LUM = 0.5; // '|' — jamb tops; still '|' but survives bin-4 pooling
const FLUTE_LOW_LUM = 0.38; // '-' — panel-groove columns in the jamb, lower
const FLUTE_HIGH_LUM = 0.3; // ':' — panel-groove columns, upper
const ENTAB_EDGE_LUM = 0.62; // '=' — cornice + architrave bands
const ENTAB_FILL_LUM = 0.52; // '|' — frieze reads as a triglyph band and survives bin 4
const ARRIS_LOW_LUM = 0.7; // '+' — inner arris catching the light, lower half
const ARRIS_HIGH_LUM = 0.52; // '|' — inner arris, upper half
const DENTIL_LUM = 0.52; // '|' — dentil blocks under the cornice

/** Jamb panel-groove columns, as offsets from the inner arris (dx). */
const FLUTE_DX = [5, 9] as const;
const FLUTE_MIN_JAMB = 12;

interface StageGeometry {
  apronL: number;
  apronR: number;
  apronRow: number;
  cx: number;
  entabTop: number;
  floorRow: number;
  jambW: number;
  legW: number;
  openL: number;
  openR: number;
  openTop: number;
  valanceTop: number;
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
 * Landmarks from proportions. The frame is full-bleed: the entablature
 * spans every column and the jambs rise at the canvas edges, so the arch
 * is the entire field of view. Vertical offsets scale with rows so small
 * harness grids stay in-bounds.
 */
function geometry(cols: number, rows: number): StageGeometry {
  const jambW = Math.max(4, Math.round(cols * 0.065));
  const openTop = Math.round(rows * 0.135);
  const floorRow = Math.round(rows * 0.82);

  return {
    apronL: 2,
    apronR: cols - 3,
    apronRow: Math.min(rows - 1, floorRow + 1),
    cx: Math.round(cols * 0.5),
    entabTop: Math.max(1, Math.round(rows * 0.05)),
    floorRow,
    jambW,
    legW: Math.max(3, Math.round(cols * 0.03)),
    openL: 2 + jambW,
    openR: cols - 3 - jambW,
    openTop,
    valanceTop: openTop,
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
 * Static architecture: the full-bleed proscenium frame — jamb columns
 * brightest at the base and fading upward, panel grooves fluting each
 * jamb, an entablature of cornice, dentil course, triglyph frieze and
 * architrave — the stage floor, the apron lip, and four curved seat rows
 * behind an orchestra-pit gap, their center aisle widening toward the
 * viewer.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);

  // Entablature, full width: two cornice rows, a dentil course, the
  // triglyph frieze, then two architrave rows above the opening.
  const entabBottom = geo.openTop - 1;
  const entabSpan = entabBottom - geo.entabTop;
  const dentilRow = entabSpan >= 4 ? geo.entabTop + 2 : -1;

  for (let y = geo.entabTop; y <= entabBottom; y++) {
    const edge = y <= geo.entabTop + 1 || y >= entabBottom - 1;

    for (let x = 0; x < cols; x++) {
      if (y === dentilRow) {
        putSet(base, cols, rows, x, y, x % 3 === 2 ? LEG_SHADOW_LUM : DENTIL_LUM);
        continue;
      }

      putSet(base, cols, rows, x, y, edge ? ENTAB_EDGE_LUM : ENTAB_FILL_LUM);
    }
  }

  // Jambs at the canvas edges: lit from below — '=' bases, '|' fluting
  // above — panel grooves carved down each face, the inner arris hottest
  // where the ghost light reaches it.
  const openSpan = Math.max(1, geo.floorRow - geo.openTop);

  for (let y = geo.openTop; y <= geo.floorRow; y++) {
    const t = (y - geo.openTop) / openSpan; // 0 at the top, 1 at the floor
    const fill = t > 0.66 ? FRAME_LOW_LUM : t > 0.33 ? FRAME_MID_LUM : FRAME_HIGH_LUM;
    const flute = t > 0.66 ? FLUTE_LOW_LUM : FLUTE_HIGH_LUM;
    const arris = t > 0.5 ? ARRIS_LOW_LUM : ARRIS_HIGH_LUM;

    for (let dx = 1; dx <= geo.jambW; dx++) {
      const groove = geo.jambW >= FLUTE_MIN_JAMB && FLUTE_DX.includes(dx as 5 | 9);
      putSet(base, cols, rows, geo.openL - dx, y, groove ? flute : fill);
      putSet(base, cols, rows, geo.openR + dx, y, groove ? flute : fill);
    }

    putSet(base, cols, rows, geo.openL - 1, y, arris);
    putSet(base, cols, rows, geo.openR + 1, y, arris);
  }

  // Stage floor line across the opening; apron lip just below, nearly full
  // width and thick enough that the lip survives bin-4 pooling.
  for (let x = geo.openL; x <= geo.openR; x++) {
    putSet(base, cols, rows, x, geo.floorRow, FRAME_LOW_LUM);
  }

  for (let x = geo.apronL; x <= geo.apronR; x++) {
    putSet(base, cols, rows, x, geo.apronRow, APRON_LUM);
  }

  // The house: an orchestra-pit gap below the apron, then four curved seat
  // rows (concave toward the stage, ends higher in frame). Seat groups grow
  // and the center aisle widens toward the viewer; the front row catches a
  // little spill through the opening.
  const arcs: ReadonlyArray<{ aisleHalf: number; group: number; margin: number; offset: number; sag: number }> = [
    { aisleHalf: 3, group: 4, margin: 0.16, offset: 0.048, sag: 2 },
    { aisleHalf: 4, group: 5, margin: 0.1, offset: 0.086, sag: 3 },
    { aisleHalf: 5, group: 5, margin: 0.05, offset: 0.125, sag: 3 },
    { aisleHalf: 7, group: 6, margin: 0.01, offset: 0.163, sag: 4 },
  ];

  for (let a = 0; a < arcs.length; a++) {
    const arc = arcs[a]!;
    const lum = SEAT_LUMS[a] ?? 0.3;
    const front = a === arcs.length - 1;
    const row = geo.floorRow + Math.round(rows * arc.offset);
    const margin = Math.round(cols * arc.margin);
    const halfSpan = Math.max(1, geo.cx - margin);

    for (let x = margin; x < cols - margin; x++) {
      if (Math.abs(x - geo.cx) <= arc.aisleHalf) {
        continue; // center aisle
      }

      if (x % arc.group >= arc.group - 2) {
        continue; // gap between seat backs
      }

      const u = (x - geo.cx) / halfSpan;
      const y = row - Math.round(arc.sag * u * u);

      putSet(base, cols, rows, x, y, lum);

      if (front) {
        putSet(base, cols, rows, x, y + 1, lum * 0.75);
      }
    }
  }
}

export const stageScene: SceneModule = {
  dockGlyph: [
    "============",
    "|:--------:|",
    "|:        :|",
    "|:        :|",
    "|:        :|",
    "============",
  ],
  id: "stage",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    buildBase(width, height);
  },
  summaryChip: "Yale, 2016–2019 — computer science and mainstage musicals.",
  tuning: {
    cellH: 6,
    cellW: 6,
    cols: 224,
    minimalGlyph: "·",
    motion: {
      gustDepth: 0.35,
      gustRate: 0.02,
      hazeAmount: 0.09,
      hazeFloor: 0.03,
      hazeScale: 0.055,
      hazeSpeed: 0.045,
      swagCount: 5,
      swagDepth: 3,
      swayAmplitude: 0.9,
      swayPeriod: 11,
      valanceRows: 8,
    },
    ramp: " ·:-|=+#@",
    rows: 104,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, time } = context;
    const {
      gustDepth = 0.35,
      gustRate = 0.02,
      hazeAmount = 0.09,
      hazeFloor = 0.03,
      hazeScale = 0.055,
      hazeSpeed = 0.045,
      swagCount = 5,
      swagDepth = 3,
      swayAmplitude = 0.9,
      swayPeriod = 11,
      valanceRows = 8,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if (baseCols !== w || baseRows !== h) {
      buildBase(w, h);
    }

    const geo = geometry(w, h);

    // 1) Air: haze breathes only inside the opening (dust in the ghost
    // light), sampled on a coarse lattice and bilinearly upsampled.
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
      const inRows = y > geo.openTop && y < geo.floorRow;

      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const b = base[i] ?? 0;

        if (!inRows || x <= geo.openL || x >= geo.openR) {
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

    // 2) The teaser curtain: scalloped hem breathing — one quiet motion.
    // hem(x) dips between swag pickup points; a slow gust modulates depth;
    // the whole hem breathes together (no lone center dip).
    const gust = 1 - gustDepth + gustDepth * (0.5 + 0.5 * Math.sin(Math.PI * 2 * gustRate * time));
    const breathe = swayAmplitude * gust * Math.sin((Math.PI * 2 * time) / Math.max(0.5, swayPeriod));
    const openSpan = geo.openR - geo.openL;
    let prevHem = -1;

    for (let x = geo.openL + 1; x <= geo.openR - 1; x++) {
      const u = (x - geo.openL) / openSpan;
      const scallop = 0.5 - 0.5 * Math.cos(Math.PI * 2 * Math.max(1, swagCount) * u);
      const hem = Math.min(geo.floorRow - 3, Math.round(geo.valanceTop + valanceRows + swagDepth * scallop + breathe));

      for (let y = geo.valanceTop; y < hem; y++) {
        putMax(data, w, h, x, y, CURTAIN_LUM);
      }

      // The hem stays a connected '-' curve: fill the vertical jump between
      // adjacent columns so the scallop never breaks into floating dashes.
      const from = prevHem < 0 ? hem : Math.min(prevHem + 1, hem);
      const to = prevHem < 0 ? hem : Math.max(prevHem - 1, hem);

      for (let y = Math.min(from, to); y <= Math.max(from, to); y++) {
        putMax(data, w, h, x, y, CURTAIN_HEM_LUM);
      }

      prevHem = hem;
    }

    // 3) Leg curtains: black velour behind a dark seam (one unlit column
    // inside each arris), alternating fold/shadow columns, the onstage
    // edge one step brighter so the fabric plane reads.
    for (let y = geo.openTop + 1; y < geo.floorRow; y++) {
      for (let dx = 1; dx < geo.legW; dx++) {
        const fold = dx % 2 === 0 ? LEG_FOLD_LUM : LEG_SHADOW_LUM;
        putMax(data, w, h, geo.openL + 1 + dx, y, fold);
        putMax(data, w, h, geo.openR - 1 - dx, y, fold);
      }

      putMax(data, w, h, geo.openL + geo.legW, y, LEG_EDGE_LUM);
      putMax(data, w, h, geo.openR - geo.legW, y, LEG_EDGE_LUM);
    }

  },
};
