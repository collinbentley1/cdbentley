/**
 * Scene 2 — "stage": the University Theatre at Yale, seen from the house.
 *
 * Silhouette before texture, and one light source: the ghost light. A
 * one-point view from a seat in the dark orchestra — the proscenium arch is
 * THE silhouette, two solid jambs under a full entablature framing a 34:24
 * opening (the real UT proportion), brightest near the stage floor and
 * fading upward the way a single low bulb would light it. Inside the frame:
 * a teaser curtain whose scalloped hem breathes — the ONE quiet idiomatic
 * motion — black velour legs behind a dark seam, and the ghost light: a
 * bare bulb at hip height on a thin stand, hot core, pooling on the deck
 * around its base. A lone rim-lit figure stands at the pool's edge, dimmer
 * than the bulb, lit side toward it. Below the apron an orchestra-pit gap,
 * then curved seat rows whose center aisle widens toward the viewer; one
 * lantern sconce glints on each side wall. Haze breathes only inside the
 * opening (dust in the ghost light). Steady by default — no flicker (that
 * motion belongs to the corridor scene).
 *
 * Nothing human-readable is rendered here; the chapter prose beside this
 * scene is DOM.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(19);

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const SCONCE_WASH = [0.13, 0.68, 0.16, 0.12, 0.1] as const; // '+' core, '·' wash
const CURTAIN_LUM = 0.28; // ':' — teaser body
const CURTAIN_HEM_LUM = 0.38; // '-' — teaser scalloped hem
const LEG_FOLD_LUM = 0.26; // ':' — velour leg fold (alternating with '·')
const LEG_SHADOW_LUM = 0.12; // '·' — velour leg counter-fold
const LEG_SPILL_LUM = 0.36; // '-' — ghost-light kiss on the low inner leg edge
const SEAT_FAR_LUM = 0.24; // ':' — farthest seat row
const SEAT_MID_LUM = 0.33; // '-' — middle seat row
const SEAT_NEAR_LUM = 0.4; // '-' — nearest (cropped) seat row
const SEAT_SPILL_LUM = 0.46; // '|' — spill through the opening on the front row center
const APRON_LUM = 0.5; // '|' — apron lip below the arch (thick enough to survive bin 4)
const FRAME_LOW_LUM = 0.6; // '=' — jamb bases nearest the bulb
const FRAME_MID_LUM = 0.52; // '|' — jamb middles
const FRAME_HIGH_LUM = 0.5; // '|' — jamb tops; still '|' but survives bin-4 pooling
const ENTAB_EDGE_LUM = 0.62; // '=' — cornice + architrave lines
const ENTAB_FILL_LUM = 0.52; // '|' — frieze reads as a triglyph band and survives bin 4
const ARRIS_LOW_LUM = 0.7; // '+' — inner arris catching the light, lower half
const ARRIS_HIGH_LUM = 0.5; // '|' — inner arris, upper half
const DENTIL_LUM = 0.28; // ':' — notches carved into the frieze band
const STAND_LUM = 0.5; // '|' — ghost light pole, one thin cell
const BASE_LUM = 0.55; // '=' — the stand's base plate on the deck
const BULB_RING_LUM = 0.55; // '=' pre-light; the SDK halo lifts it to '#', never '@'
const BULB_LUM = 0.95; // '@' — the bulb: the single brightest cell in the scene
const POOL_DECK_LUM = 0.5; // peak of the elliptical pool on the deck
const POOL_BOOST = 0.24; // floor line lifts '=' -> '+'/'#' around the stand
const FIGURE_BODY_LUM = 0.32; // ':' — the figure in silhouette
const FIGURE_HEAD_LUM = 0.42; // '-' — head + shoulder line
const FIGURE_RIM_LUM = 0.55; // '=' — one rim-lit edge facing the bulb

interface StageGeometry {
  apronL: number;
  apronR: number;
  apronRow: number;
  bulbRow: number;
  cx: number;
  entabL: number;
  entabR: number;
  entabTop: number;
  figureHeight: number;
  floorRow: number;
  jambW: number;
  legW: number;
  openL: number;
  openR: number;
  openTop: number;
  sconceRow: number;
  sconceInset: number;
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
 * Landmarks from proportions. The opening is ~34:24 (the University
 * Theatre's real proscenium) once cell aspect is square: width 0.42·cols,
 * height 0.65·rows on the default 176x80 grid. Vertical offsets scale with
 * rows so small harness grids stay in-bounds.
 */
function geometry(cols: number, rows: number): StageGeometry {
  const cx = Math.round(cols * 0.5);
  const halfOpen = Math.max(8, Math.round(cols * 0.21));
  const openTop = Math.round(rows * 0.15);
  const floorRow = Math.round(rows * 0.8);
  const jambW = Math.max(3, Math.round(cols * 0.04));
  const openL = cx - halfOpen;
  const openR = cx + halfOpen;

  return {
    apronL: openL - jambW + 1,
    apronR: openR + jambW - 1,
    apronRow: Math.min(rows - 1, floorRow + 1),
    bulbRow: Math.max(openTop + 1, floorRow - Math.max(3, Math.round(rows * 0.1))),
    cx,
    entabL: openL - jambW - 2,
    entabR: openR + jambW + 2,
    entabTop: Math.max(1, Math.round(rows * 0.075)),
    figureHeight: Math.max(6, Math.round(rows * 0.15)),
    floorRow,
    jambW,
    legW: Math.max(3, Math.round(cols * 0.034)),
    openL,
    openR,
    openTop,
    sconceInset: Math.max(4, Math.round(cols * 0.17)),
    sconceRow: Math.round(rows * 0.42),
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
 * Static architecture: the proscenium frame — jamb columns brightest at the
 * base and fading upward, an entablature of molding lines over a dim frieze
 * with carved dentils — one sconce per side wall, the stage floor, the
 * apron lip, and three curved seat rows behind an orchestra-pit gap, their
 * center aisle widening toward the viewer.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);

  // Entablature: bright cornice + architrave lines around a dim frieze.
  const entabBottom = geo.openTop - 1;

  for (let y = geo.entabTop; y <= entabBottom; y++) {
    const lum = y === geo.entabTop || y === entabBottom ? ENTAB_EDGE_LUM : ENTAB_FILL_LUM;

    for (let x = geo.entabL; x <= geo.entabR; x++) {
      putSet(base, cols, rows, x, y, lum);
    }
  }

  const dentilRow = entabBottom - 1;

  if (dentilRow > geo.entabTop) {
    for (let x = geo.entabL + 2; x <= geo.entabR - 2; x += 3) {
      putSet(base, cols, rows, x, dentilRow, DENTIL_LUM);
    }
  }

  // Jambs: solid columns lit from below — '=' bases, '|' fluting above —
  // with the inner arris hottest where the ghost light reaches it.
  const openSpan = Math.max(1, geo.floorRow - geo.openTop);

  for (let y = geo.openTop; y <= geo.floorRow; y++) {
    const t = (y - geo.openTop) / openSpan; // 0 at the top, 1 at the floor
    const fill = t > 0.66 ? FRAME_LOW_LUM : t > 0.33 ? FRAME_MID_LUM : FRAME_HIGH_LUM;
    const arris = t > 0.5 ? ARRIS_LOW_LUM : ARRIS_HIGH_LUM;

    for (let dx = 1; dx <= geo.jambW; dx++) {
      putSet(base, cols, rows, geo.openL - dx, y, fill);
      putSet(base, cols, rows, geo.openR + dx, y, fill);
    }

    putSet(base, cols, rows, geo.openL - 1, y, arris);
    putSet(base, cols, rows, geo.openR + 1, y, arris);
  }

  // Stage floor line across the opening; apron lip just below, a little
  // wider and thick enough that the lip survives bin-4 pooling.
  for (let x = geo.openL; x <= geo.openR; x++) {
    putSet(base, cols, rows, x, geo.floorRow, FRAME_LOW_LUM);
  }

  for (let x = geo.apronL; x <= geo.apronR; x++) {
    putSet(base, cols, rows, x, geo.apronRow, APRON_LUM);
  }

  // One lantern sconce per side wall: a '+' core in a falling '·' wash —
  // a lit fixture, not a stray dot.
  for (const sx of [geo.entabL - geo.sconceInset, geo.entabR + geo.sconceInset]) {
    for (let k = 0; k < SCONCE_WASH.length; k++) {
      putSet(base, cols, rows, sx, geo.sconceRow - 1 + k, SCONCE_WASH[k] ?? 0);
    }
  }

  // The house: an orchestra-pit gap below the apron, then three curved seat
  // rows (concave toward the stage, ends higher in frame). Seat groups grow
  // and the center aisle widens toward the viewer; the front row catches a
  // little spill through the opening.
  const seatRows: ReadonlyArray<{ aisleHalf: number; group: number; lum: number; margin: number; row: number; sag: number; tall: boolean }> = [
    { aisleHalf: 3, group: 4, lum: SEAT_FAR_LUM, margin: Math.round(cols * 0.14), row: geo.floorRow + Math.round(rows * 0.06), sag: 2, tall: false },
    { aisleHalf: 4, group: 5, lum: SEAT_MID_LUM, margin: Math.round(cols * 0.08), row: geo.floorRow + Math.round(rows * 0.11), sag: 2, tall: false },
    { aisleHalf: 6, group: 6, lum: SEAT_NEAR_LUM, margin: Math.round(cols * 0.02), row: geo.floorRow + Math.round(rows * 0.175), sag: 3, tall: true },
  ];

  for (const seat of seatRows) {
    const halfSpan = Math.max(1, geo.cx - seat.margin);

    for (let x = seat.margin; x < cols - seat.margin; x++) {
      if (Math.abs(x - geo.cx) <= seat.aisleHalf) {
        continue; // center aisle
      }

      if (x % seat.group >= seat.group - 2) {
        continue; // gap between seat backs
      }

      const u = (x - geo.cx) / halfSpan;
      const y = seat.row - Math.round(seat.sag * u * u);
      const spill = seat.tall && Math.abs(x - geo.cx) <= 20 ? SEAT_SPILL_LUM : seat.lum;

      putSet(base, cols, rows, x, y, spill);

      if (seat.tall) {
        putSet(base, cols, rows, x, y + 1, spill * 0.75);
      }
    }
  }
}

export const stageScene: SceneModule = {
  dockGlyph: [
    "============",
    "|:--------:|",
    "|:        :|",
    "|:   @    :|",
    "|:   |    :|",
    "============",
  ],
  id: "stage",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    buildBase(width, height);

    if (context.lights.length === 0) {
      const geo = geometry(width, height);
      const motion = this.tuning.motion;

      context.lights.push({
        intensity: motion.lightIntensity ?? 0.24,
        radius: motion.lightRadius ?? 4.5,
        x: Math.round(clamp01(motion.lightX ?? 0.46) * (width - 1)),
        y: geo.bulbRow,
      });
    }
  },
  summaryChip: "Yale, 2016–2019 — computer science and mainstage musicals.",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 176,
    minimalGlyph: "·",
    motion: {
      figureX: 0.55,
      gustDepth: 0.35,
      gustRate: 0.02,
      hazeAmount: 0.09,
      hazeFloor: 0.03,
      hazeScale: 0.055,
      hazeSpeed: 0.045,
      lightBreath: 0,
      lightIntensity: 0.24,
      lightRadius: 4.5,
      lightX: 0.46,
      poolHalfWidth: 12,
      swagCount: 5,
      swagDepth: 2,
      swayAmplitude: 0.9,
      swayPeriod: 11,
      valanceRows: 6,
    },
    ramp: " ·:-|=+#@",
    rows: 80,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, lights, time } = context;
    const {
      figureX = 0.55,
      gustDepth = 0.35,
      gustRate = 0.02,
      hazeAmount = 0.09,
      hazeFloor = 0.03,
      hazeScale = 0.055,
      hazeSpeed = 0.045,
      lightBreath = 0,
      lightIntensity = 0.24,
      lightRadius = 4.5,
      lightX = 0.46,
      poolHalfWidth = 12,
      swagCount = 5,
      swagDepth = 2,
      swayAmplitude = 0.9,
      swayPeriod = 11,
      valanceRows = 6,
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
    // hem(x) dips between swag pickup points; a slow gust modulates depth.
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
    // inside each arris), alternating fold/shadow columns, with a low spill
    // kiss on the inner edge where the ghost light reaches the fabric.
    for (let y = geo.openTop + 1; y < geo.floorRow; y++) {
      const lowHalf = y > geo.openTop + (geo.floorRow - geo.openTop) * 0.6;

      for (let dx = 1; dx < geo.legW; dx++) {
        const fold = dx % 2 === 0 ? LEG_FOLD_LUM : LEG_SHADOW_LUM;
        putMax(data, w, h, geo.openL + 1 + dx, y, fold);
        putMax(data, w, h, geo.openR - 1 - dx, y, fold);
      }

      const edge = lowHalf ? LEG_SPILL_LUM : LEG_FOLD_LUM;
      putMax(data, w, h, geo.openL + geo.legW, y, edge);
      putMax(data, w, h, geo.openR - geo.legW, y, edge);
    }

    // 4) The ghost light: a bare bulb at hip height — hot core, '+' ring —
    // on a single thin pole over a base plate, pooling on the deck around
    // it. The pool is the image that sells the scene; the SDK light adds
    // only a tight halo in the haze.
    const standX = Math.round(clamp01(lightX) * (w - 1));
    const poolHalf = Math.max(2, poolHalfWidth);
    const deckY = geo.floorRow - 1;

    for (let dy = -3; dy <= 0; dy++) {
      const y = deckY + dy;

      if (y <= geo.openTop) {
        continue;
      }

      for (let dx = -poolHalf; dx <= poolHalf; dx++) {
        const t = (dx / poolHalf) ** 2 + (dy / 2.5) ** 2;

        if (t >= 1) {
          continue;
        }

        putMax(data, w, h, standX + dx, y, POOL_DECK_LUM * (1 - t) ** 1.5);
      }
    }

    for (let x = geo.openL; x <= geo.openR; x++) {
      const d = (x - standX) / poolHalf;
      const boost = POOL_BOOST * Math.exp(-d * d);
      putMax(data, w, h, x, geo.floorRow, FRAME_LOW_LUM + boost);
      putMax(data, w, h, x, geo.apronRow, APRON_LUM + boost * 0.4);
    }

    for (let y = geo.bulbRow + 1; y < geo.floorRow - 1; y++) {
      putMax(data, w, h, standX, y, STAND_LUM);
    }

    for (let dx = -1; dx <= 1; dx++) {
      putMax(data, w, h, standX + dx, geo.floorRow - 1, BASE_LUM);
    }

    putMax(data, w, h, standX - 1, geo.bulbRow, BULB_RING_LUM);
    putMax(data, w, h, standX + 1, geo.bulbRow, BULB_RING_LUM);
    putMax(data, w, h, standX, geo.bulbRow - 1, BULB_RING_LUM);
    putMax(data, w, h, standX, geo.bulbRow, BULB_LUM);

    // 5) The figure: still, at the pool's edge, rim-lit by the bulb and
    // dimmer than it — one CONTIGUOUS mass (a broken silhouette reads as a
    // mic stand): 2-cell head straight into 4-cell shoulders for two rows,
    // a 3-cell torso, 2-cell legs, the edge toward the bulb one band
    // brighter. Silhouette before texture.
    const figX = Math.round(clamp01(figureX) * (w - 1));
    const figTop = Math.max(geo.openTop + 1, geo.floorRow - geo.figureHeight);
    const rimLeft = figX > standX; // which side faces the bulb

    for (let y = figTop; y < figTop + 2; y++) {
      putMax(data, w, h, figX, y, FIGURE_HEAD_LUM); // head, 2 cells wide
      putMax(data, w, h, figX + 1, y, FIGURE_HEAD_LUM);
    }

    for (let y = figTop + 2; y < figTop + 4; y++) {
      for (let dx = -1; dx <= 2; dx++) {
        putMax(data, w, h, figX + dx, y, FIGURE_HEAD_LUM); // shoulders, 4 wide
      }
    }

    const torsoL = rimLeft ? figX - 1 : figX;

    for (let y = figTop + 4; y < geo.floorRow - 4; y++) {
      for (let dx = 0; dx < 3; dx++) {
        putMax(data, w, h, torsoL + dx, y, FIGURE_BODY_LUM); // torso, 3 wide
      }

      putMax(data, w, h, rimLeft ? torsoL : torsoL + 2, y, FIGURE_RIM_LUM); // rim edge
    }

    for (let y = Math.max(figTop + 4, geo.floorRow - 4); y < geo.floorRow; y++) {
      putMax(data, w, h, figX, y, rimLeft ? FIGURE_RIM_LUM : FIGURE_BODY_LUM); // legs, 2 wide
      putMax(data, w, h, figX + 1, y, rimLeft ? FIGURE_BODY_LUM : FIGURE_RIM_LUM);
    }

    const light = lights[0];

    if (light) {
      light.x = standX;
      light.y = geo.bulbRow;
      light.radius = Math.max(0.5, lightRadius);
      light.intensity = clamp01(lightIntensity * (1 + lightBreath * Math.sin(time * 1.7)));
    }
  },
};
