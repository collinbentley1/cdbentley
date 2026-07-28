/**
 * Scene 2 — "stage": the University Theatre at Yale, seen from the house.
 *
 * Silhouette before texture, and one light source: the ghost light. The
 * proscenium now fills the frame edge to edge — sitting close, the arch is
 * the whole field of view — jambs with fluted panels rising from bright
 * bases into the dark, a full entablature (cornice, dentil course, triglyph
 * frieze, architrave) across the top. Inside: a teaser curtain whose
 * scalloped hem breathes — the ONE quiet idiomatic motion — black velour
 * legs behind a dark seam, and the ghost light drawn as a real object: a
 * caged bulb (hot '@' core in a wire cage) on a socket collar and thin
 * pole over a splayed tripod, pooling on the deck around its feet. A lone
 * rim-lit figure — sloped shoulders, arms at the sides, split legs — stands
 * at the pool's edge, lit side toward the bulb, dimmer than it. Below the
 * apron an orchestra-pit gap, then four curved seat rows whose center
 * aisle widens toward the viewer. Haze breathes only inside the opening
 * (dust in the ghost light). Steady by default — no flicker (that motion
 * belongs to the corridor scene).
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
const LEG_SPILL_LUM = 0.36; // '-' — ghost-light kiss on the low inner leg edge
const SEAT_LUMS = [0.22, 0.28, 0.36, 0.42] as const; // back arc -> front arc
const SEAT_SPILL_LUM = 0.48; // '|' — spill through the opening on the front row center
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
const STAND_LUM = 0.5; // '|' — ghost light pole, one thin cell
const COLLAR_LUM = 0.55; // '=' — the socket collar under the bulb
const TRIPOD_LUM = 0.56; // '=' — splayed tripod legs, one step above the pool
const FOOT_LUM = 0.58; // '=' — tripod feet on the deck
const CAGE_LUM = 0.28; // ':' — the wire cage around the bulb
const BULB_TOP_LUM = 0.88; // '#/@' — upper bulb cell
const BULB_RING_LUM = 0.55; // '=' pre-light; the SDK halo lifts it to '#', never '@'
const BULB_LUM = 0.95; // '@' — the bulb core: the single brightest cell in the scene
const POOL_DECK_LUM = 0.5; // peak of the elliptical pool on the deck
const POOL_BOOST = 0.24; // floor line lifts '=' -> '+'/'#' around the stand
const FIGURE_CROWN_LUM = 0.5; // '|' — head + upper shoulders, a compact knob
const FIGURE_SLOPE_LUM = 0.44; // '-' — the shoulder slope
const FIGURE_BODY_LUM = 0.26; // ':' — torso interior, near-shadow
const FIGURE_EDGE_LUM = 0.3; // ':' — the faint far edge of the torso
const FIGURE_ARM_LUM = 0.24; // ':' low — arms in shadow beside the lit edge
const FIGURE_HAND_LUM = 0.36; // '-' — hands and feet
const FIGURE_RIM_LUM = 0.56; // '=' — the silhouette edge facing the bulb

/** Jamb panel-groove columns, as offsets from the inner arris (dx). */
const FLUTE_DX = [5, 9] as const;
const FLUTE_MIN_JAMB = 12;

interface StageGeometry {
  apronL: number;
  apronR: number;
  apronRow: number;
  bulbRow: number;
  cx: number;
  entabTop: number;
  figureHeight: number;
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
    bulbRow: Math.max(openTop + 2, floorRow - Math.max(4, Math.round(rows * 0.145))),
    cx: Math.round(cols * 0.5),
    entabTop: Math.max(1, Math.round(rows * 0.05)),
    figureHeight: Math.max(8, Math.round(rows * 0.17)),
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
      const spill = front && Math.abs(x - geo.cx) <= Math.round(cols * 0.11) ? SEAT_SPILL_LUM : lum;

      putSet(base, cols, rows, x, y, spill);

      if (front) {
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
        radius: motion.lightRadius ?? 6,
        x: Math.round(clamp01(motion.lightX ?? 0.46) * (width - 1)),
        y: geo.bulbRow,
      });
    }
  },
  summaryChip: "Yale, 2016–2019 — computer science and mainstage musicals.",
  tuning: {
    cellH: 6,
    cellW: 6,
    cols: 224,
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
      lightRadius: 6,
      lightX: 0.46,
      poolHalfWidth: 20,
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
      lightRadius = 6,
      lightX = 0.46,
      poolHalfWidth = 20,
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

    // 4) The ghost light, drawn as the real object: pool on the deck
    // first, then the splayed tripod, the thin pole up to a socket collar,
    // and the caged bulb — '@' core, '#' crown, '=' ring, ':' wire cage.
    // The SDK light adds only a tight halo in the haze.
    const standX = Math.round(clamp01(lightX) * (w - 1));
    const poolHalf = Math.max(2, poolHalfWidth);
    const deckY = geo.floorRow - 1;

    for (let dy = -4; dy <= 0; dy++) {
      const y = deckY + dy;

      if (y <= geo.openTop) {
        continue;
      }

      for (let dx = -poolHalf; dx <= poolHalf; dx++) {
        const t = (dx / poolHalf) ** 2 + (dy / 3.2) ** 2;

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

    // Tripod: three splayed legs meeting the pole two rows above the deck.
    for (let k = 1; k <= 3; k++) {
      const y = geo.floorRow - 4 + k;
      putMax(data, w, h, standX - k, y, TRIPOD_LUM);
      putMax(data, w, h, standX + k, y, TRIPOD_LUM);
    }

    putMax(data, w, h, standX - 3, deckY, FOOT_LUM);
    putMax(data, w, h, standX + 3, deckY, FOOT_LUM);
    putMax(data, w, h, standX, deckY, FOOT_LUM);

    // Pole from the tripod crown up to the socket collar.
    for (let y = geo.bulbRow + 3; y <= geo.floorRow - 4; y++) {
      putMax(data, w, h, standX, y, STAND_LUM);
    }

    for (let dx = -1; dx <= 1; dx++) {
      putMax(data, w, h, standX + dx, geo.bulbRow + 2, COLLAR_LUM);
    }

    // The caged bulb: wire cage columns flanking a two-cell bulb.
    for (let dy = -2; dy <= 1; dy++) {
      putMax(data, w, h, standX - 2, geo.bulbRow + dy, CAGE_LUM);
      putMax(data, w, h, standX + 2, geo.bulbRow + dy, CAGE_LUM);
    }

    putMax(data, w, h, standX, geo.bulbRow - 3, CAGE_LUM); // cage crown
    putMax(data, w, h, standX - 1, geo.bulbRow, BULB_RING_LUM);
    putMax(data, w, h, standX + 1, geo.bulbRow, BULB_RING_LUM);
    putMax(data, w, h, standX - 1, geo.bulbRow - 1, BULB_RING_LUM);
    putMax(data, w, h, standX + 1, geo.bulbRow - 1, BULB_RING_LUM);
    putMax(data, w, h, standX, geo.bulbRow - 2, BULB_RING_LUM);
    putMax(data, w, h, standX, geo.bulbRow - 1, BULB_TOP_LUM);
    putMax(data, w, h, standX, geo.bulbRow, BULB_LUM);

    // 5) The figure: still, at the pool's edge, rim-lit by the bulb and
    // dimmer than it. The bright rim column carries the silhouette; the
    // torso interior stays near-shadow (a uniform grid reads as windows,
    // not a person): compact head, sloped shoulders, arms in shadow at
    // the sides, split legs around a true dark gap, feet.
    const figX = Math.round(clamp01(figureX) * (w - 1));
    const figTop = Math.max(geo.openTop + 1, geo.floorRow - geo.figureHeight);
    const rimLeft = figX > standX; // which side faces the bulb
    const legTop = Math.max(figTop + 6, geo.floorRow - Math.max(3, Math.round(geo.figureHeight * 0.3)));
    const armDrop = Math.max(figTop + 6, legTop - 1);
    const mirror = (dx: number): number => (rimLeft ? figX + dx : figX + 1 - dx);

    for (let y = figTop; y < figTop + 3; y++) {
      putMax(data, w, h, figX, y, FIGURE_CROWN_LUM); // head, 2 cells wide
      putMax(data, w, h, figX + 1, y, FIGURE_CROWN_LUM);
    }

    for (let dx = -1; dx <= 2; dx++) {
      putMax(data, w, h, figX + dx, figTop + 3, FIGURE_CROWN_LUM); // upper shoulders
    }

    for (let dx = -2; dx <= 3; dx++) {
      putMax(data, w, h, figX + dx, figTop + 4, FIGURE_SLOPE_LUM); // shoulder slope, 6 wide
    }

    for (let y = figTop + 5; y < legTop; y++) {
      putMax(data, w, h, mirror(-1), y, FIGURE_RIM_LUM); // lit torso edge
      putMax(data, w, h, mirror(0), y, FIGURE_BODY_LUM);
      putMax(data, w, h, mirror(1), y, FIGURE_ARM_LUM);
      putMax(data, w, h, mirror(2), y, FIGURE_EDGE_LUM); // faint far edge

      if (y < armDrop) {
        putMax(data, w, h, mirror(-2), y, FIGURE_ARM_LUM); // arms in shadow
        putMax(data, w, h, mirror(3), y, FIGURE_ARM_LUM);
      }
    }

    putMax(data, w, h, mirror(-2), armDrop, FIGURE_HAND_LUM); // hands
    putMax(data, w, h, mirror(3), armDrop, FIGURE_HAND_LUM);

    for (let y = legTop; y < geo.floorRow; y++) {
      putMax(data, w, h, mirror(-1), y, FIGURE_RIM_LUM); // near leg, lit edge
      putMax(data, w, h, mirror(0), y, FIGURE_BODY_LUM);
      putMax(data, w, h, mirror(2), y, FIGURE_EDGE_LUM); // far leg past a dark gap
    }

    putMax(data, w, h, mirror(-2), geo.floorRow - 1, FIGURE_HAND_LUM); // feet
    putMax(data, w, h, mirror(3), geo.floorRow - 1, FIGURE_HAND_LUM);

    // Rim light on the head and shoulder rows toward the bulb.
    for (let y = figTop; y < figTop + 4; y++) {
      putMax(data, w, h, rimLeft ? figX : figX + 1, y, FIGURE_RIM_LUM);
    }

    putMax(data, w, h, mirror(-2), figTop + 4, FIGURE_RIM_LUM);

    const light = lights[0];

    if (light) {
      light.x = standX;
      light.y = geo.bulbRow;
      light.radius = Math.max(0.5, lightRadius);
      light.intensity = clamp01(lightIntensity * (1 + lightBreath * Math.sin(time * 1.7)));
    }
  },
};
