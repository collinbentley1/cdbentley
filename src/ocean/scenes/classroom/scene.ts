/**
 * Scene 3 — "classroom": the learning hall (AndKids, Beijing).
 *
 * Not a classroom at all: a great hall of books. The architecture is a
 * full-bleed floor-to-ceiling shelf wall framed like a proscenium — two
 * massive jambs at the canvas edges, a heavy cornice crowning the wall, a
 * colonnade of thick bay uprights, and a solid gallery band dividing the
 * bright eye-level courses from the dark attic rows. Books are short
 * vertical strokes of varied height and band; the four lowest courses sit
 * on continuous bright shelf rules, densest at eye level, thinning and
 * dimming toward the attic so the wall has tonal hierarchy instead of
 * wallpaper. Below, the polished floor recedes: a dense baseline shadow,
 * perspective seams spreading from the bay rhythm, and a dot gradient
 * fading with distance. THE centerpiece and the ONE motion: a Sphero — a
 * compact max-density pearl — glides slowly across the floor on a
 * figure-eight, towing a comet trail that ramps up toward it, drawn
 * parametrically from context.time so the scene is pure and flicker-free.
 * A slow breathing haze confined to the floor air is the only secondary.
 *
 * Nothing human-readable is rendered here; the book spines are abstract
 * strokes. The chapter prose beside this scene is DOM.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(23);

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const CORNICE_EDGE_LUM = 0.74; // '+' — cornice crown and base courses
const CORNICE_FILL_LUM = 0.6; // '=' — cornice body row
const DENTIL_LUM = 0.56; // '|' — dentil blocks inside the cornice
const DENTIL_GAP_LUM = 0.16; // '·' — gaps between dentils
const JAMB_LOW_LUM = 0.76; // '+' — proscenium jambs nearest the floor
const JAMB_HIGH_LUM = 0.72; // '+' — proscenium jambs, upper
const JAMB_GROOVE_LUM = 0.4; // '-' — grooves carved down each jamb face
const UPRIGHT_LOW_LUM = 0.72; // '+' — colonnade bay uprights, lower
const UPRIGHT_HIGH_LUM = 0.7; // '+' — colonnade bay uprights, upper
const GALLERY_LUM = 0.7; // '+' — the solid mid-wall gallery band
const RULE_EYE_LUM = 0.72; // '+' — continuous rules under the low courses
const RULE_EYE_UNDER_LUM = 0.54; // '|' — their under-edge shadow row
const RULE_MID_LUM = 0.62; // '=' — mid-wall course rules
const RULE_ATTIC_LUM = 0.5; // '|' — attic course rules
const FLOOR_LUM = 0.72; // '+' — the baseline shadow row, full width
const FLOOR_UNDER_LUM = 0.5; // '|' — its under-edge
const PLINTH_LUM = 0.56; // '|' — closed cabinet course under the shelves
const PLINTH_RAIL_LUM = 0.62; // '=' — its kick rail nearest the floor
const PLINTH_SEAM_LUM = 0.22; // ':' — cabinet door seams
const BOOK_LUMS = [0.34, 0.44, 0.56, 0.66] as const; // ':' '-' '|' '=' spines
const SEAM_LUM = 0.26; // ':' — perspective floor seams at the baseline
const SEAM_SPREAD = 0.02; // how fast seams fan outward per row of depth
const BOARD_LUM = 0.24; // ':' — floorboard joints nearest the baseline
const DOT_DENSITY = 0.07; // sparse floor grain density at the baseline
const DOT_LUM_LO = 0.12; // '·' — floor grain at the far fade
const DOT_LUM_HI = 0.2; // '·' — floor grain nearest the baseline

/** Course tier thresholds on t = (shelfY - shelfTop) / wallSpan. */
const EYE_T = 0.55; // at/below: bright eye-level courses on solid rules
const MID_T = 0.38; // between: mid courses; above: dim attic courses
const EYE_GAIN = 0.92;
const MID_GAIN = 0.75;
const ATTIC_GAIN = 0.55;
const EYE_GAP = 0.14;
const MID_GAP = 0.2;
const ATTIC_GAP = 0.3;

/** Books must clear the cornice by this many rows to hang a shelf course. */
const SHELF_HEADROOM = 5;

interface HallGeometry {
  bayW: number;
  cornBot: number;
  cornTop: number;
  cx: number;
  floorRow: number;
  galleryY: number;
  innerL: number;
  innerR: number;
  jambW: number;
  shelfPitch: number;
  shelfTop: number;
  uprightW: number;
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

/** Deterministic hash -> [0,1), used to cut the wall into individual books. */
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;

  return s - Math.floor(s);
}

/**
 * Landmarks from proportions. The wall is full-bleed: the cornice spans
 * every column, the massive jambs rise at the canvas edges, and the floor
 * line crosses the entire width. The gallery band is the shelf course
 * nearest the wall's vertical midpoint. Vertical offsets scale with rows
 * so small harness grids stay in-bounds.
 */
function geometry(cols: number, rows: number): HallGeometry {
  const jambW = Math.max(4, Math.round(cols * 0.08));
  const cornTop = Math.max(1, Math.round(rows * 0.04));
  const cornBot = cornTop + 3;
  const shelfTop = cornBot + 1;
  const floorRow = Math.round(rows * 0.66);
  const shelfPitch = Math.max(4, Math.round(rows * 0.058));
  const wallSpan = Math.max(1, floorRow - shelfTop);
  let galleryY = -1;
  let galleryDist = Infinity;

  for (let y = floorRow - shelfPitch; y >= cornBot + SHELF_HEADROOM; y -= shelfPitch) {
    const d = Math.abs((y - shelfTop) / wallSpan - 0.5);

    if (d < galleryDist) {
      galleryDist = d;
      galleryY = y;
    }
  }

  return {
    bayW: Math.max(7, Math.round(cols * 0.088)),
    cornBot,
    cornTop,
    cx: Math.round(cols * 0.5),
    floorRow,
    galleryY,
    innerL: jambW,
    innerR: cols - 1 - jambW,
    jambW,
    shelfPitch,
    shelfTop,
    uprightW: Math.max(2, Math.round(cols * 0.022)),
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
 * Static architecture: the heavy cornice crowning every column, tiered
 * shelf courses (bright continuous rules and packed spines at eye level,
 * dimmer and airier toward the attic), the solid mid-wall gallery band,
 * the plinth cabinets, the thick bay-upright colonnade, the massive edge
 * jambs, and the receding floor — baseline shadow, perspective seams,
 * dot gradient. Everything here survives as the wall's skeleton at bin-4
 * pooling: jambs, uprights, cornice, gallery, and plinth all pool >= 0.5.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);
  const wallSpan = Math.max(1, geo.floorRow - geo.shelfTop);

  // Cornice, full width: '+' crown and base courses around a body row and
  // a dentil row — four rows deep, dense enough to pool solid at bin 4.
  for (let y = geo.cornTop; y <= geo.cornBot; y++) {
    const dentil = y === geo.cornTop + 2;
    const edge = y === geo.cornTop || y === geo.cornBot;

    for (let x = 0; x < cols; x++) {
      if (dentil) {
        putSet(base, cols, rows, x, y, x % 3 === 2 ? DENTIL_GAP_LUM : DENTIL_LUM);
        continue;
      }

      putSet(base, cols, rows, x, y, edge ? CORNICE_EDGE_LUM : CORNICE_FILL_LUM);
    }
  }

  // Shelf courses and their books, in three tiers. Eye-level courses (the
  // lowest four) sit on continuous '+' rules with an under-edge shadow so
  // books visibly stand on shelves; mid courses on '=' rules; attic
  // courses on thin '|' rules with airier, dimmer spines — the tonal
  // hierarchy that keeps the wall from reading as wallpaper.
  for (let shelfY = geo.floorRow - geo.shelfPitch; shelfY >= geo.cornBot + SHELF_HEADROOM; shelfY -= geo.shelfPitch) {
    const t = (shelfY - geo.shelfTop) / wallSpan; // 0 top of wall, 1 floor
    const eye = t >= EYE_T;
    const mid = !eye && t >= MID_T;
    const gain = eye ? EYE_GAIN : mid ? MID_GAIN : ATTIC_GAIN;
    const gapChance = eye ? EYE_GAP : mid ? MID_GAP : ATTIC_GAP;
    const minHeight = 2;
    const ruleLum = eye ? RULE_EYE_LUM : mid ? RULE_MID_LUM : RULE_ATTIC_LUM;

    for (let x = geo.innerL; x <= geo.innerR; x++) {
      putSet(base, cols, rows, x, shelfY, ruleLum);

      if (eye) {
        putSet(base, cols, rows, x, shelfY + 1, RULE_EYE_UNDER_LUM);
      }
    }

    if (shelfY === geo.galleryY) {
      continue; // the gallery band replaces this course's books
    }

    for (let x = geo.innerL + 1; x <= geo.innerR - 1; x++) {
      if (hash01(shelfY * 91.7 + x * 3.7) < gapChance) {
        continue; // a pulled book — slot gap
      }

      const run = Math.floor(x / 3); // heights change in short runs
      const height = minHeight + Math.floor(hash01(shelfY * 57.3 + run * 7.1) * (5 - minHeight));
      const pick = hash01(shelfY * 13.9 + x * 1.31);
      const lum = (pick < 0.3 ? BOOK_LUMS[0] : pick < 0.6 ? BOOK_LUMS[1] : pick < 0.85 ? BOOK_LUMS[2] : BOOK_LUMS[3]) * gain;

      for (let dy = 1; dy <= height; dy++) {
        putSet(base, cols, rows, x, shelfY - dy, lum);
      }
    }
  }

  // The gallery band: a solid three-row '+' course at the wall's vertical
  // midpoint — the horizontal rail that (with cornice and plinth) frames
  // the colonnade in the bin-4 skeleton and gives the eye a place to land.
  if (geo.galleryY > 0) {
    for (let y = geo.galleryY - 2; y <= geo.galleryY; y++) {
      for (let x = geo.innerL; x <= geo.innerR; x++) {
        putSet(base, cols, rows, x, y, GALLERY_LUM);
      }
    }
  }

  // Plinth: a closed cabinet course between the lowest shelf and the
  // floor — seamed doors, a brighter kick rail — a solid base that both
  // grounds the wall and survives bin-4 pooling as a full-width band.
  const seamOffset = Math.floor(geo.bayW / 2);

  for (let y = geo.floorRow - geo.shelfPitch + 1; y < geo.floorRow; y++) {
    const rail = y === geo.floorRow - 1;

    for (let x = geo.innerL; x <= geo.innerR; x++) {
      const seamed = !rail && (x - geo.innerL) % geo.bayW === seamOffset;
      putSet(base, cols, rows, x, y, seamed ? PLINTH_SEAM_LUM : rail ? PLINTH_RAIL_LUM : PLINTH_LUM);
    }
  }

  // The colonnade: thick bay uprights on a steady rhythm, '+' the whole
  // way down (five cells wide at the tuned grid so any 4-cell pooling
  // window catches at least three cells — the columns survive bin 4).
  for (let x = geo.innerL + geo.bayW; x <= geo.innerR - geo.uprightW - 1; x += geo.bayW) {
    for (let y = geo.shelfTop; y < geo.floorRow; y++) {
      const t = (y - geo.shelfTop) / wallSpan;
      const lum = t > 0.5 ? UPRIGHT_LOW_LUM : UPRIGHT_HIGH_LUM;

      for (let dx = 0; dx < geo.uprightW; dx++) {
        putSet(base, cols, rows, x + dx, y, lum);
      }
    }
  }

  // Massive proscenium jambs at the canvas edges: solid '+' masonry, two
  // grooves carved down each face, slightly hotter toward the floor.
  for (let y = geo.shelfTop; y <= geo.floorRow; y++) {
    const t = (y - geo.shelfTop) / wallSpan;
    const fill = t > 0.6 ? JAMB_LOW_LUM : JAMB_HIGH_LUM;

    for (let dx = 0; dx < geo.jambW; dx++) {
      const carved = (geo.jambW >= 12 && dx === 5) || (geo.jambW >= 16 && dx === 11);
      putSet(base, cols, rows, dx, y, carved ? JAMB_GROOVE_LUM : fill);
      putSet(base, cols, rows, cols - 1 - dx, y, carved ? JAMB_GROOVE_LUM : fill);
    }
  }

  // The floor: a dense baseline shadow row grounding the wall, then the
  // receding plane — perspective seams fanning out from the bay rhythm
  // toward the viewer, and a dot gradient thinning with distance — so the
  // lower third reads as a deep polished floor instead of empty black.
  for (let x = 0; x < cols; x++) {
    putSet(base, cols, rows, x, geo.floorRow, FLOOR_LUM);
    putSet(base, cols, rows, x, geo.floorRow + 1, FLOOR_UNDER_LUM);
  }

  const floorH = Math.max(1, rows - 1 - geo.floorRow);
  const seeds: number[] = [geo.innerL, geo.innerR];

  for (let x = geo.innerL + geo.bayW; x <= geo.innerR - geo.uprightW - 1; x += geo.bayW) {
    seeds.push(x + Math.floor(geo.uprightW / 2));
  }

  for (const sx of seeds) {
    for (let dy = 2; geo.floorRow + dy < rows; dy++) {
      const lum = SEAM_LUM * (1 - dy / floorH);

      if (lum < 0.05) {
        break;
      }

      const x = Math.round(geo.cx + (sx - geo.cx) * (1 + SEAM_SPREAD * dy));
      putMax(base, cols, rows, x, geo.floorRow + dy, lum);
    }
  }

  // Floorboard joints: horizontal courses receding toward the viewer —
  // tightly spaced at the wall's baseline, opening up toward the canvas
  // bottom, fading as they go — crossed by the seams into a perspective
  // grid. A sparse hashed grain fills the boards between the joints.
  let boardDy = 2;
  let boardGap = 3;

  while (geo.floorRow + boardDy < rows) {
    const lum = BOARD_LUM * (1 - boardDy / floorH);

    if (lum < 0.05) {
      break;
    }

    for (let x = 0; x < cols; x++) {
      putMax(base, cols, rows, x, geo.floorRow + boardDy, lum);
    }

    boardDy += boardGap;
    boardGap += 1;
  }

  for (let y = geo.floorRow + 2; y < rows; y++) {
    const depth = (y - geo.floorRow) / floorH;
    const fade = (1 - depth) * (1 - depth); // quadratic falloff from the wall
    const p = DOT_DENSITY * fade;

    for (let x = 0; x < cols; x++) {
      if (hash01(y * 78.233 + x * 12.9898) < p) {
        putMax(base, cols, rows, x, y, DOT_LUM_LO + (DOT_LUM_HI - DOT_LUM_LO) * fade);
      }
    }
  }
}

export const scene: SceneModule = {
  dockGlyph: [
    "++++++++++++",
    "+:=-|=:-=|:+",
    "++++++++++++",
    "+=|:-=+-:=|+",
    "============",
    "  ·:-=+@    ",
  ],
  id: "classroom",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    buildBase(width, height);
    context.lights.length = 0;
  },
  summaryChip: "Beijing, 2019–2020 — teaching STEM at AndKids.",
  tuning: {
    cellH: 6,
    cellW: 6,
    cols: 224,
    minimalGlyph: "·",
    motion: {
      coreLum: 0.92,
      hazeAmount: 0.08,
      hazeFloor: 0.02,
      hazeScale: 0.055,
      hazeSpeed: 0.045,
      orbCore: 0.96,
      orbPeriod: 21,
      orbPhaseY: 0.9,
      orbSigma: 2.9,
      pathSpanX: 0.8,
      pathSpanY: 0.8,
      sheenAmount: 0.2,
      trailAge: 7.5,
      trailPeak: 0.8,
      trailPow: 1.4,
      trailSteps: 220,
    },
    ramp: " ·:-|=+#@",
    rows: 104,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, time } = context;
    const {
      coreLum = 0.92,
      hazeAmount = 0.08,
      hazeFloor = 0.02,
      hazeScale = 0.055,
      hazeSpeed = 0.045,
      orbCore = 0.96,
      orbPeriod = 21,
      orbPhaseY = 0.9,
      orbSigma = 2.9,
      pathSpanX = 0.8,
      pathSpanY = 0.8,
      sheenAmount = 0.2,
      trailAge = 7.5,
      trailPeak = 0.8,
      trailPow = 1.4,
      trailSteps = 220,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if (baseCols !== w || baseRows !== h) {
      buildBase(w, h);
    }

    const geo = geometry(w, h);

    // 1) Air: haze breathes only in the open floor zone (dust hanging over
    // a polished floor), sampled on a coarse lattice, bilinearly upsampled.
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
      const inFloor = y > geo.floorRow + 1;

      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const b = base[i] ?? 0;

        if (!inFloor) {
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

    // 2) The Sphero's path: a wide figure-eight across the open floor,
    // pure in time. The same parametric curve serves the trail (sampled
    // into the past) and the orb (evaluated at now).
    const floorTop = geo.floorRow + 2;
    const floorBot = h - 2;
    const cy = (floorTop + floorBot) / 2;
    const ax = Math.max(0, (geo.innerR - geo.innerL) / 2 - 2) * pathSpanX;
    const ay = Math.max(0, (floorBot - floorTop) / 2 - 3) * pathSpanY;
    const omega = (Math.PI * 2) / Math.max(0.5, orbPeriod);
    const posX = (t: number): number => geo.cx + ax * Math.sin(omega * t);
    const posY = (t: number): number => cy + ay * Math.sin(2 * omega * t + orbPhaseY);

    // 3) The comet trail: the past trailAge seconds of the path, ramping
    // up toward the robot — thick and bright at the head, thinning to
    // single fading dots at the tail, so the motion reads as intentional.
    const steps = Math.max(1, Math.floor(trailSteps));
    const age = Math.max(0.1, trailAge);

    for (let s = 1; s <= steps; s++) {
      const u = s / steps;
      const v = trailPeak * Math.pow(1 - u, trailPow);

      if (v < 0.02) {
        break; // monotone fade — nothing older is visible
      }

      const t = time - u * age;
      const px = Math.round(posX(t));
      const py = Math.round(posY(t));

      putMax(data, w, h, px, py, v);

      if (v >= 0.22) {
        putMax(data, w, h, px - 1, py, v * 0.55);
        putMax(data, w, h, px + 1, py, v * 0.55);
        putMax(data, w, h, px, py - 1, v * 0.55);
        putMax(data, w, h, px, py + 1, v * 0.55);
      }

      if (v >= 0.45) {
        putMax(data, w, h, px - 1, py - 1, v * 0.35);
        putMax(data, w, h, px + 1, py - 1, v * 0.35);
        putMax(data, w, h, px - 1, py + 1, v * 0.35);
        putMax(data, w, h, px + 1, py + 1, v * 0.35);
      }
    }

    // 4) The orb itself: a compact 2x2 max-density core (one '@'-hot
    // pearl, the scene's brightest light), a gaussian halo, and a wide,
    // low floor sheen stretched along the boards.
    const px = posX(time);
    const py = posY(time);
    const cxi = Math.round(px);
    const cyi = Math.round(py);
    const sigma = Math.max(0.6, orbSigma);

    for (let dy = -7; dy <= 7; dy++) {
      for (let dx = -9; dx <= 9; dx++) {
        const xi = cxi + dx;
        const yi = cyi + dy;
        const rx = xi - px;
        const ry = yi - py;
        const radial = orbCore * 0.9 * Math.exp(-(rx * rx + ry * ry) / (sigma * sigma));
        const sheen = sheenAmount * Math.exp(-((rx * rx) / 49 + (ry * ry) / 5.76));
        const v = radial > sheen ? radial : sheen;

        if (v > 0.02) {
          putMax(data, w, h, xi, yi, v);
        }
      }
    }

    const bx = Math.round(px - 0.5);
    const by = Math.round(py - 0.5);

    putMax(data, w, h, bx, by, coreLum);
    putMax(data, w, h, bx + 1, by, coreLum);
    putMax(data, w, h, bx, by + 1, coreLum);
    putMax(data, w, h, bx + 1, by + 1, coreLum);
    putMax(data, w, h, cxi, cyi, orbCore);
  },
};
