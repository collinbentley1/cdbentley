/**
 * Scene 1 — "beach". The opening: shore, not water.
 *
 * Tide lines, and the name written in the sand. The swash rushes up the
 * foreshore, washes characters away, and the sand redraws them — memory,
 * loss, restoration in the first five seconds, wordless.
 *
 * The sim writes luminance only (SDK contract). Bands, top to bottom: dry
 * sand (static grain, tide-line deposits, and the contact-block anchor
 * region — never washed at depth <= 0), the foreshore where the name lives,
 * then open water breathing on the sparse end of the ramp. Scrolling begins
 * the undertow: context.depth lifts the waterline up the grid, and lowers it
 * again on scroll-up — a pure function of depth, like compaction itself.
 *
 * All hand-tunables live in tuning.motion (live-editable in the harness).
 */

import { cellIndex, createValueNoise, fbm2 } from "../../sdk/index.ts";
import type { SceneContext, SceneModule } from "../../sdk/index.ts";
import { CONTACT_REGION } from "./contact-links.ts";
import { buildNameMask, NAME_TEXT, type NameMask } from "./name-glyphs.ts";

const noiseGrain = createValueNoise(21);
const noiseWater = createValueNoise(22);
const noiseChop = createValueNoise(23);
const noiseHash = createValueNoise(24);

/** Deterministic decorrelated random in [0, 1] from two coordinates. */
function rand01(a: number, b: number): number {
  return noiseHash(a * 12.9898 + 0.517, b * 7.771 + 0.331);
}

// Fixed internals (not tunables): spatial scales and long time constants.
const WATER_SCALE = 0.05;
const CHOP_SCALE = 0.045;
const CHOP_SPEED = 0.35;
const DEPOSIT_TAU_SAND = 30;
const DEPOSIT_TAU_WATER = 1.6;
const SHORE_FRAC = 0.74;
const NAME_Y_FRAC = 0.38;
const SWEEP_BAND = 14;
const SWEEP_PAD = 18;

interface BeachState {
  biasCycle: number;
  cols: number;
  deposit: Float32Array;
  edgeRow: Float32Array;
  grain: Float32Array;
  letterBias: Float32Array;
  mask: NameMask;
  maskScale: number;
  minEdgeRow: number;
  nameIndex: Int32Array;
  prevCycle: number;
  prevU: number;
  rows: number;
  strength: Float32Array;
  wet: Float32Array;
}

let state: BeachState | null = null;

function buildMaskState(s: BeachState, scale: number): void {
  s.mask = buildNameMask(NAME_TEXT, s.cols, s.rows, scale, NAME_Y_FRAC, (x, y) => rand01(x * 7.13 + 0.31, y * 5.77 + 0.83));
  s.maskScale = scale;
  s.strength = new Float32Array(s.mask.cells.length).fill(1);
  s.letterBias = new Float32Array(s.mask.letterCount).fill(1);
  s.biasCycle = -1;
  s.nameIndex = new Int32Array(s.cols * s.rows);

  for (let c = 0; c < s.mask.cells.length; c++) {
    const cell = s.mask.cells[c];

    if (cell) {
      s.nameIndex[cell.y * s.cols + cell.x] = c + 1;
    }
  }
}

function createState(cols: number, rows: number, tideAmp: number, nameScale: number): BeachState {
  const grain = new Float32Array(cols * rows);
  const deposit = new Float32Array(cols * rows);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const g = fbm2(noiseGrain, x * 0.32, y * 0.32, 2);
      let v = 0.03 + g * g * 0.11;

      if (noiseGrain(x * 7.9 + 2.2, y * 7.9 + 1.1) > 0.965) {
        v += 0.06;
      }

      grain[y * cols + x] = v;
    }
  }

  // Seed a few faint historic tide lines so the opening frame already reads
  // as a shore that has been remembering and forgetting for a while.
  const base = rows * SHORE_FRAC;

  for (const [line, frac] of [0.9, 0.68, 0.5].entries()) {
    const y = Math.floor(base - tideAmp * (frac ?? 0));

    if (y < 0 || y >= rows) {
      continue;
    }

    for (let x = 0; x < cols; x++) {
      const r = rand01(x * 2.13 + 0.7, line * 3.7 + 0.2);

      if (r > 0.45) {
        deposit[y * cols + x] = 0.25 + 0.35 * r;
      }
    }
  }

  const s: BeachState = {
    biasCycle: -1,
    cols,
    deposit,
    edgeRow: new Float32Array(cols).fill(rows),
    grain,
    letterBias: new Float32Array(0),
    mask: { cells: [], height: 0, letterCount: 0, width: 0, x0: 0, y0: 0 },
    maskScale: 0,
    minEdgeRow: rows,
    nameIndex: new Int32Array(0),
    prevCycle: -1,
    prevU: 0,
    rows,
    strength: new Float32Array(0),
    wet: new Float32Array(cols * rows),
  };

  buildMaskState(s, nameScale);

  return s;
}

export const scene: SceneModule = {
  dockGlyph: [
    "·  ·   ·  · ",
    " C·LL·N ··  ",
    "·~·~·~·~·~·~",
    "~≈~≈≈~≈~≈≈~≈",
    "≈≈~≈≈≈~≈≈≈~≈",
    "≈≈≈≈≈≈≈≈≈≈≈≈",
  ],
  id: "beach",
  init(context: SceneContext): void {
    const { tideAmp = 22, nameScale = 2 } = this.tuning.motion;
    state = createState(context.buffer.width, context.buffer.height, tideAmp, nameScale);
  },
  summaryChip: "TODO(collin): one-line beach summary",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 200,
    minimalGlyph: "·",
    motion: {
      chopAmp: 2.2,
      contactMarker: 1,
      erodeRate: 0.55,
      foamWidth: 2,
      nameInk: 0.82,
      nameScale: 2,
      redrawPeriod: 11,
      redrawRate: 2.6,
      rushFrac: 0.26,
      surgeVar: 0.7,
      tideAmp: 22,
      tidePeriod: 7,
      undertowRate: 0.5,
      waterContrast: 0.2,
      waterDrift: 0.12,
      wetTau: 6,
    },
    ramp: " ·:~≈=+*#@",
    rows: 90,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, depth, time } = context;
    const cols = buffer.width;
    const rows = buffer.height;

    if (!state || state.cols !== cols || state.rows !== rows) {
      const { tideAmp: amp = 22, nameScale: scale = 2 } = this.tuning.motion;
      state = createState(cols, rows, amp, scale);
    }

    const s = state;
    const {
      chopAmp = 2.2,
      contactMarker = 1,
      erodeRate = 0.55,
      foamWidth = 2,
      nameInk = 0.82,
      nameScale = 2,
      redrawPeriod = 11,
      redrawRate = 2.6,
      rushFrac = 0.26,
      surgeVar = 0.7,
      tideAmp = 22,
      tidePeriod = 7,
      undertowRate = 0.5,
      waterContrast = 0.2,
      waterDrift = 0.12,
      wetTau = 6,
    } = this.tuning.motion;

    const requestedScale = Math.max(1, Math.round(nameScale));

    if (requestedScale !== s.maskScale) {
      buildMaskState(s, requestedScale);
    }

    // --- Tide phase: one swash per period; fast rush up, slow retreat. ---
    const period = Math.max(0.5, tidePeriod);
    const rush = Math.min(0.9, Math.max(0.05, rushFrac));
    const cycle = Math.floor(time / period);
    const u = time / period - cycle;
    // The opening swash is deliberately gentle: the visitor gets the intact
    // name for a few seconds before the tide first reaches it.
    const surge = cycle < 1 ? 1 - surgeVar * 0.5 : 1 + surgeVar * (rand01(cycle * 1.7 + 0.13, 4.29) - 0.5);
    const amp = tideAmp * surge;
    let envelope: number;

    if (u < rush) {
      const p = u / rush;
      envelope = p * (2 - p);
    } else {
      const p = 1 - (u - rush) / (1 - rush);
      envelope = p * p * (3 - 2 * p);
    }

    const advancing = u < rush;
    const base = rows * SHORE_FRAC;
    // The undertow lifts the waterline with depth but the swash edge stays
    // pinned on-grid: sinking, the surface is the last thing that resolves —
    // and it is what survives binning as the compacted residue.
    const undertow = Math.min(Math.max(0, depth) * rows * undertowRate, base - amp - 3);
    let minEdge = rows;

    for (let x = 0; x < cols; x++) {
      const chop = (fbm2(noiseChop, x * CHOP_SCALE, time * CHOP_SPEED, 2) - 0.5) * chopAmp;
      const edge = base - amp * envelope - undertow + chop;
      s.edgeRow[x] = edge;

      if (edge < minEdge) {
        minEdge = edge;
      }
    }

    s.minEdgeRow = minEdge;

    // Deposit a dashed tide line at the swash's highest reach (rush -> retreat
    // turn). These accumulate and fade — the shore's own memory of the tide.
    if (cycle === s.prevCycle && s.prevU < rush && u >= rush) {
      for (let x = 0; x < cols; x++) {
        const y = Math.floor(s.edgeRow[x] ?? rows);

        if (y >= 0 && y < rows && rand01(x * 3.1 + 0.7, cycle * 5.3 + 0.2) > 0.35) {
          const idx = y * cols + x;
          const current = s.deposit[idx] ?? 0;
          s.deposit[idx] = current > 0.45 ? 1 : current + 0.55;
        }
      }
    }

    s.prevCycle = cycle;
    s.prevU = u;

    // --- The name: the tide erases characters; the sand redraws them. ---
    if (s.biasCycle !== cycle) {
      for (let li = 0; li < s.letterBias.length; li++) {
        s.letterBias[li] = 0.4 + 1.2 * rand01(li * 9.17 + 0.5, cycle * 13.7 + 0.25);
      }

      s.biasCycle = cycle;
    }

    const sweepSpan = s.mask.width + 2 * SWEEP_PAD;
    const sweepPeriod = Math.max(1, redrawPeriod);
    const sweepX = s.mask.x0 - SWEEP_PAD + (time / sweepPeriod - Math.floor(time / sweepPeriod)) * sweepSpan;

    for (let c = 0; c < s.mask.cells.length; c++) {
      const cell = s.mask.cells[c];

      if (!cell) {
        continue;
      }

      let st = s.strength[c] ?? 0;

      if (cell.y >= (s.edgeRow[cell.x] ?? rows)) {
        st -= erodeRate * dt * (0.55 + 0.9 * cell.r) * (s.letterBias[cell.letter] ?? 1);
      } else if (cell.x <= sweepX && cell.x >= sweepX - SWEEP_BAND) {
        st += redrawRate * dt;
      }

      s.strength[c] = st < 0 ? 0 : st > 1 ? 1 : st;
    }

    // --- Paint: dry sand / wet sand / foam edge / breathing water. ---
    const wetF = Math.exp(-dt / Math.max(0.1, wetTau));
    const depSandF = Math.exp(-dt / DEPOSIT_TAU_SAND);
    const depWaterF = Math.exp(-dt / DEPOSIT_TAU_WATER);
    const foamBase = advancing ? 0.82 : 0.42;
    const octaves = depth > 0.8 ? 1 : 2;
    // Slight luminance lift in deep water so the binned/simplified residue
    // keeps sparse wave texture instead of draining to pure black.
    const deepLift = depth > 0.6 ? Math.min(0.14, (depth - 0.6) * 0.15) : 0;
    const marker = contactMarker > 0.5;
    const cx0 = Math.round(CONTACT_REGION.xFrac * cols);
    const cx1 = Math.round((CONTACT_REGION.xFrac + CONTACT_REGION.wFrac) * cols);
    const cy0 = Math.round(CONTACT_REGION.yFrac * rows);
    const cy1 = Math.round((CONTACT_REGION.yFrac + CONTACT_REGION.hFrac) * rows);
    const data = buffer.data;
    let i = cellIndex(buffer, 0, 0);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, i++) {
        const edge = s.edgeRow[x] ?? rows;
        let v: number;

        if (y < edge) {
          const w = (s.wet[i] ?? 0) * wetF;
          s.wet[i] = w;
          const dep = (s.deposit[i] ?? 0) * depSandF;
          s.deposit[i] = dep;
          v = (s.grain[i] ?? 0) + w * 0.12 + dep * 0.18;
          const ni = s.nameIndex[i] ?? 0;

          if (ni > 0) {
            const ink = (s.strength[ni - 1] ?? 0) * nameInk;

            if (ink > v) {
              v = ink;
            }
          }

          if (
            marker &&
            y >= cy0 &&
            y <= cy1 &&
            x >= cx0 &&
            x <= cx1 &&
            (x === cx0 || x === cx1 || y === cy0 || y === cy1) &&
            ((x + y) & 1) === 0 &&
            v < 0.15
          ) {
            v = 0.15;
          }
        } else {
          s.wet[i] = 1;
          s.deposit[i] = (s.deposit[i] ?? 0) * depWaterF;
          const below = y - edge;

          if (below < foamWidth) {
            v = foamBase + 0.18 * noiseWater(x * 0.31 + time * 1.9, y * 0.7);
          } else {
            const gradient = below * 0.004;
            v =
              0.15 +
              deepLift +
              fbm2(noiseWater, x * WATER_SCALE + time * waterDrift, y * WATER_SCALE * 1.6 - time * waterDrift * 0.45, octaves) *
                waterContrast +
              (gradient > 0.1 ? 0.1 : gradient);
            const ni = s.nameIndex[i] ?? 0;

            if (ni > 0) {
              v += (s.strength[ni - 1] ?? 0) * 0.1;
            }
          }
        }

        data[i] = v < 0 ? 0 : v > 1 ? 1 : v;
      }
    }
  },
};

/** Test/tuning taps — not part of the SDK contract. */
export const beachDebug = {
  /** Mean drawn strength of the name cells, [0, 1]. */
  meanNameStrength(): number {
    if (!state || state.strength.length === 0) {
      return 0;
    }

    let sum = 0;

    for (let c = 0; c < state.strength.length; c++) {
      sum += state.strength[c] ?? 0;
    }

    return sum / state.strength.length;
  },
  /** Highest row (smallest y) the water reached in the last update. */
  minEdgeRowLastFrame(): number {
    return state ? state.minEdgeRow : Number.POSITIVE_INFINITY;
  },
};
