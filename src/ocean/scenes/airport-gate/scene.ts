/**
 * Scene 7 — "airport-gate": an airport gate, last flight gone.
 *
 * The one idiomatic motion is the departure board reshuffling: a board cell's
 * luminance sweeping through the ramp reads as a split-flap flip, no
 * skeuomorphism. Around it, one room, not four islands: a back-wall line and
 * a floor line tie the board, the night glass, and two linked rows of empty
 * seats together. The board's grid — a digit-pair time column, dash-run
 * destinations, a dim status column — reads as departures without one
 * legible word. Through the glass the view resolves instead of dissolving:
 * an empty jet bridge stands parked over the tarmac — ribbed tube, rotunda,
 * one support pylon — with sparse taxiway dashes below the horizon; the last
 * flight is gone and the bridge waits. Three runway lights sit on the
 * horizon; a beacon crosses the glass on a slow period. The chapter prose
 * beside this scene is DOM, never rendered here.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule, type SceneTuning } from "../../sdk/index.ts";

const COLS = 192;
const ROWS = 84;

// Departure board (left): panel frame, header row, six data rows.
const BOARD_X0 = 14;
const BOARD_X1 = 97;
const BOARD_Y0 = 5;
const BOARD_Y1 = 23;
const TEXT_X0 = 18;
const TEXT_COLS = 76;
const HEADER_Y = 8;
const DATA_ROW_YS = [10, 12, 14, 16, 18, 20] as const;
const CLOCK_C0 = 66; // header-local column where the clock block starts

// Board columns (board-local cells). Alignment does the reading: every row
// puts a digit pair on the left, a dash-run destination mid-left, and a dim
// status run on the right — the grid says "departures" with no legible words.
const TIME_C1 = 4; // cells 0..4: digit pair, separator, digit pair
const DEST_C0 = 9;
const DEST_MAX = 40;
const STATUS_C0 = 52;
const STATUS_MAX = 69;

// Window band (right): mullions, breathing night glass, a horizon.
const WIN_X0 = 108;
const WIN_X1 = 186;
const WIN_Y0 = 5;
const WIN_Y1 = 44;
const MULLION_STEP = 13;
const HORIZON_Y = 36;
const BEACON_Y = 35; // the beacon rides the horizon, not the sky
const RUNWAY_DOT_XS = [126, 149, 171] as const; // three lights, off-mullion

// Room lines: the two horizontals that make the islands one room.
const WALL_LINE_Y = 48; // back wall meets floor, under board and window alike
const FLOOR_LINE_Y = 73; // front edge of the floor; the near seats stand on it

// Two linked rows of empty seats facing the glass, two banks per row with an
// aisle. The near row is taller (closer); its legs reach the floor line.
const SEAT_UNIT_W = 11;
const SEAT_UNITS = 6;
const SEAT_ROWS_SPEC = [
  { banks: [26, 107] as const, legsTo: 58, yTop: 52 },
  { banks: [22, 103] as const, legsTo: 72, yTop: 63 },
] as const;

const PANEL_BG = 0.13; // blank board cell (a dark flap, not a hole)

const noise = createValueNoise(6);

interface BoardRow {
  /** Event id feeding the flip-cycle hash, distinct per reshuffle. */
  flipSeed: number;
  /** Time the left-to-right sweep began; -1e9 = settled since forever. */
  flipStart: number;
  /** Line shown ahead of the sweep (76 board-local cells; 0 = blank). */
  prev: Float32Array;
  /** Line the sweep settles into. */
  target: Float32Array;
}

interface SceneState {
  base: Float32Array;
  eventCounter: number;
  /** Packed [bufferIndex, x, y] triples for glass cells (noise per frame). */
  glassCells: Int32Array;
  nextCascadeAt: number;
  nextReshuffleAt: number;
  reshuffleCursor: number;
  rows: BoardRow[];
}

/** Cells of the static view through the glass (jet bridge, taxiway dashes) —
 * they and their one-cell margin are excluded from the breathing night noise. */
let viewMask = new Uint8Array(0);

let state: SceneState = {
  base: new Float32Array(0),
  eventCounter: 0,
  glassCells: new Int32Array(0),
  nextCascadeAt: 0,
  nextReshuffleAt: 0,
  reshuffleCursor: 0,
  rows: [],
};

const tuning: SceneTuning = {
  cellH: 8,
  cellW: 8,
  cols: COLS,
  minimalGlyph: "·",
  motion: {
    beaconIntensity: 0.2,
    beaconPeriod: 11,
    beaconRadius: 7,
    cascadeEvery: 47,
    cascadeStagger: 0.28,
    flipDuration: 0.55,
    flipStagger: 0.035,
    flipTick: 0.045,
    nightAmp: 0.11,
    nightDrift: 0.05,
    nightScale: 0.12,
    reshuffleEvery: 5.5,
    residueDepth: 0.85,
    residueLevel: 0.62,
    residueSpan: 0.25,
  },
  ramp: " ·:~-=+*#%@",
  rows: ROWS,
};

export const scene: SceneModule = {
  dockGlyph: [
    " ========== ",
    " =%%·---·:= ",
    " =%%·--··:= ",
    " ========== ",
    "  =·=·=·=·  ",
    "  | | | |   ",
  ],
  id: "airport-gate",
  init(context: SceneContext): void {
    state = {
      base: buildBase(),
      eventCounter: 0,
      glassCells: new Int32Array(0),
      nextCascadeAt: Math.max(10, tuning.motion.cascadeEvery ?? 47),
      nextReshuffleAt: 2.5,
      reshuffleCursor: 0,
      rows: [],
    };

    // Board rows settle into their opening lines before the first reshuffle.
    state.rows = DATA_ROW_YS.map((_, r) => {
      state.eventCounter += 1;
      const row: BoardRow = {
        flipSeed: state.eventCounter,
        flipStart: -1e9,
        prev: new Float32Array(TEXT_COLS),
        target: new Float32Array(TEXT_COLS),
      };
      generateLine(row.target, r, state.eventCounter);
      row.prev.set(row.target);
      return row;
    });

    // Glass cells (window interior, off-mullion) get per-frame night noise.
    // Cells the static view occupies (the jet bridge, taxiway dashes — any
    // base above the noise ceiling), plus a one-cell quiet margin around
    // them, are excluded: the structure stands still with a dark outline of
    // separation while the night breathes around it.
    const isView = (x: number, y: number): boolean => (viewMask[y * COLS + x] ?? 0) !== 0;
    const nearView = (x: number, y: number): boolean => {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (isView(x + dx, y + dy)) {
            return true;
          }
        }
      }

      return false;
    };
    const triples: number[] = [];

    for (let y = WIN_Y0 + 1; y < WIN_Y1; y++) {
      for (let x = WIN_X0 + 1; x < WIN_X1; x++) {
        if ((x - WIN_X0) % MULLION_STEP !== 0 && !nearView(x, y)) {
          triples.push(y * COLS + x, x, y);
        }
      }
    }

    state.glassCells = Int32Array.from(triples);

    // The runway beacon is the scene's single light source.
    context.lights.splice(0, context.lights.length);
    context.lights.push({ intensity: 0, radius: 7, x: WIN_X0 + 2, y: BEACON_Y });
  },
  summaryChip: "OTseek, 2026 — a ChatGPT app in the first public wave.",
  tuning,
  update(dt: number, context: SceneContext): void {
    const t = context.time;
    const data = context.buffer.data;
    const {
      beaconIntensity = 0.2,
      beaconPeriod = 11,
      beaconRadius = 7,
      cascadeEvery = 47,
      cascadeStagger = 0.28,
      flipDuration = 0.55,
      flipStagger = 0.035,
      flipTick = 0.045,
      nightAmp = 0.11,
      nightDrift = 0.05,
      nightScale = 0.12,
      reshuffleEvery = 5.5,
      residueDepth = 0.85,
      residueLevel = 0.62,
      residueSpan = 0.25,
    } = tuning.motion;

    // 1) Static architecture.
    data.set(state.base);

    // 2) Night glass breathes on the sparse end of the ramp; the tarmac below
    //    the horizon carries a touch more light than the sky above it.
    const cells = state.glassCells;

    for (let i = 0; i < cells.length; i += 3) {
      const idx = cells[i] ?? 0;
      const x = cells[i + 1] ?? 0;
      const y = cells[i + 2] ?? 0;
      const ground = y > HORIZON_Y ? 0.02 : 0;
      const v = 0.02 + ground + nightAmp * fbm2(noise, x * nightScale + t * nightDrift, y * nightScale * 1.7 - t * nightDrift * 0.35, 2);
      data[idx] = clampWrite(v);
    }

    //    A faint steady horizon line out on the tarmac, three runway lights
    //    sitting on it. They twinkle, dimly — the airfield is alive.
    for (let x = WIN_X0 + 1; x < WIN_X1; x++) {
      if ((x - WIN_X0) % MULLION_STEP !== 0) {
        const idx = HORIZON_Y * COLS + x;
        const under = data[idx] ?? 0;
        data[idx] = clampWrite(Math.max(under, 0.16));
      }
    }

    for (const x of RUNWAY_DOT_XS) {
      data[HORIZON_Y * COLS + x] = clampWrite(0.5 + 0.08 * hash3(x, Math.floor(t * 2), 3));
    }

    // 3) Board events: single-row reshuffles, and the occasional full cascade.
    const interval = Math.max(0.5, reshuffleEvery);

    if (state.nextReshuffleAt < t - interval * 2) {
      state.nextReshuffleAt = t + interval * 0.5;
    }

    while (t >= state.nextReshuffleAt) {
      const r = state.reshuffleCursor % state.rows.length;
      fireRow(r, t);
      state.reshuffleCursor += 1;
      state.nextReshuffleAt += interval;
    }

    const cascadeInterval = Math.max(5, cascadeEvery);

    if (state.nextCascadeAt < t - cascadeInterval) {
      state.nextCascadeAt = t + cascadeInterval;
    }

    while (t >= state.nextCascadeAt) {
      for (let r = 0; r < state.rows.length; r++) {
        fireRow(r, t + r * Math.max(0, cascadeStagger) + 0.01);
      }

      state.nextCascadeAt += cascadeInterval;
    }

    // 4) Header clock: separators blink at 1Hz, seconds cells flip each second.
    const blinkOn = Math.floor(t) % 2 === 0;

    for (let c = CLOCK_C0; c <= CLOCK_C0 + 7; c++) {
      const idx = HEADER_Y * COLS + TEXT_X0 + c;

      if (c === CLOCK_C0 + 2 || c === CLOCK_C0 + 5) {
        data[idx] = blinkOn ? 0.7 : 0.2;
      } else if (c >= CLOCK_C0 + 6) {
        data[idx] = clampWrite(0.55 + 0.3 * hash3(Math.floor(t), c, 11));
      } else {
        data[idx] = 0.78;
      }
    }

    // 5) Data rows: settled cells show their line; cells inside the sweep
    //    window cycle through the ramp — the split-flap flip itself.
    const tick = Math.max(0.01, flipTick);
    const stagger = Math.max(0, flipStagger);
    const duration = Math.max(0.05, flipDuration);

    for (let r = 0; r < state.rows.length; r++) {
      const row = state.rows[r];

      if (!row) {
        continue;
      }

      const y = DATA_ROW_YS[r] ?? 10;
      const rowBase = y * COLS + TEXT_X0;

      for (let c = 0; c < TEXT_COLS; c++) {
        const prev = row.prev[c] ?? 0;
        const target = row.target[c] ?? 0;
        const start = row.flipStart + c * stagger;
        let v: number;

        if (t < start) {
          v = prev;
        } else if (t < start + duration && (prev > 0 || target > 0)) {
          v = 0.2 + 0.72 * hash3(r * 97 + c, Math.floor((t - start) / tick), row.flipSeed);
        } else {
          v = target;
        }

        data[rowBase + c] = v === 0 ? PANEL_BG : clampWrite(v);
      }
    }

    // 6) Residue shaping, pure in depth (so re-bloom retraces the same path):
    //    past the ramp-collapse band the level-2 ramp is two glyphs with a
    //    0.5 threshold, and 4x4 binning averages everything below it — the
    //    scene would forget itself to solid black. Instead the board panel
    //    lifts toward a luminance that survives the binning: what you
    //    remember of the gate is the board.
    const residue = Math.min(1, Math.max(0, (context.depth - residueDepth) / Math.max(0.05, residueSpan)));

    if (residue > 0) {
      const lift = clampWrite(residue * residueLevel);

      for (let y = BOARD_Y0; y <= BOARD_Y1; y++) {
        const rowBase = y * COLS;

        for (let x = BOARD_X0; x <= BOARD_X1; x++) {
          const idx = rowBase + x;
          const current = data[idx] ?? 0;

          if (current < lift) {
            data[idx] = lift;
          }
        }
      }
    }

    // 7) The runway beacon crosses the glass; sin^2 envelope so it never pops.
    const light = context.lights[0];

    if (light) {
      const period = Math.max(2, beaconPeriod);
      const phase = (((t % period) + period) % period) / period;
      const envelope = Math.sin(Math.PI * phase);
      light.x = WIN_X0 + 2 + phase * (WIN_X1 - WIN_X0 - 4);
      light.y = BEACON_Y;
      light.radius = Math.max(1, beaconRadius);
      light.intensity = Math.max(0, beaconIntensity) * envelope * envelope;
    }

    void dt; // scheduling is absolute-time based, so arbitrary sleep gaps are safe
  },
};

/** Board reshuffle: keep the old line ahead of the sweep, settle into a new one. */
function fireRow(r: number, startTime: number): void {
  const row = state.rows[r];

  if (!row) {
    return;
  }

  row.prev.set(row.target);
  state.eventCounter += 1;
  row.flipSeed = state.eventCounter;
  generateLine(row.target, r, state.eventCounter);
  row.flipStart = startTime;
}

/**
 * Deterministic board line, 76 board-local cells; 0 = blank flap (drawn as
 * PANEL_BG). Two kinds, weighted toward remnants — the last flight is gone:
 * a "remembered entry" (digit-pair time, dash-run destination, dim status
 * run) or an "emptied row" (the same column skeleton, sparse). No letterforms
 * — glyph texture only; the chapter prose is DOM beside the scene.
 */
function generateLine(target: Float32Array, rowIndex: number, event: number): void {
  target.fill(0);
  const rng = makeRng(rowIndex * 7919 + event * 104729 + 17);

  if (rng() < 0.55) {
    // Time column: two digit pairs around a dimmer separator.
    for (let c = 0; c <= TIME_C1; c++) {
      target[c] = c === 2 ? 0.42 : 0.62 + (rng() - 0.5) * 0.12;
    }

    // Destination column: one or two dash-runs of varying length.
    let c = DEST_C0;
    const segments = rng() < 0.4 ? 2 : 1;

    for (let s = 0; s < segments; s++) {
      const len = 6 + Math.floor(rng() * 12);

      for (let i = 0; i < len && c <= DEST_MAX; i++, c++) {
        target[c] = 0.66 + (rng() - 0.5) * 0.08;
      }

      c += 2 + Math.floor(rng() * 2);
    }

    // Status column: a single dim run — everything already departed.
    const statusLen = 5 + Math.floor(rng() * 8);

    for (let i = 0; i < statusLen && STATUS_C0 + i <= STATUS_MAX; i++) {
      target[STATUS_C0 + i] = 0.48 + (rng() - 0.5) * 0.06;
    }
  } else {
    // Emptied row: the same column skeleton, sparse and dim.
    for (const c of [0, 1, 3, 4]) {
      if (rng() < 0.8) {
        target[c] = 0.28;
      }
    }

    for (let c = DEST_C0; c <= DEST_MAX; c++) {
      if (rng() < 0.16) {
        target[c] = 0.28;
      }
    }

    for (let c = STATUS_C0; c <= STATUS_MAX; c++) {
      if (rng() < 0.16) {
        target[c] = 0.28;
      }
    }
  }
}

/** Static architecture, rebuilt on init: panel, window, room lines, seats. */
function buildBase(): Float32Array {
  const b = new Float32Array(COLS * ROWS);
  b.fill(0.035);

  for (let y = 0; y <= 3; y++) {
    b.fill(0.02, y * COLS, y * COLS + COLS);
  }

  // Floor plane: from the wall line forward, faintly lighter than the wall.
  for (let y = WALL_LINE_Y + 1; y < ROWS; y++) {
    b.fill(0.05, y * COLS, y * COLS + COLS);
  }

  // The two room lines that unify the islands: a quiet back-wall line (far,
  // first to be forgotten under compaction) and a firmer floor-front line
  // (near, it survives into bin-2 as a trace).
  for (let x = 4; x <= 188; x++) {
    b[WALL_LINE_Y * COLS + x] = 0.16;
    b[FLOOR_LINE_Y * COLS + x] = 0.42;
  }

  // Departure board panel.
  for (let y = BOARD_Y0; y <= BOARD_Y1; y++) {
    for (let x = BOARD_X0; x <= BOARD_X1; x++) {
      const edge = y === BOARD_Y0 || y === BOARD_Y1 || x === BOARD_X0 || x === BOARD_X1;
      b[y * COLS + x] = edge ? 0.48 : PANEL_BG;
    }
  }

  // Header labels over the three data columns (the clock block stays dynamic).
  const labelRuns: ReadonlyArray<readonly [number, number]> = [
    [0, TIME_C1],
    [DEST_C0, DEST_C0 + 10],
    [STATUS_C0, STATUS_C0 + 6],
  ];

  for (const [c0, c1] of labelRuns) {
    for (let c = c0; c <= c1; c++) {
      b[HEADER_Y * COLS + TEXT_X0 + c] = 0.8 - hash3(c, 5, 9) * 0.06;
    }
  }

  // The view through the glass: an empty jet bridge parked over the tarmac.
  // Static silhouette-grade structure (excluded from the per-frame night
  // noise in init), so the window resolves as a view instead of static:
  // a ribbed tube sloping down toward the rotunda, one support pylon to the
  // ground, and sparse taxiway dashes below the horizon.
  viewMask = new Uint8Array(COLS * ROWS);
  const view = (x: number, y: number, v: number): void => {
    b[y * COLS + x] = v;
    viewMask[y * COLS + x] = 1;
  };
  const TUBE_X0 = 112;
  const TUBE_X1 = 138;
  const tubeTopAt = (x: number): number => 20 + Math.round(((x - TUBE_X0) * 7) / (TUBE_X1 - TUBE_X0));

  for (let x = TUBE_X0; x <= TUBE_X1; x++) {
    const yTop = tubeTopAt(x);
    view(x, yTop, 0.42); // roof line
    view(x, yTop + 3, 0.38); // floor line

    // Tube body: dark solid (excluded from the glass noise, so the tube
    // reads as a mass) with brighter accordion ribs every third column.
    const rib = (x - TUBE_X0) % 3 === 0;
    view(x, yTop + 1, rib ? 0.3 : 0.16);
    view(x, yTop + 2, rib ? 0.3 : 0.16);
  }

  // Rotunda at the aircraft end, and its support pylon down to the tarmac.
  for (let y = 25; y <= 31; y++) {
    for (let x = TUBE_X1; x <= TUBE_X1 + 4; x++) {
      const edge = y === 25 || y === 31 || x === TUBE_X1 || x === TUBE_X1 + 4;
      view(x, y, edge ? 0.38 : 0.18);
    }
  }

  for (let y = 32; y <= HORIZON_Y; y++) {
    view(TUBE_X1 + 2, y, 0.32);
  }

  // Taxiway centerline dashes, converging quietly toward the runway lights.
  for (let x = 116; x <= 158; x += 4) {
    view(x, 39, 0.17);
  }

  for (let x = 128; x <= 174; x += 5) {
    view(x, 41, 0.15);
  }

  // Window frame + mullions.
  for (let x = WIN_X0; x <= WIN_X1; x++) {
    b[WIN_Y0 * COLS + x] = 0.4;
    b[WIN_Y1 * COLS + x] = 0.4;
  }

  for (let x = WIN_X0; x <= WIN_X1; x += MULLION_STEP) {
    for (let y = WIN_Y0; y <= WIN_Y1; y++) {
      b[y * COLS + x] = 0.4;
    }

    // Faint mullion reflections just past the wall line, on the floor.
    for (let y = WALL_LINE_Y + 1; y <= WALL_LINE_Y + 4 && y < ROWS; y++) {
      b[y * COLS + x] = Math.max(b[y * COLS + x] ?? 0, 0.12 - (y - WALL_LINE_Y - 1) * 0.02);
    }
  }

  // Two linked rows of empty seats facing the glass, two banks per row.
  for (const rowSpec of SEAT_ROWS_SPEC) {
    for (const bankX0 of rowSpec.banks) {
      drawSeatBank(b, bankX0, rowSpec.yTop, rowSpec.legsTo);
    }
  }

  return b;
}

/**
 * One bank of linked seats: back-rest band with a bright top edge, seat pan,
 * a continuous rail linking every unit, armrest verticals at unit boundaries,
 * and legs dropping toward the floor.
 */
function drawSeatBank(b: Float32Array, x0: number, yTop: number, legsTo: number): void {
  const x1 = x0 + SEAT_UNITS * SEAT_UNIT_W;

  for (let u = 0; u < SEAT_UNITS; u++) {
    const ux = x0 + u * SEAT_UNIT_W;

    for (let x = ux + 1; x < ux + SEAT_UNIT_W; x++) {
      b[yTop * COLS + x] = 0.42; // top edge of the back rest
      b[(yTop + 1) * COLS + x] = 0.14; // back-rest body, dotted open weave
      b[(yTop + 2) * COLS + x] = 0.14;
      b[(yTop + 3) * COLS + x] = 0.34; // seat pan
    }
  }

  // The linking rail: one continuous line under every pan in the bank.
  for (let x = x0; x <= x1; x++) {
    b[(yTop + 4) * COLS + x] = 0.4;
  }

  // Armrest verticals at every unit boundary, rising through the back band.
  for (let u = 0; u <= SEAT_UNITS; u++) {
    const ax = x0 + u * SEAT_UNIT_W;

    for (let y = yTop; y <= yTop + 4; y++) {
      b[y * COLS + ax] = 0.62;
    }
  }

  // Legs at every other boundary, from the rail toward the floor.
  for (let u = 0; u <= SEAT_UNITS; u += 2) {
    const lx = x0 + u * SEAT_UNIT_W;

    for (let y = yTop + 5; y <= legsTo && y < ROWS; y++) {
      b[y * COLS + lx] = 0.16;
    }
  }
}

function clampWrite(v: number): number {
  return v <= 0 ? 0 : v >= 0.98 ? 0.98 : v;
}

function hash3(a: number, b: number, c: number): number {
  let h = (Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function makeRng(seed: number): () => number {
  let s = seed | 0;

  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
