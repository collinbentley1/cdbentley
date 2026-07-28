/**
 * Scene 1 — "beach". The opening: shore, not water.
 *
 * Tide lines, and the name written in the sand. The swash glides up the
 * foreshore in slow, long-wavelength tongues — calm, never a straight
 * front — washes characters away where it lingers, and the sand redraws
 * them: memory, loss, restoration in the first minute, wordless.
 *
 * The water is the craft of this scene. The edge is shaped by slow lobes
 * (low-frequency drift) with only a whisper of ripple; the front is a
 * broken foam LACE, not a stripe; a feathered wet sheen melds the sand
 * into the water; the body carries soft swell bands and sparse glints; the
 * name ghosts through the lace and fades under shallow water rather than
 * fighting the edge.
 *
 * Restoration is seeded, not swept: a per-page-load random seed plus
 * per-cycle anchors make each letter regrow outward from a different
 * anchor cell, letters in a different order every wash — computed by the
 * browser, never the same twice, always organic.
 *
 * Portrait viewports stack the name on two lines at full scale so a phone
 * reads it instantly; the composition is all fractions, so the same sim
 * fills either frame. Scrolling begins the undertow: context.depth lifts
 * the waterline up the grid and lowers it again on scroll-up — a pure
 * function of depth, like compaction itself.
 *
 * All hand-tunables live in tuning.motion (live-editable in the harness).
 */

import { cellIndex, createValueNoise, fbm2 } from "../../sdk/index.ts";
import type { SceneContext, SceneModule } from "../../sdk/index.ts";
import { buildNameMask, NAME_LINES_TALL, NAME_LINES_WIDE, type NameMask } from "./name-glyphs.ts";

const noiseGrain = createValueNoise(21);
const noiseWater = createValueNoise(22);
const noiseChop = createValueNoise(23);
const noiseHash = createValueNoise(24);

/**
 * Grid choice, made once at module load (the descent mounts each scene once).
 * Landscape keeps the wide 200x90 shore; portrait trades width for height so
 * the 390px-class first fold is mostly scene instead of letterbox. Tests run
 * without a window and always get the landscape grid (deterministic).
 */
const PORTRAIT = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(orientation: portrait)").matches;

/** Deterministic decorrelated random in [0, 1] from two coordinates. */
function rand01(a: number, b: number): number {
  return noiseHash(a * 12.9898 + 0.517, b * 7.771 + 0.331);
}

// Fixed internals (not tunables): spatial scales and long time constants.
const WATER_SCALE = 0.05;
const LOBE_DRIFT = 0.045;
const RIPPLE_SCALE = 0.05;
const RIPPLE_SPEED = 0.22;
const DEPOSIT_TAU_SAND = 30;
const DEPOSIT_TAU_WATER = 1.6;
/** The quiet band: name bbox + this margin, in cells (brief: 2). */
const QUIET_MARGIN = 2;
/** Feather width outside the band so the carve has no hard seam. */
const QUIET_FEATHER = 4;

interface BeachState {
  biasCycle: number;
  /** Per-mask-cell restoration delay for the current bloom epoch, seconds. */
  cellDelay: Float32Array;
  cols: number;
  deposit: Float32Array;
  edgeRow: Float32Array;
  /** Bloom epoch start time; -1 before the first wash turns. */
  epochStart: number;
  grain: Float32Array;
  letterBias: Float32Array;
  /** cells[] index range per letter: letter li spans [start[li], start[li+1]). */
  letterStart: Int32Array;
  /** Per-page-load seed: every visit restores the name differently. */
  loadSeed: number;
  mask: NameMask;
  maskScale: number;
  maskYFrac: number;
  minEdgeRow: number;
  nameIndex: Int32Array;
  prevCycle: number;
  prevU: number;
  /** 1 fully inside the quiet band, feathering to 0 outside it. */
  quiet: Float32Array;
  rows: number;
  strength: Float32Array;
  wet: Float32Array;
}

let state: BeachState | null = null;

function buildMaskState(s: BeachState, scale: number, yFrac: number): void {
  const lines = PORTRAIT ? NAME_LINES_TALL : NAME_LINES_WIDE;
  s.mask = buildNameMask(lines, s.cols, s.rows, scale, yFrac, (x, y) => rand01(x * 7.13 + 0.31, y * 5.77 + 0.83));
  s.maskScale = scale;
  s.maskYFrac = yFrac;
  s.strength = new Float32Array(s.mask.cells.length).fill(1);
  s.cellDelay = new Float32Array(s.mask.cells.length);
  s.letterBias = new Float32Array(s.mask.letterCount).fill(1);
  s.biasCycle = -1;
  s.epochStart = -1;
  s.nameIndex = new Int32Array(s.cols * s.rows);

  // cells[] is letter-contiguous by construction; record the ranges so the
  // bloom can pick a per-letter anchor cheaply.
  s.letterStart = new Int32Array(s.mask.letterCount + 1);

  for (let c = 0; c < s.mask.cells.length; c++) {
    const cell = s.mask.cells[c];

    if (cell) {
      s.nameIndex[cell.y * s.cols + cell.x] = c + 1;
      s.letterStart[cell.letter + 1] = c + 1;
    }
  }

  for (let li = 1; li <= s.mask.letterCount; li++) {
    if ((s.letterStart[li] ?? 0) === 0) {
      s.letterStart[li] = s.letterStart[li - 1] ?? 0;
    }
  }

  // The quiet band around the name: speckle inside is damped at paint time so
  // the glyphs always sit ramp steps above their sand. Chebyshev falloff,
  // full strength across bbox + QUIET_MARGIN, feathered for QUIET_FEATHER.
  s.quiet = new Float32Array(s.cols * s.rows);
  const bx0 = s.mask.x0;
  const bx1 = s.mask.x0 + s.mask.width - 1;
  const by0 = s.mask.y0;
  const by1 = s.mask.y0 + s.mask.height - 1;
  const reach = QUIET_MARGIN + QUIET_FEATHER;

  for (let y = Math.max(0, by0 - reach); y <= Math.min(s.rows - 1, by1 + reach); y++) {
    for (let x = Math.max(0, bx0 - reach); x <= Math.min(s.cols - 1, bx1 + reach); x++) {
      const dx = Math.max(0, bx0 - x, x - bx1);
      const dy = Math.max(0, by0 - y, y - by1);
      const d = Math.max(dx, dy);
      s.quiet[y * s.cols + x] = d <= QUIET_MARGIN ? 1 : 1 - (d - QUIET_MARGIN) / (QUIET_FEATHER + 1);
    }
  }
}

/**
 * Seed this cycle's restoration bloom: each letter gets a random anchor
 * cell and a random start slot; its cells regrow outward from the anchor.
 * The per-load seed keeps every visit different; within a visit each wash
 * blooms differently too (the cycle index feeds the hash).
 */
function seedBloom(s: BeachState, cycle: number, bloomSpeed: number, restoreSpread: number): void {
  const speed = Math.max(1, bloomSpeed);

  for (let li = 0; li < s.mask.letterCount; li++) {
    const start = s.letterStart[li] ?? 0;
    const end = s.letterStart[li + 1] ?? start;

    if (end <= start) {
      continue;
    }

    const anchorIdx = start + Math.min(end - start - 1, Math.floor(rand01(li * 7.31 + s.loadSeed, cycle * 3.17 + 0.71) * (end - start)));
    const anchor = s.mask.cells[anchorIdx];
    const letterDelay = restoreSpread * rand01(li * 3.93 + s.loadSeed * 1.7, cycle * 5.11 + 0.29);

    for (let c = start; c < end; c++) {
      const cell = s.mask.cells[c];

      if (!cell || !anchor) {
        continue;
      }

      const d = Math.hypot(cell.x - anchor.x, cell.y - anchor.y);
      s.cellDelay[c] = letterDelay + d / speed + 0.5 * cell.r;
    }
  }
}

function createState(cols: number, rows: number, tideAmp: number, nameScale: number, shoreFrac: number, nameYFrac: number): BeachState {
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
  const base = rows * shoreFrac;

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
    cellDelay: new Float32Array(0),
    cols,
    deposit,
    edgeRow: new Float32Array(cols).fill(rows),
    epochStart: -1,
    grain,
    letterBias: new Float32Array(0),
    letterStart: new Int32Array(0),
    // The browser seeds each visit once; the sim stays deterministic within
    // the visit (update is a function of time given this fixed seed).
    loadSeed: Math.random() * 89 + 1,
    mask: { cells: [], height: 0, letterCount: 0, width: 0, x0: 0, y0: 0 },
    maskScale: 0,
    maskYFrac: Number.NaN,
    minEdgeRow: rows,
    nameIndex: new Int32Array(0),
    prevCycle: -1,
    prevU: 0,
    quiet: new Float32Array(0),
    rows,
    strength: new Float32Array(0),
    wet: new Float32Array(cols * rows),
  };

  buildMaskState(s, nameScale, nameYFrac);

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
    const { tideAmp = 24, nameScale = 2, shoreFrac = 0.74, nameYFrac = 0.38 } = this.tuning.motion;
    state = createState(context.buffer.width, context.buffer.height, tideAmp, nameScale, shoreFrac, nameYFrac);
  },
  summaryChip: "The name in the sand — where the story starts.",
  tuning: {
    cellH: PORTRAIT ? 6 : 8,
    cellW: PORTRAIT ? 6 : 8,
    cols: PORTRAIT ? 96 : 200,
    minimalGlyph: "·",
    motion: {
      bloomSpeed: 9,
      // Portrait erodes slower: the two-line name meets a taller swash, so a
      // gentler bite keeps washes partial (desktop parity).
      erodeRate: PORTRAIT ? 0.3 : 0.45,
      foamWidth: PORTRAIT ? 3 : 2,
      laceThreshold: 0.42,
      lobeAmp: 0.35,
      lobeScale: 0.012,
      nameInk: 0.82,
      nameScale: 2,
      // Portrait pulls the name up the frame so the 390px first fold leads
      // with the two stacked lines and keeps living water inside it.
      nameYFrac: PORTRAIT ? 0.28 : 0.38,
      quietBand: 0.4,
      redrawRate: 1.4,
      restoreSpread: 4,
      retreatLag: 2,
      rippleAmp: 1.1,
      rushFrac: 0.34,
      sheenRows: 3.5,
      shoreFrac: PORTRAIT ? 0.7 : 0.74,
      surgeVar: 0.45,
      tideAmp: PORTRAIT ? 48 : 24,
      tidePeriod: 13,
      undertowRate: 0.5,
      waterContrast: 0.16,
      waterDrift: 0.1,
      wetTau: 6,
    },
    ramp: " ·:~≈=+*#@",
    rows: PORTRAIT ? 152 : 90,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, depth, time } = context;
    const cols = buffer.width;
    const rows = buffer.height;

    const {
      bloomSpeed = 9,
      erodeRate = 0.45,
      foamWidth = 2,
      laceThreshold = 0.42,
      lobeAmp = 0.35,
      lobeScale = 0.012,
      nameInk = 0.82,
      nameScale = 2,
      nameYFrac = 0.38,
      quietBand = 0.4,
      redrawRate = 1.4,
      restoreSpread = 4,
      retreatLag = 2,
      rippleAmp = 1.1,
      rushFrac = 0.34,
      sheenRows = 3.5,
      shoreFrac = 0.74,
      surgeVar = 0.45,
      tideAmp = 24,
      tidePeriod = 13,
      undertowRate = 0.5,
      waterContrast = 0.16,
      waterDrift = 0.1,
      wetTau = 6,
    } = this.tuning.motion;

    if (!state || state.cols !== cols || state.rows !== rows) {
      state = createState(cols, rows, tideAmp, nameScale, shoreFrac, nameYFrac);
    }

    const s = state;
    const requestedScale = Math.max(1, Math.round(nameScale));

    if (requestedScale !== s.maskScale || nameYFrac !== s.maskYFrac) {
      buildMaskState(s, requestedScale, nameYFrac);
    }

    // --- Tide phase: one long swash per period, easing in AND out — the
    // water glides up the foreshore, it never rushes. ---
    const period = Math.max(0.5, tidePeriod);
    const rush = Math.min(0.9, Math.max(0.05, rushFrac));
    const cycle = Math.floor(time / period);
    const u = time / period - cycle;
    // The opening swash is deliberately gentle: the visitor gets the intact
    // name for a while before the tide first reaches it.
    const surge = cycle < 1 ? 1 - surgeVar * 0.5 : 1 + surgeVar * (rand01(cycle * 1.7 + 0.13, 4.29) - 0.5);
    const amp = tideAmp * surge;
    let envelope: number;

    if (u < rush) {
      const p = u / rush;
      envelope = 0.5 - 0.5 * Math.cos(Math.PI * p); // easeInOutSine glide
    } else {
      const p = 1 - (u - rush) / (1 - rush);
      envelope = p * p * (3 - 2 * p); // slow, smooth retreat
    }

    const advancing = u < rush;
    const base = rows * shoreFrac;
    // The swash may reach the name but never rises past its brow: the crest
    // clamp keeps the highest tongue at the quiet band's top margin.
    const swashLimit = s.mask.y0 - QUIET_MARGIN + 1;
    // The undertow lifts the waterline with depth but the swash edge stays
    // pinned on-grid: sinking, the surface is the last thing that resolves —
    // and it is what survives binning as the compacted residue.
    const undertow = Math.min(Math.max(0, depth) * rows * undertowRate, base - amp - 3);
    let minEdge = rows;

    for (let x = 0; x < cols; x++) {
      // Long-wavelength lobes: the front advances as soft tongues, not a
      // ruler line. A whisper of ripple keeps the lace alive up close.
      const lobe = 1 + lobeAmp * (fbm2(noiseChop, x * lobeScale, time * LOBE_DRIFT, 2) - 0.5) * 2;
      const ripple = (fbm2(noiseChop, x * RIPPLE_SCALE + 31.7, time * RIPPLE_SPEED, 1) - 0.5) * rippleAmp;
      let swash = base - amp * envelope * lobe + ripple;

      if (swash < swashLimit) {
        swash = swashLimit;
      }

      const edge = swash - undertow;
      s.edgeRow[x] = edge;

      if (edge < minEdge) {
        minEdge = edge;
      }
    }

    s.minEdgeRow = minEdge;

    // At the swash's highest reach (rush -> retreat turn): deposit a dashed
    // tide line — the shore's memory — and seed this wash's restoration
    // bloom, anchored and ordered by the per-load seed.
    if (cycle === s.prevCycle && s.prevU < rush && u >= rush) {
      for (let x = 0; x < cols; x++) {
        const y = Math.floor(s.edgeRow[x] ?? rows);

        if (y >= 0 && y < rows && rand01(x * 3.1 + 0.7, cycle * 5.3 + 0.2) > 0.35) {
          const idx = y * cols + x;
          const current = s.deposit[idx] ?? 0;
          s.deposit[idx] = current > 0.45 ? 1 : current + 0.55;
        }
      }

      s.epochStart = time + Math.max(0, retreatLag);
      seedBloom(s, cycle, bloomSpeed, restoreSpread);
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

    for (let c = 0; c < s.mask.cells.length; c++) {
      const cell = s.mask.cells[c];

      if (!cell) {
        continue;
      }

      let st = s.strength[c] ?? 0;
      const sub = cell.y - (s.edgeRow[cell.x] ?? rows);

      if (sub >= 0) {
        // Erosion works under the body of the water, gently at the lace —
        // so the edge melds with the letters instead of gnawing them.
        st -= erodeRate * dt * (0.3 + 0.7 * Math.min(1, sub / 4)) * (0.55 + 0.9 * cell.r) * (s.letterBias[cell.letter] ?? 1);
      } else if (s.epochStart >= 0 && time >= s.epochStart + (s.cellDelay[c] ?? 0)) {
        st += redrawRate * dt; // the seeded bloom regrows this cell
      }

      s.strength[c] = st < 0 ? 0 : st > 1 ? 1 : st;
    }

    // --- Paint: dry sand / wet sheen / foam lace / breathing water. ---
    const wetF = Math.exp(-dt / Math.max(0.1, wetTau));
    const depSandF = Math.exp(-dt / DEPOSIT_TAU_SAND);
    const depWaterF = Math.exp(-dt / DEPOSIT_TAU_WATER);
    const foamBase = advancing ? 0.58 : 0.36;
    const octaves = depth > 0.8 ? 1 : 2;
    // Slight luminance lift in deep water so the binned/simplified residue
    // keeps sparse wave texture instead of draining to pure black.
    const deepLift = depth > 0.6 ? Math.min(0.14, (depth - 0.6) * 0.15) : 0;
    const quietDamp = 1 - Math.min(1, Math.max(0, quietBand));
    const sheenSpan = Math.max(0.5, sheenRows);
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
          // Speckle inside the quiet band is damped toward quietBand of its
          // luminance; the name's own ink is applied after, undamped.
          v = ((s.grain[i] ?? 0) + w * 0.12 + dep * 0.18) * (1 - (s.quiet[i] ?? 0) * quietDamp);

          // Wet sheen: the sand glistens for a few feathered rows above the
          // edge, so water and shore meld instead of meeting at a line.
          const d = edge - y;

          if (d < sheenSpan) {
            v += 0.11 * (1 - d / sheenSpan) * (0.55 + 2 * (s.grain[i] ?? 0));
          }

          const ni = s.nameIndex[i] ?? 0;

          if (ni > 0) {
            const ink = (s.strength[ni - 1] ?? 0) * nameInk;

            if (ink > v) {
              v = ink;
            }
          }
        } else {
          s.wet[i] = 1;
          s.deposit[i] = (s.deposit[i] ?? 0) * depWaterF;
          const below = y - edge;
          const ni = s.nameIndex[i] ?? 0;

          if (below < foamWidth) {
            // Foam lace: broken and alive, never a solid stripe. Where the
            // lace parts, shallow water shows through — and so does the name.
            const lace = noiseWater(x * 0.23 + time * 0.55, cycle * 3.1 + below * 0.9);

            if (lace > laceThreshold) {
              v = foamBase * (0.72 + 0.5 * lace);
            } else {
              v = 0.16 + fbm2(noiseWater, x * WATER_SCALE + time * waterDrift, y * WATER_SCALE * 1.6, 1) * waterContrast;
            }

            if (ni > 0) {
              const ghost = (s.strength[ni - 1] ?? 0) * nameInk * 0.45;

              if (ghost > v) {
                v = ghost;
              }
            }
          } else {
            const gradient = below * 0.004;
            const body = fbm2(noiseWater, x * WATER_SCALE + time * waterDrift, y * WATER_SCALE * 1.6 - time * waterDrift * 0.45, octaves);
            // Soft swell bands roll shoreward through the body; the crest of
            // the local noise glints — sparse sparkle, deterministic.
            const swell = 0.045 * Math.sin(y * 0.16 - time * 0.35 + 4 * (fbm2(noiseWater, x * 0.02, time * 0.03, 1) - 0.5));
            v = 0.15 + deepLift + body * waterContrast + swell + (gradient > 0.1 ? 0.1 : gradient);

            if (body > 0.82) {
              v += 0.1; // glint
            }

            if (ni > 0) {
              // The drowned name ghosts near the surface and fades with depth.
              v += (s.strength[ni - 1] ?? 0) * 0.12 * Math.max(0, 1 - below / 14);
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
  /** Spread of the current bloom's per-cell delays, seconds (0 pre-bloom). */
  bloomDelaySpread(): number {
    if (!state || state.cellDelay.length === 0 || state.epochStart < 0) {
      return 0;
    }

    let min = Number.POSITIVE_INFINITY;
    let max = 0;

    for (let c = 0; c < state.cellDelay.length; c++) {
      const d = state.cellDelay[c] ?? 0;
      min = Math.min(min, d);
      max = Math.max(max, d);
    }

    return max - min;
  },
  /** Water edge row for column x from the last update (rows if unknown). */
  edgeRowAt(x: number): number {
    return state ? (state.edgeRow[x] ?? state.rows) : Number.POSITIVE_INFINITY;
  },
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
  /** Name-cell drawn strength at (x, y); -1 when (x, y) is not a name cell. */
  nameStrengthAt(x: number, y: number): number {
    if (!state) {
      return -1;
    }

    const ni = state.nameIndex[y * state.cols + x] ?? 0;
    return ni > 0 ? (state.strength[ni - 1] ?? 0) : -1;
  },
  /** Quiet-band cell bounds (inclusive, unclamped), or null before init. */
  quietBandRect(): { x0: number; x1: number; y0: number; y1: number } | null {
    if (!state || state.mask.cells.length === 0) {
      return null;
    }

    const m = state.mask;
    return {
      x0: m.x0 - QUIET_MARGIN,
      x1: m.x0 + m.width - 1 + QUIET_MARGIN,
      y0: m.y0 - QUIET_MARGIN,
      y1: m.y0 + m.height - 1 + QUIET_MARGIN,
    };
  },
};
