/**
 * Scene 6 — "airport-gate": an airport gate, last flight gone.
 *
 * The one idiomatic motion is the departure board reshuffling: a board cell's
 * luminance sweeping through the ramp IS the split-flap flip — the flap
 * animation and the site's epistemic ink are literally the same mechanism,
 * no skeuomorphism. Around it, a diorama: night glass breathing on the
 * sparse end of the ramp, a runway beacon (one LightSource) crossing the
 * window, empty seat rows, and a kiosk slot where a directory-listing bitmap
 * renders AS ASCII and cures into a receipt chip docked under the board.
 *
 * Claim slots (Phase C, DOM prose beside this scene — NOT rendered here):
 * FACTS S3 + F4, BULLETPROOF at grade (the pivot, first ChatGPT app merged in
 * 27 days, the OpenAI-approved directory listing). C14 governs the screenshot
 * receipt: the real asset is Collin's and absent tonight — receipt.ts ships a
 * clearly-fake placeholder behind the same pipeline. All human-readable copy
 * stays TODO(collin).
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule, type SceneTuning } from "../../sdk/index.ts";
import { makeFakeDirectoryListing, type LuminancePatch } from "./receipt.ts";

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

// Window band (right): mullions, breathing night glass, horizon dots.
const WIN_X0 = 108;
const WIN_X1 = 186;
const WIN_Y0 = 5;
const WIN_Y1 = 44;
const MULLION_STEP = 13;
const HORIZON_Y = 36;
const BEACON_Y = 30;

// Empty seat rows facing the glass.
const SEAT_YS = [52, 60] as const;

// Receipt kiosk: the slot where the listing renders as ASCII (C14 pipeline).
const KIOSK_X0 = 112;
const KIOSK_X1 = 179;
const KIOSK_Y0 = 48;
const KIOSK_Y1 = 73;
const SLOT_X0 = 114;
const SLOT_Y0 = 50;
const SLOT_W = 64;
const SLOT_H = 22;

// Receipt chip dock, under the board (Phase C anchors S3/F4 claim prose here).
const CHIP_X0 = 84;
const CHIP_Y0 = 26;
const CHIP_W = 12;
const CHIP_H = 3;

const FLOOR_Y0 = 74;
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
  chipLit: boolean;
  dotXs: number[];
  eventCounter: number;
  /** Packed [bufferIndex, x, y] triples for glass cells (noise per frame). */
  glassCells: Int32Array;
  nextCascadeAt: number;
  nextReshuffleAt: number;
  patch: LuminancePatch;
  reshuffleCursor: number;
  rows: BoardRow[];
}

let state: SceneState = {
  base: new Float32Array(0),
  chipLit: false,
  dotXs: [],
  eventCounter: 0,
  glassCells: new Int32Array(0),
  nextCascadeAt: 0,
  nextReshuffleAt: 0,
  patch: { data: new Float32Array(1), height: 1, width: 1 },
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
    condenseDur: 1.6,
    cureCycle: 18,
    flipDuration: 0.55,
    flipStagger: 0.035,
    flipTick: 0.045,
    holdDur: 5,
    nightAmp: 0.11,
    nightDrift: 0.05,
    nightScale: 0.12,
    reshuffleEvery: 5.5,
    residueDepth: 0.9,
    residueLevel: 0.62,
    residueSpan: 0.4,
    resolveDur: 3,
  },
  ramp: " ·:~-=+*#%@",
  rows: ROWS,
};

export const scene: SceneModule = {
  dockGlyph: [
    " ========== ",
    " =%*+-:· ·= ",
    " =· :+*%··= ",
    " ========== ",
    "     ||     ",
    "   ·:||:·   ",
  ],
  id: "airport-gate",
  init(context: SceneContext): void {
    state = {
      base: buildBase(),
      chipLit: false,
      dotXs: [],
      eventCounter: 0,
      glassCells: new Int32Array(0),
      nextCascadeAt: Math.max(10, tuning.motion.cascadeEvery ?? 47),
      nextReshuffleAt: 2.5,
      patch: makeFakeDirectoryListing(SLOT_W, SLOT_H, 42),
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
    const triples: number[] = [];

    for (let y = WIN_Y0 + 1; y < WIN_Y1; y++) {
      for (let x = WIN_X0 + 1; x < WIN_X1; x++) {
        if ((x - WIN_X0) % MULLION_STEP !== 0) {
          triples.push(y * COLS + x, x, y);
        }
      }
    }

    state.glassCells = Int32Array.from(triples);

    // Sparse static runway lights on the horizon (they twinkle, dimly).
    for (let x = WIN_X0 + 1; x < WIN_X1; x++) {
      if ((x - WIN_X0) % MULLION_STEP !== 0 && hash3(x, 77, 1) < 0.12) {
        state.dotXs.push(x);
      }
    }

    // The runway beacon is the scene's single light source.
    context.lights.splice(0, context.lights.length);
    context.lights.push({ intensity: 0, radius: 7, x: WIN_X0 + 2, y: BEACON_Y });
  },
  summaryChip: "TODO(collin): airport-gate summary chip (one line; ground in FACTS S3/F4)",
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
      condenseDur = 1.6,
      cureCycle = 18,
      flipDuration = 0.55,
      flipStagger = 0.035,
      flipTick = 0.045,
      holdDur = 5,
      nightAmp = 0.11,
      nightDrift = 0.05,
      nightScale = 0.12,
      reshuffleEvery = 5.5,
      residueDepth = 0.9,
      residueLevel = 0.62,
      residueSpan = 0.4,
      resolveDur = 3,
    } = tuning.motion;

    // 1) Static architecture.
    data.set(state.base);

    // 2) Night glass breathes on the sparse end of the ramp.
    const cells = state.glassCells;

    for (let i = 0; i < cells.length; i += 3) {
      const idx = cells[i] ?? 0;
      const x = cells[i + 1] ?? 0;
      const y = cells[i + 2] ?? 0;
      const v = 0.02 + nightAmp * fbm2(noise, x * nightScale + t * nightDrift, y * nightScale * 1.7 - t * nightDrift * 0.35, 2);
      data[idx] = clampWrite(v);
    }

    for (const x of state.dotXs) {
      data[HORIZON_Y * COLS + x] = clampWrite(0.26 + 0.08 * hash3(x, Math.floor(t * 2), 3));
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

    // 6) Receipt slot: shimmer -> scanline resolve (cells flip in, same move
    //    as the board) -> hold -> condense into the chip under the board.
    const cycle = Math.max(1, cureCycle);
    const u = ((t % cycle) + cycle) % cycle;
    const rDur = Math.max(0.2, resolveDur);
    const hEnd = rDur + Math.max(0, holdDur);
    const cEnd = hEnd + Math.max(0.2, condenseDur);
    const patch = state.patch;

    if (u < rDur) {
      const scan = (u / rDur) * (SLOT_H + 4) - 2;

      for (let j = 0; j < SLOT_H; j++) {
        const rowBase = (SLOT_Y0 + j) * COLS + SLOT_X0;
        const d = scan - j;

        for (let i = 0; i < SLOT_W; i++) {
          const pv = patch.data[j * SLOT_W + i] ?? 0;
          let v: number;

          if (d <= 0) {
            v = shimmer(i, j, t);
          } else if (d < 3 && pv > 0.18) {
            v = 0.2 + 0.7 * hash3(i, j * 131, Math.floor(t / tick));
          } else if (d < 3) {
            v = pv * (d / 3);
          } else {
            v = pv;
          }

          data[rowBase + i] = clampWrite(v);
        }
      }

      drawChipIfLit(data);
    } else if (u < hEnd) {
      for (let j = 0; j < SLOT_H; j++) {
        const rowBase = (SLOT_Y0 + j) * COLS + SLOT_X0;

        for (let i = 0; i < SLOT_W; i++) {
          data[rowBase + i] = clampWrite(patch.data[j * SLOT_W + i] ?? 0);
        }
      }

      drawChipIfLit(data);
    } else if (u < cEnd) {
      // Condense: the listing collapses along a straight path into the chip.
      // (Phase C pairs the real dock move with createDockAnimation + the one
      // accent color; tonight this stays luminance-only by decree.)
      const s = (u - hEnd) / (cEnd - hEnd);
      const e = s * s * (3 - 2 * s);

      for (let j = 0; j < SLOT_H; j++) {
        const rowBase = (SLOT_Y0 + j) * COLS + SLOT_X0;

        for (let i = 0; i < SLOT_W; i++) {
          data[rowBase + i] = clampWrite(shimmer(i, j, t) * (1 - e));
        }
      }

      drawChipIfLit(data);

      const rx = Math.round(SLOT_X0 + (CHIP_X0 - SLOT_X0) * e);
      const ry = Math.round(SLOT_Y0 + (CHIP_Y0 - SLOT_Y0) * e);
      const rw = Math.max(CHIP_W, Math.round(SLOT_W + (CHIP_W - SLOT_W) * e));
      const rh = Math.max(CHIP_H, Math.round(SLOT_H + (CHIP_H - SLOT_H) * e));

      for (let cy = 0; cy < rh; cy++) {
        const y = ry + cy;

        if (y < 0 || y >= ROWS) {
          continue;
        }

        const sj = Math.min(SLOT_H - 1, Math.floor(((cy + 0.5) / rh) * SLOT_H));

        for (let cx = 0; cx < rw; cx++) {
          const x = rx + cx;

          if (x < 0 || x >= COLS) {
            continue;
          }

          const si = Math.min(SLOT_W - 1, Math.floor(((cx + 0.5) / rw) * SLOT_W));
          const pv = patch.data[sj * SLOT_W + si] ?? 0;
          data[y * COLS + x] = clampWrite(pv + (0.88 - pv) * e);
        }
      }
    } else {
      state.chipLit = true;

      for (let j = 0; j < SLOT_H; j++) {
        const rowBase = (SLOT_Y0 + j) * COLS + SLOT_X0;

        for (let i = 0; i < SLOT_W; i++) {
          data[rowBase + i] = clampWrite(shimmer(i, j, t));
        }
      }

      drawChip(data, clampWrite(0.84 + 0.05 * Math.sin(t * 2.5)));
    }

    // 7) Residue shaping, pure in depth (so re-bloom retraces the same path):
    //    past the ramp-collapse band the level-2 ramp is two glyphs with a
    //    0.5 threshold, and 4x4 binning averages everything below it — the
    //    scene would forget itself to solid black. Instead the board panel
    //    and the docked receipt lift toward a luminance that survives the
    //    binning: what you remember of the gate is the board and the receipt.
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

      const chipLift = clampWrite(residue * 0.88);

      for (let y = CHIP_Y0; y < CHIP_Y0 + CHIP_H; y++) {
        const rowBase = y * COLS;

        for (let x = CHIP_X0; x < CHIP_X0 + CHIP_W; x++) {
          const idx = rowBase + x;
          const current = data[idx] ?? 0;

          if (current < chipLift) {
            data[idx] = chipLift;
          }
        }
      }
    }

    // 8) The runway beacon crosses the glass; sin^2 envelope so it never pops.
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
 * a "remembered entry" (time / destination / flight / gate dashes / a dim
 * status run) or an "emptied row" (sparse dashes). No letterforms — glyph
 * texture only; real copy is Phase C DOM and TODO(collin).
 */
function generateLine(target: Float32Array, rowIndex: number, event: number): void {
  target.fill(0);
  const rng = makeRng(rowIndex * 7919 + event * 104729 + 17);

  if (rng() < 0.55) {
    for (let c = 0; c <= 4; c++) {
      target[c] = c === 2 ? 0.5 : 0.62 + (rng() - 0.5) * 0.08;
    }

    let c = 7;
    const words = 1 + (rng() < 0.45 ? 1 : 0);

    for (let w = 0; w < words; w++) {
      const len = 3 + Math.floor(rng() * 7);

      for (let i = 0; i < len && c < 31; i++, c++) {
        target[c] = 0.66 + (rng() - 0.5) * 0.1;
      }

      c += 2;
    }

    for (let f = 33; f <= 39; f++) {
      target[f] = f === 35 ? 0.5 : 0.6 + (rng() - 0.5) * 0.08;
    }

    for (let g = 42; g <= 46; g++) {
      if (rng() < 0.6) {
        target[g] = 0.3;
      }
    }

    const len = 6 + Math.floor(rng() * 8);

    for (let i = 0; i < len && 50 + i < TEXT_COLS; i++) {
      target[50 + i] = 0.5 + (rng() - 0.5) * 0.06;
    }
  } else {
    for (const c of [0, 1, 3, 4]) {
      target[c] = 0.3;
    }

    for (let c = 7; c <= 30; c++) {
      if (rng() < 0.22) {
        target[c] = 0.3;
      }
    }

    for (let c = 33; c <= 39; c++) {
      if (rng() < 0.3) {
        target[c] = 0.3;
      }
    }

    for (let c = 50; c <= 63; c++) {
      if (rng() < 0.18) {
        target[c] = 0.3;
      }
    }
  }
}

/** Static architecture, rebuilt on init: panel, window, seats, kiosk, floor. */
function buildBase(): Float32Array {
  const b = new Float32Array(COLS * ROWS);
  b.fill(0.035);

  for (let y = 0; y <= 3; y++) {
    b.fill(0.02, y * COLS, y * COLS + COLS);
  }

  for (let y = FLOOR_Y0; y < ROWS; y++) {
    b.fill(Math.max(0.02, 0.07 - (y - FLOOR_Y0) * 0.005), y * COLS, y * COLS + COLS);
  }

  // Departure board panel.
  for (let y = BOARD_Y0; y <= BOARD_Y1; y++) {
    for (let x = BOARD_X0; x <= BOARD_X1; x++) {
      const edge = y === BOARD_Y0 || y === BOARD_Y1 || x === BOARD_X0 || x === BOARD_X1;
      b[y * COLS + x] = edge ? 0.48 : PANEL_BG;
    }
  }

  // Header column labels (static blocks; the clock block stays dynamic).
  const labelRuns: ReadonlyArray<readonly [number, number]> = [
    [0, 4],
    [7, 17],
    [33, 39],
    [50, 57],
  ];

  for (const [c0, c1] of labelRuns) {
    for (let c = c0; c <= c1; c++) {
      b[HEADER_Y * COLS + TEXT_X0 + c] = 0.8 - hash3(c, 5, 9) * 0.06;
    }
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

    // Faint mullion reflections on the floor.
    for (let y = FLOOR_Y0; y <= FLOOR_Y0 + 3 && y < ROWS; y++) {
      b[y * COLS + x] = 0.1 - (y - FLOOR_Y0) * 0.02;
    }
  }

  // Two rows of empty seats facing the glass.
  for (const sy of SEAT_YS) {
    for (let ux = 18; ux + 4 <= 96; ux += 7) {
      for (let y = sy; y <= sy + 2; y++) {
        for (let x = ux; x <= ux + 4; x++) {
          b[y * COLS + x] = y === sy ? 0.42 : 0.3;
        }
      }

      b[(sy + 3) * COLS + ux + 1] = 0.18;
      b[(sy + 3) * COLS + ux + 3] = 0.18;
    }
  }

  // Receipt kiosk frame + dark screen.
  for (let y = KIOSK_Y0; y <= KIOSK_Y1; y++) {
    for (let x = KIOSK_X0; x <= KIOSK_X1; x++) {
      const edge = y === KIOSK_Y0 || y === KIOSK_Y1 || x === KIOSK_X0 || x === KIOSK_X1;
      b[y * COLS + x] = edge ? 0.42 : 0.05;
    }
  }

  return b;
}

/** Faint static in the kiosk slot when nothing is resolved there. */
function shimmer(i: number, j: number, t: number): number {
  return 0.03 + 0.05 * hash3(i, j, Math.floor(t * 8));
}

function drawChip(data: Float32Array, level: number): void {
  for (let y = CHIP_Y0; y < CHIP_Y0 + CHIP_H; y++) {
    for (let x = CHIP_X0; x < CHIP_X0 + CHIP_W; x++) {
      data[y * COLS + x] = level;
    }
  }
}

/** Once cured, the docked chip stays dimly lit through later cycles. */
function drawChipIfLit(data: Float32Array): void {
  if (state.chipLit) {
    drawChip(data, 0.5);
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
