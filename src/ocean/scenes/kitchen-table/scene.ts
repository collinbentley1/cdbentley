/**
 * Scene — "kitchen-table": THE BROADCAST MICROPHONE. Healthyr pivoted from
 * an app in a pocket to SMS and a real-time voice LLM — care that speaks.
 * No mouths, no phones: retro voice. A monumental 1950s birdcage microphone
 * (Shure 55 spirit) stands centered, filling most of the canvas height — a
 * rounded-dome grille head drawn GRAND, vertical grille ribs alternating
 * '='/'|' with dark slots like the stage's triglyph frieze, a bright
 * horizontal band across the grille (the scene's hottest light, '@' held to
 * a five-cell core), a '+'-weight outline crown — atop a tapering yoke and
 * a massive deco stepped pedestal: three plinths spanning wider toward a
 * full-bleed floor line that crosses every column.
 *
 * THE LIGHT EVENT + ONE MOTION: concentric voice arcs ripple outward from
 * the grille to both sides — nested portions of rings centered on the
 * band, brightness falling with radius (':' near, '-'/'·' far), slowly
 * propagating outward (phase = radius - speed*time) and fading to black
 * before the canvas edges, so the air itself carries the voice. The band's
 * core pulses in sync with each departing ring. Secondaries, both quiet: a
 * breathing haze confined to a halo around the head, and a faint
 * oscilloscope waveform line low across the full width, its amplitude
 * breathing on a slow cycle.
 *
 * The sim is STATELESS by construction: every frame is a closed-form
 * function of context.time (no accumulators, no per-frame randomness), so
 * arbitrary sleep gaps land the voice exactly where it should be — two
 * updates at identical time produce byte-identical buffers.
 *
 * Compaction legibility: the head interior half-fills its area at rib
 * weights that pool past the bin-4 threshold near the band, the pedestal
 * plinths are solid '|'-band slabs, and the column is a thick fluted
 * stroke — at deep scroll the scene survives as its skeleton: a dotted
 * dome over a dotted column over a widening dotted base.
 *
 * Nothing human-readable is rendered here; the chapter prose beside this
 * scene is DOM.
 *
 * Ramp intent (hand-tunable, Collin's brush), dark -> bright:
 * " ·:-|=+#@" — the dark holds the corners; far arcs whisper on '·', near
 * arcs speak on ':' '-'; grille ribs live on '|' '='; crown, collar and
 * plinth edges on '+'; the band on '#'; its five-cell core alone on '@'.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(31);

const TAU = Math.PI * 2;

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const CROWN_LUM = 0.72; // '+' — the head's outline crown
const CROWN_T = 2.6; // crown thickness in cells (measured radially)
const RIM_LUM = 0.66; // '=' — the rim where head meets yoke
const SLOT_LUM = 0.13; // '·' — dark slots between grille ribs
const RIB_BASE_LUM = 0.44; // '|' — rib brightness at the dome apex
const RIB_GAIN = 0.14; // ribs brighten toward the band ('=' beside it)
const RIB_ALT_DROP = 0.1; // the narrow alternate rib sits one band lower
const BAND_EDGE_LUM = 0.7; // '+' — the band's outer rows at the crown
const BAND_GAIN = 0.12; // outer-row lift toward center ('#'-adjacent)
const BAND_MID_LUM = 0.8; // '#' — the band's middle row, full width
const BAND_MID_GAIN = 0.08; // middle-row lift toward center
const BAND_CORE_LUM = 0.9; // '@' — five-cell core, the hottest light
const YOKE_EDGE_LUM = 0.6; // '=' — yoke silhouette edges
const YOKE_FILL_LUM = 0.44; // '|' — yoke fill
const COL_EDGE_LUM = 0.66; // '=' — column arris, both sides
const COL_FLUTE_A_LUM = 0.56; // '=' — column flute, lit (pools past bin 4)
const COL_FLUTE_B_LUM = 0.46; // '|' — column flute, shadowed
const STEP_TOP_LUM = 0.68; // '+' — each plinth's top edge
const STEP_SIDE_LUM = 0.58; // '=' — plinth ends
const STEP_FILL_LUM = 0.5; // '|' — plinth body (pools past bin-4 threshold)
const FLOOR_LUM = 0.56; // '=' — the full-bleed floor line
const FLOOR_UNDER_LUM = 0.42; // '-' — the floor line's soffit row
const FLOOR_SHADOW_LUM = 0.12; // '·' — the dark ground under the floor line

interface MicGeometry {
  bandMid: number;
  bandY0: number;
  bandY1: number;
  colBot: number;
  colHalf: number;
  cx: number;
  floorRow: number;
  headBot: number;
  headCy: number;
  headR: number;
  headTop: number;
  steps: ReadonlyArray<{ halfW: number; y0: number; y1: number }>;
  waveRow: number;
  yokeBot: number;
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
 * Landmarks from proportions. The microphone is centered and monumental:
 * the head fills the upper half, the pedestal reaches the bottom edge, and
 * the floor line is full-bleed across every column. All offsets scale with
 * cols/rows so small harness grids stay in-bounds.
 */
function geometry(cols: number, rows: number): MicGeometry {
  const cx = Math.round(cols * 0.5);
  const headR = Math.max(3, Math.round(Math.min(rows * 0.25, cols * 0.12)));
  const headTop = Math.max(1, Math.round(rows * 0.048));
  const headCy = headTop + headR;
  const headBot = Math.min(rows - 2, headCy + Math.max(1, Math.round(headR * 1.05)));
  const bandMid = Math.min(headBot - 1, headCy + Math.max(1, Math.round(headR * 0.12)));
  const yokeBot = Math.min(rows - 2, headBot + Math.max(1, Math.round(rows * 0.055)));
  const colHalf = Math.max(2, Math.round(cols * 0.027));
  const stepH = Math.max(2, Math.round(rows * 0.045));
  const floorRow = Math.max(yokeBot + 1, rows - 3);
  const step3Top = floorRow - stepH;
  const step2Top = step3Top - stepH;
  const step1Top = step2Top - stepH;

  return {
    bandMid,
    bandY0: bandMid - 1,
    bandY1: bandMid + 1,
    colBot: Math.max(yokeBot, step1Top - 1),
    colHalf,
    cx,
    floorRow,
    headBot,
    headCy,
    headR,
    headTop,
    steps: [
      { halfW: Math.max(colHalf + 2, Math.round(cols * 0.066)), y0: step1Top, y1: step2Top - 1 },
      { halfW: Math.max(colHalf + 4, Math.round(cols * 0.105)), y0: step2Top, y1: step3Top - 1 },
      { halfW: Math.max(colHalf + 6, Math.round(cols * 0.165)), y0: step3Top, y1: floorRow - 1 },
    ],
    waveRow: Math.round(rows * 0.78),
    yokeBot,
  };
}

/**
 * The head silhouette: a circle-capped dome above headCy, sides tapering
 * gently inward below it (the birdcage profile). Returns the half-width at
 * row y, or -1 outside the head.
 */
function domeHalfWidth(y: number, geo: MicGeometry): number {
  if (y < geo.headTop || y > geo.headBot) {
    return -1;
  }

  if (y <= geo.headCy) {
    const dy = geo.headCy - y;
    const s = geo.headR * geo.headR - dy * dy;

    return s <= 0 ? 0 : Math.sqrt(s);
  }

  const t = (y - geo.headCy) / Math.max(1, geo.headBot - geo.headCy);

  return geo.headR * (1 - 0.3 * t);
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

/**
 * Static architecture: the birdcage head — crown outline, vertical grille
 * ribs alternating with dark slots, the bright band, a rim where the head
 * meets the yoke — then the tapering yoke, the fluted column, three deco
 * plinths widening toward the floor, and the full-bleed floor line.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);

  // The head: crown outline around a ribbed grille with the bright band.
  for (let y = geo.headTop; y <= geo.headBot; y++) {
    const hw = domeHalfWidth(y, geo);

    if (hw < 0) {
      continue;
    }

    const hwI = Math.max(1, Math.round(hw));

    for (let dx = -hwI; dx <= hwI; dx++) {
      const x = geo.cx + dx;
      let edge: boolean;

      if (y <= geo.headCy) {
        const rr = Math.sqrt(dx * dx + (y - geo.headCy) * (y - geo.headCy));
        edge = rr >= geo.headR - CROWN_T;
      } else {
        edge = Math.abs(dx) >= hw - CROWN_T;
      }

      if (y >= geo.headBot - 1) {
        putMax(base, cols, rows, x, y, RIM_LUM);
        continue;
      }

      if (edge) {
        putMax(base, cols, rows, x, y, CROWN_LUM);
        continue;
      }

      if (y >= geo.bandY0 && y <= geo.bandY1) {
        const u = Math.min(1, Math.abs(dx) / hwI);
        const v =
          y === geo.bandMid
            ? Math.abs(dx) <= 2
              ? BAND_CORE_LUM
              : BAND_MID_LUM + BAND_MID_GAIN * (1 - u)
            : BAND_EDGE_LUM + BAND_GAIN * (1 - u);
        putMax(base, cols, rows, x, y, v);
        continue;
      }

      // Grille ribs, period 4: two '=' columns, one '|' column, one slot.
      const m = ((dx % 4) + 4) % 4;

      if (m === 3) {
        putMax(base, cols, rows, x, y, SLOT_LUM);
        continue;
      }

      const g = 1 - Math.min(1, Math.abs(y - geo.bandMid) / (geo.headR * 1.15));
      const rib = RIB_BASE_LUM + RIB_GAIN * g;
      putMax(base, cols, rows, x, y, m === 2 ? rib - RIB_ALT_DROP : rib);
    }
  }

  // The yoke: a trapezoid tapering from the head rim down to the column.
  const yokeSpan = Math.max(1, geo.yokeBot - geo.headBot);
  const yokeTopHalf = geo.headR * 0.42;

  for (let y = geo.headBot + 1; y <= geo.yokeBot; y++) {
    const t = (y - geo.headBot) / yokeSpan;
    const hw = Math.max(geo.colHalf, Math.round(yokeTopHalf + (geo.colHalf + 1 - yokeTopHalf) * t));

    for (let dx = -hw; dx <= hw; dx++) {
      putMax(base, cols, rows, geo.cx + dx, y, Math.abs(dx) >= hw - 1 ? YOKE_EDGE_LUM : YOKE_FILL_LUM);
    }
  }

  // The column: bright arrises, alternating flutes down the shaft.
  for (let y = geo.yokeBot + 1; y <= geo.colBot; y++) {
    for (let dx = -geo.colHalf; dx <= geo.colHalf; dx++) {
      const v = Math.abs(dx) >= geo.colHalf ? COL_EDGE_LUM : (dx & 1) === 0 ? COL_FLUTE_A_LUM : COL_FLUTE_B_LUM;
      putMax(base, cols, rows, geo.cx + dx, y, v);
    }
  }

  // Three deco plinths, each wider than the last, stepping to the floor.
  for (const step of geo.steps) {
    for (let y = step.y0; y <= step.y1; y++) {
      const top = y === step.y0;

      for (let dx = -step.halfW; dx <= step.halfW; dx++) {
        const v = top ? STEP_TOP_LUM : Math.abs(dx) >= step.halfW - 1 ? STEP_SIDE_LUM : STEP_FILL_LUM;
        putMax(base, cols, rows, geo.cx + dx, y, v);
      }
    }
  }

  // The full-bleed floor line: every column, a soffit row, dark ground.
  for (let x = 0; x < cols; x++) {
    putSet(base, cols, rows, x, geo.floorRow, FLOOR_LUM);
    putMax(base, cols, rows, x, geo.floorRow + 1, FLOOR_UNDER_LUM);

    for (let y = geo.floorRow + 2; y < rows; y++) {
      putMax(base, cols, rows, x, y, FLOOR_SHADOW_LUM);
    }
  }
}

export const scene: SceneModule = {
  dockGlyph: [
    "    ·++·    ",
    " ·  |==|  · ",
    "·:  |##|  :·",
    " ·  ·||·  · ",
    "     ||     ",
    "  ·======·  ",
  ],
  id: "kitchen-table",
  init(context: SceneContext): void {
    const { width, height } = context.buffer;

    buildBase(width, height);
    context.lights.length = 0;
  },
  summaryChip: "Healthyr, 2024–2025 — clinical care by app, SMS, and voice.",
  tuning: {
    cellH: 6,
    cellW: 6,
    cols: 224,
    minimalGlyph: "·",
    motion: {
      arcAmp: 0.32,
      arcAngHi: 0.88,
      arcAngLo: 0.52,
      arcFadePow: 1.6,
      arcInner: 4,
      arcSharp: 2.5,
      arcSpanFrac: 0.47,
      arcSpeed: 4,
      arcWavelength: 16,
      bandPulse: 0.04,
      hazeAmount: 0.08,
      hazeFloor: 0.02,
      hazeRadius: 1.9,
      hazeScale: 0.055,
      hazeSpeed: 0.05,
      waveAmp: 1.8,
      waveFloor: 0.55,
      waveLambda: 24,
      waveLum: 0.19,
      wavePeriod: 17,
    },
    ramp: " ·:-|=+#@",
    rows: 104,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, time } = context;
    const {
      arcAmp = 0.32,
      arcAngHi = 0.88,
      arcAngLo = 0.52,
      arcFadePow = 1.6,
      arcInner = 4,
      arcSharp = 2.5,
      arcSpanFrac = 0.47,
      arcSpeed = 4,
      arcWavelength = 16,
      bandPulse = 0.04,
      hazeAmount = 0.08,
      hazeFloor = 0.02,
      hazeRadius = 1.9,
      hazeScale = 0.055,
      hazeSpeed = 0.05,
      waveAmp = 1.8,
      waveFloor = 0.55,
      waveLambda = 24,
      waveLum = 0.19,
      wavePeriod = 17,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if (baseCols !== w || baseRows !== h) {
      buildBase(w, h);
    }

    const geo = geometry(w, h);

    // 1) Static architecture.
    data.set(base);

    // 2) Air: a breathing haze halo confined around the head, sampled on a
    // coarse lattice and bilinearly upsampled (same fabric as the stage).
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

    // 3) THE light event: concentric voice arcs rippling outward from the
    // band to both sides — pure f(time): phase = radius - speed * time.
    // Brightness falls with radius and the arcs fade before the edges.
    const arcR0 = geo.headR + arcInner;
    const arcR1 = Math.max(arcR0 + 8, w * arcSpanFrac);
    const arcSpan = Math.max(1, arcR1 - arcR0);
    const hazeR = geo.headR * hazeRadius;
    const angSpan = Math.max(0.05, arcAngHi - arcAngLo);

    for (let y = 0; y < h; y++) {
      const dy = y - geo.bandMid;
      const row = y * w;
      const gy = y / stride;
      const gy0 = Math.floor(gy);
      const fy = gy - gy0;
      const rowA = gy0 * gw;
      const rowB = (gy0 + 1) * gw;

      for (let x = 0; x < w; x++) {
        const dx = x - geo.cx;
        const r = Math.sqrt(dx * dx + dy * dy);
        const i = row + x;

        if (r < hazeR) {
          const gx = x / stride;
          const gx0 = Math.floor(gx);
          const fx = gx - gx0;
          const top = (hazeLattice[rowA + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowA + gx0 + 1] ?? 0) * fx;
          const bottom = (hazeLattice[rowB + gx0] ?? 0) * (1 - fx) + (hazeLattice[rowB + gx0 + 1] ?? 0) * fx;
          const air = (hazeFloor + hazeAmount * (top * (1 - fy) + bottom * fy)) * (1 - r / hazeR);

          if (air > (data[i] ?? 0)) {
            data[i] = clamp01(air);
          }
        }

        if (r < arcR0 || r >= arcR1) {
          continue;
        }

        const ang = Math.abs(dx) / (r || 1);
        const aFac = Math.min(1, Math.max(0, (ang - arcAngLo) / angSpan));

        if (aFac <= 0) {
          continue;
        }

        const env = 1 - (r - arcR0) / arcSpan;
        const crest = 0.5 + 0.5 * Math.cos((TAU * (r - arcSpeed * time)) / arcWavelength);
        const v = arcAmp * Math.pow(env, arcFadePow) * aFac * Math.pow(crest, arcSharp);

        if (v > (data[i] ?? 0)) {
          data[i] = clamp01(v);
        }
      }
    }

    // 4) The band's core pulses in sync with each ring leaving the grille
    // (the wave evaluated at radius zero), additive over the band rows.
    const crest0 = 0.5 + 0.5 * Math.cos((TAU * (0 - arcSpeed * time)) / arcWavelength);
    const pulse = bandPulse * Math.pow(crest0, arcSharp);

    if (pulse > 0.0005) {
      for (let y = geo.bandY0; y <= geo.bandY1; y++) {
        const hw = Math.round(domeHalfWidth(y, geo));

        if (hw < 1 || y < 0 || y >= h) {
          continue;
        }

        const row = y * w;

        for (let dx = -hw; dx <= hw; dx++) {
          const x = geo.cx + dx;

          if (x < 0 || x >= w) {
            continue;
          }

          data[row + x] = clamp01((data[row + x] ?? 0) + pulse * (1 - Math.abs(dx) / hw));
        }
      }
    }

    // 5) A faint oscilloscope line low across the full width, amplitude
    // breathing on a slow cycle; connected column to column like a hem.
    const amp = waveAmp * (waveFloor + (1 - waveFloor) * (0.5 + 0.5 * Math.sin((TAU * time) / Math.max(0.5, wavePeriod))));
    let prev = -1;

    for (let x = 0; x < w; x++) {
      const yy = geo.waveRow + Math.round(amp * Math.sin((TAU * x) / Math.max(2, waveLambda)));
      const from = prev < 0 ? yy : Math.min(prev + 1, yy);
      const to = prev < 0 ? yy : Math.max(prev - 1, yy);

      for (let y = Math.min(from, to); y <= Math.max(from, to); y++) {
        putMax(data, w, h, x, y, waveLum);
      }

      prev = yy;
    }
  },
};
