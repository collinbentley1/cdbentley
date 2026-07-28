/**
 * Scene 8 — "subway-platform": The arrival (2026, now).
 *
 * The train has arrived. An R160-style car stands stopped at the platform,
 * its flat stainless face MONUMENTAL across the right half of the frame —
 * two dark end windows flanking a center storm door, a lit route bullet
 * over the door, anticlimber ribs across the base, and twin headlamps (the
 * scene's only two '@' cells) blazing at the lower corners. The car's
 * flank recedes left to a vanishing point buried in the tunnel portal it
 * just cleared — lit window band and door rhythm compressing to nothing —
 * while the frontal running-bond tile wall of the station fills the upper
 * left, full-bleed, over a platform whose warning strip dives from the
 * near corner to the portal's foot. THE LIGHT EVENT: the headlight beams
 * fan down the track bed and across the platform corner toward the viewer,
 * splashing the warning strip; a march of dark I-beam silhouettes stands
 * in front of the glow. ONE MOTION, pure f(time): the beams breathe — the
 * slow idle surge of a train holding at the platform — while a dust haze
 * drifts low through the light.
 *
 * Nothing human-readable is rendered here; the chapter prose is DOM.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(29);
const tileNoise = createValueNoise(83);

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const V = {
  antiA: 0.6, // '=' — anticlimber rib, lit
  antiB: 0.24, // ':' — anticlimber rib, shadow gap
  beltTrim: 0.4, // '-' — trim band under the windshields
  body: 0.3, // ':' — car-face stainless
  bullet: 0.8, // '#' — the lit route bullet over the storm door
  bulletRing: 0.12, // '·' — dark bezel around the bullet
  doorEdge: 0.4, // '-' — storm-door frame
  doorLeaf: 0.2, // '·' — storm-door leaf
  doorWin: 0.08, // ' ' — storm-door porthole
  edge: 0.64, // '=' — face outline (4 cells: survives bin 4 as a dotted frame)
  flankBody: 0.24, // ':' — flank steel between roof and window band
  flankDoor: 0.12, // '·' — the door pocket riding back toward the portal
  flankPier: 0.2, // '·' — pier between flank windows
  flankRoof: 0.48, // '|' — flank roofline ray
  flankSkirt: 0.18, // '·' — flank below the window band
  flankWin: 0.62, // '=' — the lit window band receding to the VP
  glass: 0.07, // ' ' — windshield panes
  glassFrame: 0.42, // '-' — windshield gasket
  jambEdge: 0.63, // '=' — near I-beam flange edges
  jambFill: 0.56, // '=' — near I-beam fill
  jambSplice: 0.64, // '=' — splice-plate course
  jambWeb: 0.4, // '-' — web shadow line
  lamp: 0.95, // '@' — the two headlamp cores (scene maximum)
  lampRing: 0.6, // '=' — static housing ring around each core
  lampSeat: 0.7, // '+' — static seat under the core
  lintel: 0.3, // ':' — portal lintel course
  platFar: 0.08, // ' ' — platform floor at the wall foot
  platNear: 0.17, // '·' — platform floor at the viewer's feet
  portalDark: 0.02, // ' ' — the tunnel mouth
  portalJamb: 0.34, // '-' — portal jamb line
  rail: 0.26, // ':' — the near running rail in the trench
  roofEdge: 0.66, // '=' — face top edge / roofline
  wallCove: 0.24, // ':' — cove line where the frontal wall meets the ground
  silEdge: 0.16, // '·' — silhouette column flange
  silFill: 0.08, // ' ' — silhouette column web
  stripOff: 0.2, // '·' — warning-strip gap
  stripOn: 0.55, // '|' — warning-strip dash
  tactile: 0.24, // ':' — tactile-dot rows on the platform side
  trackBed: 0.05, // ' ' — track trench
  trackShadow: 0.03, // ' ' — shadow under the car
  wallFace: 0.18, // '·' — tile face
  wallGrout: 0.05, // ' ' — mortar line
} as const;

/**
 * The silhouette-column march: center x and width as fractions of cols.
 * They stand on the platform between the viewer and the beams — dark
 * verticals in front of the headlight glow, bases on the warning strip.
 */
const SIL_X = [0.17, 0.275, 0.335] as const;
const SIL_W = [0.025, 0.014, 0.009] as const;

/** Flank door pockets behind the face, world units; world depth of the face. */
const FLANK_DOORS = [4.5, 10.5, 16.5] as const;
const FLANK_Z0 = 6;

interface ArrivalGeometry {
  cols: number;
  rows: number;
  /** Vanishing point (inside the tunnel portal, left of center). */
  vx: number;
  vy: number;
  /** The stopped car's face rect. */
  faceL: number;
  faceR: number;
  faceT: number;
  faceB: number;
  /** Frontal wall foot, tunnel portal band, tile trim course. */
  wallFoot: number;
  portalL: number;
  portalR: number;
  portalTop: number;
  trimRow: number;
  /** Platform-edge ray intercept at x = 0 (off-canvas below). */
  edgeY0: number;
  /** Near I-beam jamb width at the left canvas edge. */
  jambW: number;
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

function smooth01(v: number): number {
  const t = v <= 0 ? 0 : v >= 1 ? 1 : v;

  return t * t * (3 - 2 * t);
}

/** Landmarks from proportions; the flank and edge ray converge on the VP. */
function geometry(cols: number, rows: number): ArrivalGeometry {
  return {
    cols,
    edgeY0: rows * 1.5,
    faceB: Math.round(rows * 0.92),
    faceL: Math.round(cols * 0.52),
    faceR: Math.min(cols - 2, Math.round(cols * 0.975)),
    faceT: Math.round(rows * 0.1),
    jambW: Math.max(2, Math.round(cols * 0.055)),
    portalL: Math.round(cols * 0.315),
    portalR: Math.round(cols * 0.445),
    portalTop: Math.round(rows * 0.175),
    rows,
    trimRow: Math.round(rows * 0.08),
    vx: Math.max(2, Math.round(cols * 0.36)),
    vy: Math.round(rows * 0.37),
    wallFoot: Math.round(rows * 0.52),
  };
}

/** The platform-edge ray through the VP (valid left of the VP). */
function edgeAt(geo: ArrivalGeometry, x: number): number {
  return geo.vy + (geo.edgeY0 - geo.vy) * ((geo.vx - x) / geo.vx);
}

/** Bounds-checked assignment. */
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

/** Additive glare capped below the '@' band ('@' is reserved for the lamps). */
function putGlow(data: Float32Array, w: number, h: number, x: number, y: number, add: number): void {
  if (x < 0 || x >= w || y < 0 || y >= h || add <= 0) {
    return;
  }

  const i = y * w + x;
  const cur = data[i] ?? 0;
  const lifted = cur + add;
  data[i] = lifted > 0.87 ? (cur > 0.87 ? cur : 0.87) : lifted;
}

/**
 * Static architecture — everything but the light: the frontal tile wall
 * and tunnel portal, the platform, warning strip and track bed, the near
 * I-beam jamb, and the whole train (face and receding flank). The car is
 * stopped; only its light moves.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);
  const fw = Math.max(1, geo.faceR - geo.faceL);
  const fh = Math.max(1, geo.faceB - geo.faceT);
  const cornerR = Math.max(1.5, 0.05 * Math.min(fw, fh));
  // Face features in cell space (fractions of the face rect).
  const winY0 = geo.faceT + 0.13 * fh;
  const winY1 = geo.faceT + 0.4 * fh;
  const wLx0 = geo.faceL + 0.07 * fw;
  const wLx1 = geo.faceL + 0.375 * fw;
  const wRx0 = geo.faceL + 0.625 * fw;
  const wRx1 = geo.faceL + 0.93 * fw;
  const dX0 = geo.faceL + 0.435 * fw;
  const dX1 = geo.faceL + 0.565 * fw;
  const dY0 = geo.faceT + 0.1 * fh;
  const dY1 = geo.faceT + 0.84 * fh;
  const dwX0 = geo.faceL + 0.46 * fw;
  const dwX1 = geo.faceL + 0.54 * fw;
  const dwY0 = geo.faceT + 0.15 * fh;
  const dwY1 = geo.faceT + 0.35 * fh;
  const bulletX = geo.faceL + 0.5 * fw;
  const bulletY = geo.faceT + 0.075 * fh;
  const bulletR = Math.max(1.3, 0.052 * fh);
  const flankSpan = Math.max(1, geo.faceL - geo.vx);

  const inFace = (x: number, y: number): boolean => {
    if (x < geo.faceL || x > geo.faceR || y < geo.faceT || y > geo.faceB) {
      return false;
    }

    if (y < geo.faceT + cornerR) {
      const cx = Math.min(Math.max(x, geo.faceL + cornerR), geo.faceR - cornerR);
      const dx = x - cx;
      const dy = y - (geo.faceT + cornerR);

      if (dx * dx + dy * dy > cornerR * cornerR) {
        return false; // outside a rounded top corner
      }
    }

    return true;
  };

  const faceShade = (x: number, y: number): number => {
    const fy = (y - geo.faceT) / fh;
    const bd = Math.min(x - geo.faceL, geo.faceR - x, y - geo.faceT, geo.faceB - y);

    if (bd < 3.5) {
      return fy < 0.06 ? V.roofEdge : V.edge; // the 4-cell outline frame
    }

    if (fy < 0.06) {
      return V.roofEdge; // the full roofline band (survives bin-4 pooling)
    }

    const dbx = x - bulletX;
    const dby = y - bulletY;
    const db2 = dbx * dbx + dby * dby;

    if (db2 <= bulletR * bulletR) {
      return V.bullet;
    }

    if (db2 <= (bulletR + 1.2) * (bulletR + 1.2)) {
      return V.bulletRing;
    }

    if (y >= winY0 && y <= winY1) {
      for (const [x0, x1] of [
        [wLx0, wLx1],
        [wRx0, wRx1],
      ] as const) {
        if (x >= x0 && x <= x1) {
          const border = Math.min(x - x0, x1 - x, y - winY0, winY1 - y) < 1.1;

          return border ? V.glassFrame : V.glass;
        }
      }
    }

    if (x >= dX0 && x <= dX1 && y >= dY0 && y <= dY1) {
      if (Math.abs(x - dX0) < 1.1 || Math.abs(x - dX1) < 1.1 || Math.abs(y - dY0) < 1.1) {
        return V.doorEdge;
      }

      if (x >= dwX0 && x <= dwX1 && y >= dwY0 && y <= dwY1) {
        return V.doorWin;
      }

      return V.doorLeaf;
    }

    if (fy >= 0.415 && fy <= 0.445) {
      return V.beltTrim;
    }

    if (fy >= 0.86) {
      return Math.floor((geo.faceB - y) / 2) % 2 === 0 ? V.antiA : V.antiB;
    }

    return V.body + (tileNoise(x * 0.13, y * 0.17) - 0.5) * 0.03;
  };

  const wallShade = (x: number, y: number): number => {
    const dimH = 0.72 + 0.28 * (y / Math.max(1, geo.wallFoot));
    const onGrout = x % 7 < 1 || (y + (Math.floor(x / 7) % 2 === 0 ? 0 : 2)) % 4 < 1;
    let v = onGrout ? V.wallGrout : V.wallFace + (tileNoise(Math.floor(x / 7) * 3.1, Math.floor(y / 4) * 5.7) - 0.5) * 0.05;

    if (y === geo.trimRow) {
      v *= 0.5; // one-cell trim course; the bond texture runs through it
    }

    return v * dimH;
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let v: number;

      if (inFace(x, y)) {
        v = faceShade(x, y);
      } else if (x > geo.vx && x < geo.faceL && flankAt(geo, flankSpan, x, y) >= 0) {
        v = flankAt(geo, flankSpan, x, y);
      } else if (x >= geo.portalL && x <= geo.portalR && y >= geo.portalTop && y < geo.wallFoot) {
        v = V.portalDark;
      } else if (y < geo.wallFoot) {
        v = wallShade(x, y);
      } else if (x >= geo.faceL) {
        v = V.trackShadow; // under the car
      } else if (x < geo.vx && y <= edgeAt(geo, x)) {
        const fr = clamp01((y - geo.wallFoot) / Math.max(1, rows - geo.wallFoot));
        v = 0.1 + (V.platNear - 0.1) * Math.pow(fr, 0.9);
      } else {
        v = V.trackBed + 0.02 * clamp01((y - geo.wallFoot) / Math.max(1, rows - geo.wallFoot));
      }

      base[y * cols + x] = clamp01(v);
    }
  }

  // The cove line where the frontal wall meets the ground (broken by the
  // portal, where the track runs into the tunnel).
  for (let x = 0; x < Math.min(cols, geo.faceL); x++) {
    if (x > geo.portalL && x < geo.portalR) {
      continue;
    }

    putSet(base, cols, rows, x, geo.wallFoot, V.wallCove);
  }

  // Portal edges: the left jamb and the lintel over the opening, both two
  // cells so the mouth reads as a framed dark (the right jamb hides behind
  // the car's flank).
  for (let y = geo.portalTop; y < Math.min(rows, geo.wallFoot); y++) {
    putSet(base, cols, rows, geo.portalL, y, V.portalJamb);
    putSet(base, cols, rows, geo.portalL - 1, y, V.portalJamb * 0.75);
  }

  for (let x = geo.portalL - 1; x <= geo.portalR; x++) {
    putSet(base, cols, rows, x, geo.portalTop - 1, V.lintel);
    putSet(base, cols, rows, x, geo.portalTop - 2, V.lintel * 0.75);
  }

  // The near rail: one glint ray in the trench between strip and car.
  const railPx = Math.round(cols * 0.45);
  const railPy = Math.round(rows * 0.82);
  const railSlope = (railPy - geo.vy) / Math.max(1, railPx - geo.vx);

  for (let x = geo.vx + 3; x < geo.faceL; x++) {
    const y = Math.round(geo.vy + railSlope * (x - geo.vx));
    const yBot = geo.vy + ((x - geo.vx) / flankSpan) * (geo.faceB - geo.vy);

    if (y > yBot + 1 && y < rows) {
      putMax(base, cols, rows, x, y, V.rail * clamp01(0.3 + 0.7 * ((x - geo.vx) / flankSpan)));
    }
  }

  // The warning strip: bright dashes diving from the near corner to the
  // portal's foot, with tactile-dot rows on the platform side.
  for (let x = 2; x < geo.vx - 2; x++) {
    const yEdge = edgeAt(geo, x);

    if (yEdge < geo.wallFoot - 1 || yEdge > rows + 3) {
      continue;
    }

    const y = Math.round(yEdge);
    const nearness = clamp01((geo.vx - x) / geo.vx);
    const thick = 1 + Math.round(2.2 * nearness);
    const z = geo.vx / Math.max(1, geo.vx - x);
    const on = Math.floor(z * 3) % 4 < 3;

    for (let r = 0; r < thick; r++) {
      putSet(base, cols, rows, x, y + r, on ? V.stripOn : V.stripOff);
    }

    if (x % 2 === 0) {
      putSet(base, cols, rows, x, y - 1, V.tactile);
      putSet(base, cols, rows, x, y - 2, V.tactile * 0.8);
    }
  }

  // The near I-beam jamb: full height at the left canvas edge (full-bleed).
  for (let y = 0; y < rows; y++) {
    for (let dx = 0; dx < geo.jambW; dx++) {
      let v: number = V.jambFill;

      if (dx === 0 || dx === geo.jambW - 1) {
        v = V.jambEdge;
      } else if (geo.jambW >= 6 && dx === 2) {
        v = V.jambWeb;
      } else if (geo.jambW >= 6 && y % 14 === 6) {
        v = V.jambSplice;
      }

      putSet(base, cols, rows, dx, y, v);
    }
  }

  // Static lamp housings (the '@' cores and breathing bloom are update's).
  const seats = lampSeats(geo);

  for (const lx of [seats.lx, seats.rx]) {
    // A solid housing block: bright enough (with the core and bloom) that
    // each lamp pools into a blob that survives bin-4 compaction.
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        putSet(base, cols, rows, lx + dx, seats.y + dy, Math.abs(dx) === 3 || dy !== 0 ? V.lampRing : V.lampSeat);
      }
    }

    putSet(base, cols, rows, lx, seats.y, V.lampSeat);

    // A static pool of reflected light on the track shadow under each lamp.
    for (let dy = 1; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        putGlow(base, cols, rows, lx + dx, geo.faceB + dy, 0.14 * Math.exp(-(dx * dx * 0.14 + dy * dy * 0.35)));
      }
    }
  }

  // Static spill around the lit route bullet (it reads from far away).
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const add = 0.2 * Math.exp(-(dx * dx * 0.1 + dy * dy * 0.28));

      if (add > 0.015) {
        putGlow(base, cols, rows, Math.round(bulletX) + dx, Math.round(bulletY) + dy, add);
      }
    }
  }
}

/**
 * The receding flank at (x, y): luminance, or -1 when (x, y) is off the
 * flank. Window band, door pockets and piers ride on world depth and drop
 * out once their projection narrows below a cell (no 1-cell jumble).
 */
function flankAt(geo: ArrivalGeometry, span: number, x: number, y: number): number {
  const t = (x - geo.vx) / span;

  if (t < 0.07) {
    return -1; // dissolved into the portal
  }

  const yTop = geo.vy + t * (geo.faceT - geo.vy);
  const yBot = geo.vy + t * (geo.faceB - geo.vy);

  if (y < yTop || y > yBot) {
    return -1;
  }

  const dim = 0.3 + 0.7 * t;
  const rel = FLANK_Z0 / t - FLANK_Z0;
  const resolution = (span * FLANK_Z0) / ((rel + FLANK_Z0) * (rel + FLANK_Z0)); // cells per world unit
  let door = false;
  let doorSplit = false;

  if (resolution >= 1.4) {
    for (const d of FLANK_DOORS) {
      const dd = Math.abs(rel - d);

      if (dd < 0.75) {
        door = true;
        doorSplit = dd < 0.1;
      }
    }
  }

  const pier = resolution >= 0.7 && Math.floor(rel * 0.9) % 4 === 3;
  const fyy = (y - yTop) / Math.max(1, yBot - yTop);
  let v: number;

  if (fyy < 0.07) {
    v = V.flankRoof;
  } else if (fyy >= 0.16 && fyy < 0.44) {
    v = door ? (doorSplit ? V.flankDoor * 0.5 : V.flankDoor + 0.18) : pier ? V.flankPier : V.flankWin;
  } else if (fyy >= 0.44) {
    v = door ? V.flankDoor * 0.7 : V.flankSkirt;
  } else {
    v = door ? V.flankDoor : V.flankBody;
  }

  return clamp01(v * dim);
}

/** The two headlamp seats at the face's lower corners. */
function lampSeats(geo: ArrivalGeometry): { lx: number; rx: number; y: number } {
  const fw = Math.max(1, geo.faceR - geo.faceL);
  const fh = Math.max(1, geo.faceB - geo.faceT);

  return {
    lx: Math.round(geo.faceL + 0.1 * fw),
    rx: Math.round(geo.faceL + 0.9 * fw),
    y: Math.round(geo.faceT + 0.78 * fh),
  };
}

export const subwayPlatformScene: SceneModule = {
  dockGlyph: [
    "=====##=====",
    "|   |::|   |",
    "|   |::|   |",
    "|::::::::::|",
    "|@········@|",
    "-=-=-=-=-=-=",
  ],
  id: "subway-platform",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    buildBase(width, height);
  },
  summaryChip: "July 2026 — between trains, shipping open source.",
  tuning: {
    cellH: 6,
    cellW: 6,
    cols: 224,
    minimalGlyph: "·",
    motion: {
      beamAimX: 0,
      beamAimY: 1.32,
      beamGain: 0.68,
      beamLength: 150,
      beamSpread: 0.16,
      bloomGain: 0.68,
      breatheAmp: 0.18,
      breathePeriod: 11,
      hazeAmount: 0.06,
      hazeFloor: 0.02,
      hazeScale: 0.06,
      hazeSpeed: 0.05,
      splashGain: 1.2,
    },
    ramp: " ·:-|=+#@",
    rows: 104,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, time } = context;
    const {
      beamAimX = 0,
      beamAimY = 1.32,
      beamGain = 0.68,
      beamLength = 150,
      beamSpread = 0.16,
      bloomGain = 0.68,
      breatheAmp = 0.18,
      breathePeriod = 11,
      hazeAmount = 0.06,
      hazeFloor = 0.02,
      hazeScale = 0.06,
      hazeSpeed = 0.05,
      splashGain = 1.2,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if (baseCols !== w || baseRows !== h) {
      buildBase(w, h);
    }

    const geo = geometry(w, h);
    const seats = lampSeats(geo);
    const fw = Math.max(1, geo.faceR - geo.faceL);
    const fh = Math.max(1, geo.faceB - geo.faceT);

    data.set(base);

    // --- Haze drifts low through the light (dust the tunnel exhales),
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

    for (let y = geo.wallFoot + 1; y < h; y++) {
      const gy = y / stride;
      const gy0 = Math.floor(gy);
      const fy = gy - gy0;
      const rowA = gy0 * gw;
      const rowB = (gy0 + 1) * gw;

      for (let x = geo.jambW; x < Math.min(w, geo.faceL); x++) {
        const gx = x / stride;
        const gx0 = Math.floor(gx);
        const fx = gx - gx0;
        const top = (hazeLattice[rowA + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowA + gx0 + 1] ?? 0) * fx;
        const bottom = (hazeLattice[rowB + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowB + gx0 + 1] ?? 0) * fx;
        putMax(data, w, h, x, y, hazeFloor + hazeAmount * (top * (1 - fy) + bottom * fy));
      }
    }

    // --- The one motion: the headlight field breathes, slow and even.
    const gm = 1 - breatheAmp + breatheAmp * (0.5 + 0.5 * Math.sin((Math.PI * 2 * time) / Math.max(0.5, breathePeriod)));

    for (const lx of [seats.lx, seats.rx]) {
      // Halation: an elliptical bloom around each lamp, wider than tall;
      // glyph quantization dithers its falloff rings.
      const sx = Math.max(1.6, 0.05 * fw);
      const sy = Math.max(1, 0.024 * fh);
      const rx = Math.ceil(sx * 2.7);
      const ry = Math.ceil(sy * 2.7);

      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          const add = bloomGain * gm * Math.exp(-((dx * dx) / (2 * sx * sx) + (dy * dy) / (2 * sy * sy)));

          if (add > 0.012) {
            putGlow(data, w, h, lx + dx, seats.y + dy, add);
          }
        }
      }

      // The beam: a cone fanning down the track bed and across the
      // platform corner toward the viewer — the light that explains the
      // floor streak.
      const tx = w * beamAimX - lx;
      const ty = h * beamAimY - seats.y;
      const tLen = Math.max(1, Math.hypot(tx, ty));
      const dx = tx / tLen;
      const dy = ty / tLen;
      const gain = beamGain * gm;
      const beamLen = Math.max(8, beamLength * (w / 224));

      for (let y = Math.max(0, seats.y - 6); y < h; y++) {
        for (let x = 0; x <= Math.min(w - 1, lx); x++) {
          const px = x - lx;
          const py = y - seats.y;
          const proj = px * dx + py * dy;

          if (proj < 1) {
            continue;
          }

          const off = px * dy - py * dx;
          const spread = beamSpread * proj + 1.4;
          // The cone dims while it crosses the car's own face — the light
          // only blooms once it reaches open air and the track bed.
          const faceDamp = x >= geo.faceL && y <= geo.faceB ? 0.3 : 1;
          const add = faceDamp * gain * smooth01(proj / 10) * Math.exp(-(off * off) / (2 * spread * spread)) * Math.exp(-proj / beamLen);

          if (add > 0.005) {
            putGlow(data, w, h, x, y, add);
          }
        }
      }

      // The splash: the warning strip catches the beam a band brighter
      // than the concrete around it (paint reflects).
      for (let x = 2; x < geo.vx - 2; x++) {
        const yEdge = edgeAt(geo, x);

        if (yEdge < geo.wallFoot - 1 || yEdge > h + 2) {
          continue;
        }

        const px = x - lx;
        const py = yEdge - seats.y;
        const proj = px * dx + py * dy;

        if (proj < 1) {
          continue;
        }

        const off = px * dy - py * dx;
        const spread = beamSpread * proj + 1.4;
        const add = splashGain * gain * Math.exp(-(off * off) / (2 * spread * spread)) * Math.exp(-proj / beamLen);

        if (add > 0.005) {
          const thick = 1 + Math.round(2.2 * clamp01((geo.vx - x) / geo.vx));

          for (let r = 0; r < thick; r++) {
            putGlow(data, w, h, x, Math.round(yEdge) + r, add);
          }
        }
      }
    }

    // --- The silhouette march: dark I-beams standing in front of the glow.
    for (let i = 0; i < SIL_X.length; i++) {
      const xc = Math.round((SIL_X[i] ?? 0) * w);
      const cw = Math.max(1, Math.round((SIL_W[i] ?? 0) * w));
      const xl = xc - (cw >> 1);
      const yBase = Math.min(h - 1, Math.round(edgeAt(geo, xc)) - 1);

      for (let y = 0; y <= yBase; y++) {
        for (let dx = 0; dx < cw; dx++) {
          putSet(data, w, h, xl + dx, y, cw >= 3 && (dx === 0 || dx === cw - 1) ? V.silEdge : V.silFill);
        }
      }
    }

    // --- The cores: the scene's only two '@' cells.
    putSet(data, w, h, seats.lx, seats.y, V.lamp);
    putSet(data, w, h, seats.rx, seats.y, V.lamp);
  },
};
