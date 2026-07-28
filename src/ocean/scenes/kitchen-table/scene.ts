/**
 * Scene — "kitchen-table": THE BROADCAST MICROPHONE. Healthyr pivoted from
 * an app in a pocket to SMS and a real-time voice LLM — care that speaks.
 * No mouths, no phones: retro voice. A monumental Shure Super 55 — the
 * "Elvis mic" — fills the frame, drawn faithfully to its anatomy:
 *
 * THE HEAD IS AN EGG, NOT A DOME — a large teardrop grille, widest at the
 * crown and tapering smoothly to a narrow chin (crown ~3x the chin), the
 * head alone claiming roughly the upper half of the canvas. The chrome
 * grille ribs FAN: they sit on constant viewing angles, so they converge
 * toward the chin and crowd toward the curved edges where the surface
 * foreshortens — alternating wide '='/narrow '|' ribs over dark slots. A
 * bright nameplate band curves across the head's lower third (no letters);
 * its five-cell core is the scene's only '@'. Below the band the shell is
 * smooth chrome — but the fan's wide ribs continue as sparser, quieter
 * strokes through the chin taper, so grille and chin read as one surface
 * instead of ending on a hard seam.
 *
 * THE U-YOKE CRADLE: the head sits IN a cradle — two yoke arms rise from
 * below, wrap the head's lower sides across a dark gap, and end in
 * '+'-weight pivot-screw bosses beside the head; a thin U-shaped strap —
 * a curved band, never a filled bowl — closes under the chin. The egg is
 * HELD, not impaled. Below the strap a small RECTANGULAR stand-adapter
 * block (no taper, no funnel), then a THIN three-cell pole drops to a
 * LOW, WIDE two-tier round base hugging the full-bleed floor line.
 *
 * THE LIGHT EVENT + ONE MOTION: concentric voice arcs ripple outward from
 * the grille to both sides — nested portions of rings centered on the
 * nameplate band, brightness falling with radius (':' near, '-'/'·' far),
 * slowly propagating outward (phase = radius - speed*time) and fading to
 * black before the canvas edges, so the air itself carries the voice. The
 * arcs also stop well above the waveform's horizon — their bottoms never
 * curl under the head, so they stay open parentheses of air instead of
 * closing into a badge circle. The
 * band's core pulses in sync with each departing ring. Secondaries, both
 * quiet: a breathing haze confined to a halo around the head, and a faint
 * oscilloscope waveform line low across the full width, its amplitude
 * breathing on a slow cycle.
 *
 * The sim is STATELESS by construction: every frame is a closed-form
 * function of context.time (no accumulators, no per-frame randomness), so
 * arbitrary sleep gaps land the voice exactly where it should be — two
 * updates at identical time produce byte-identical buffers.
 *
 * Compaction legibility: at deep scroll (bin-4: 4x4 mean pooled against
 * a 0.5 gate) the scene survives as its skeleton — a dotted egg over a
 * thin stem over a wide shallow base. The thin crown outline alone can
 * split across bin boundaries and vanish (a headless martini-glass), so
 * a dedicated pass walks every pooled bin the egg outline crosses and,
 * where the bin's mass falls short, promotes rim-adjacent cells to '#'
 * studs — a sparse bright ring, roughly one stud cluster per four cells,
 * that keeps the head alive at depth. The pole's three cells are
 * bin-aligned at the tuned grid (cx = 112) and the stand-adapter block
 * bridges strap to pole inside the same bin column. The voice arcs,
 * haze, and waveform are air, not architecture: they fade out of the
 * skeleton by design.
 *
 * Nothing human-readable is rendered here; the chapter prose beside this
 * scene is DOM.
 *
 * Ramp intent (hand-tunable, Collin's brush), dark -> bright:
 * " ·:-|=+#@" — the dark holds the corners; far arcs whisper on '·', near
 * arcs speak on ':' '-'; chin ribs murmur on '-'; grille ribs live on
 * '|' '='; crown, bosses and base tops on '+'; the band and the skeleton
 * studs on '#'; the band's five-cell core alone on '@'.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const hazeNoise = createValueNoise(31);

const TAU = Math.PI * 2;

/** Luminance targets, tuned against the 9-glyph ramp (band width 1/9). */
const CROWN_LUM = 0.74; // '+' — the head's outline crown
const CROWN_T = 3.5; // crown thickness in cells; pools past the bin-4 gate
const SHELL_T = 2; // shell edge thickness below the band, slimmer
const SLOT_LUM = 0.16; // '·' — dark slots between grille ribs
const SLOT_SHEEN = 0.3; // slot lift toward the curved edges (chrome sheen)
const RIB_EVEN_LUM = 0.58; // '=' — the wide ribs of the fan
const RIB_ODD_LUM = 0.48; // '|' — the narrow ribs between them
const RIB_GAIN = 0.08; // ribs brighten toward the nameplate band
/** Rib anchors as fractions of the band-row half-width; the per-row sqrt
 * scale makes the near-vertical fan open at the crown and converge gently
 * toward the chin, outer ribs terminating against the crown edge. */
const RIB_FRACTIONS = [0, 0.22, 0.42, 0.6, 0.76, 0.9, 1.05, 1.2] as const;
const BAND_EDGE_LUM = 0.7; // '+' — the nameplate's outer rows
const BAND_GAIN = 0.04; // lift toward the band's center
const BAND_MID_LUM = 0.8; // '#' — the nameplate's middle row
const BAND_CURVE = 1.5; // rows the nameplate dips toward the edges
const BAND_CORE_LUM = 0.9; // '@' — five-cell core, the hottest light
const SHELL_FILL_LUM = 0.3; // ':' — smooth chrome shell below the band
const SHELL_EDGE_LUM = 0.56; // '=' — shell silhouette edges
const CHIN_RIB_LUM = 0.45; // '-' — sparse rib strokes through the chin taper
const CHIN_RIM_LUM = 0.6; // '=' — the narrow chin's bottom rim
const YOKE_EDGE_LUM = 0.64; // '=' — yoke arm and U-strap edges
const YOKE_FILL_LUM = 0.52; // '|' — yoke arm fill
const YOKE_GAP = 3; // dark cells between the shell and each yoke arm
const YOKE_ARM_T = 4; // yoke arm thickness in cells
const BOSS_LUM = 0.72; // '+' — pivot-screw bosses beside the head
const BOSS_CORE_LUM = 0.78; // '#' — each boss's screw center
const STRAP_T = 2.6; // U-strap band thickness in cells (a band, not a bowl)
const ADAPTER_LUM = 0.56; // '=' — the rectangular stand-adapter block
const STUD_LUM = 0.87; // '#' — bin-4 skeleton studs along the egg rim
const POOL = 4; // the deep-scroll bin size the skeleton pass defends
const POOL_GATE = POOL * POOL * 0.5 + 0.4; // pooled sum a bin must clear
const POLE_LUMS = [0.72, 0.68, 0.64] as const; // three cells; pools past bin 4
const BASE_TOP_LUM = 0.7; // '+' — each base tier's top edge
const BASE_FILL_LUM = 0.54; // '|' — base tier body
const BASE_END_LUM = 0.44; // '-' — rounded tier ends
const FLOOR_LUM = 0.56; // '=' — the full-bleed floor line
const FLOOR_UNDER_LUM = 0.42; // '-' — the floor line's soffit row
const FLOOR_SHADOW_LUM = 0.12; // '·' — the dark ground under the floor line

interface MicGeometry {
  bandMid: number;
  bandY0: number;
  bandY1: number;
  baseHalf: number;
  baseTop: number;
  chinHalf: number;
  crownR: number;
  crownY: number;
  cx: number;
  floorRow: number;
  headBot: number;
  headTop: number;
  knuckleBot: number;
  pivotY: number;
  uBot: number;
  waveRow: number;
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
 * the egg head claims the upper half, the slim stand drops to a low wide
 * base at the bottom edge, and the floor line is full-bleed across every
 * column. All offsets scale with cols/rows so small harness grids stay
 * in-bounds (writes are bounds-checked besides).
 */
function geometry(cols: number, rows: number): MicGeometry {
  const cx = Math.round(cols * 0.5);
  const crownR = Math.max(4, Math.round(Math.min(rows * 0.26, cols * 0.115)));
  const headTop = Math.max(1, Math.round(rows * 0.04));
  const crownY = headTop + Math.max(3, Math.round(crownR * 0.55));
  const headBot = Math.min(rows - 4, crownY + Math.max(4, Math.round(crownR * 1.3)));
  const chinHalf = Math.max(2, Math.round(crownR * 0.35));
  const bandMid = Math.min(headBot - 1, crownY + Math.max(1, Math.round((headBot - crownY) * 0.62)));
  const uBot = Math.min(rows - 3, headBot + Math.max(3, Math.round(rows * 0.058)));
  const knuckleBot = Math.min(rows - 2, uBot + 3);
  const floorRow = Math.max(knuckleBot + 1, rows - 3);

  return {
    bandMid,
    bandY0: bandMid - 1,
    bandY1: bandMid + 1,
    baseHalf: Math.max(chinHalf + 4, Math.round(cols * 0.103)),
    baseTop: Math.max(knuckleBot + 1, floorRow - Math.max(3, Math.round(rows * 0.05))),
    chinHalf,
    crownR,
    crownY,
    cx,
    floorRow,
    headBot,
    headTop,
    knuckleBot,
    pivotY: Math.min(bandMid - 1, crownY + Math.max(1, Math.round((headBot - crownY) * 0.5))),
    uBot,
    waveRow: Math.round(rows * 0.78),
  };
}

/**
 * The egg silhouette: an elliptical cap above crownY (widest at the crown)
 * tapering on a convex cosine curve to the narrow chin at headBot — the
 * Super 55 teardrop. Returns the half-width at row y, or -1 outside.
 */
function eggHalfWidth(y: number, geo: MicGeometry): number {
  if (y < geo.headTop || y > geo.headBot) {
    return -1;
  }

  if (y <= geo.crownY) {
    const capH = Math.max(1, geo.crownY - geo.headTop);
    const dy = (geo.crownY - y) / capH;
    const s = 1 - dy * dy;

    return s <= 0 ? 0 : geo.crownR * Math.sqrt(s);
  }

  const t = (y - geo.crownY) / Math.max(1, geo.headBot - geo.crownY);
  const c = Math.cos((t * Math.PI) / 2);

  return geo.chinHalf + (geo.crownR - geo.chinHalf) * c * c;
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
 * Bin-4 skeleton ring: deep scroll pools 4x4 cells against a 0.5 mean
 * gate, and the egg's thin outline can split across bin boundaries and
 * vanish — leaving a headless martini-glass skeleton. Walk every pooled
 * bin the egg outline crosses; where a bin's mass falls short, promote
 * the rim-most cells INSIDE the egg to '#' studs until the bin clears the
 * gate — a sparse bright ring, roughly one stud cluster per four cells,
 * that keeps the dotted egg alive at depth. Bins with too little egg to
 * ever clear the gate are left untouched (no stray bright crumbs), and
 * nothing is written outside the silhouette.
 */
function reinforceEggSkeleton(cols: number, rows: number, geo: MicGeometry): void {
  const binKeys: number[] = [];
  const seen = new Set<number>();
  const mark = (x: number, y: number): void => {
    if (x < 0 || x >= cols || y < 0 || y >= rows) {
      return;
    }

    const key = Math.floor(y / POOL) * 8192 + Math.floor(x / POOL);

    if (!seen.has(key)) {
      seen.add(key);
      binKeys.push(key);
    }
  };

  for (let y = geo.headTop; y <= geo.headBot; y++) {
    const hw = eggHalfWidth(y, geo);

    if (hw < 0) {
      continue;
    }

    const hwI = Math.max(1, Math.round(hw));

    // The crown cap rows are outline across their full width; every other
    // row contributes its two silhouette-edge cells to the ring.
    if (y <= geo.headTop + 1) {
      for (let dx = -hwI; dx <= hwI; dx++) {
        mark(geo.cx + dx, y);
      }
    } else {
      mark(geo.cx - hwI, y);
      mark(geo.cx + hwI, y);
    }
  }

  for (const key of binKeys) {
    const bx = (key % 8192) * POOL;
    const by = Math.floor(key / 8192) * POOL;
    const cells: Array<{ depth: number; i: number }> = [];
    let sum = 0;
    let reachable = 0;

    for (let y = by; y < by + POOL && y < rows; y++) {
      const hw = y >= geo.headTop && y <= geo.headBot ? eggHalfWidth(y, geo) : -1;

      for (let x = bx; x < bx + POOL && x < cols; x++) {
        const v = base[y * cols + x] ?? 0;
        sum += v;

        // Candidate studs live on or inside the egg rim (0.6 covers the
        // rounded silhouette edge), nearest-the-rim first.
        const depth = hw < 0 ? -1 : hw - Math.abs(x - geo.cx);

        if (depth >= -0.6) {
          cells.push({ depth, i: y * cols + x });
          reachable += Math.max(0, STUD_LUM - v);
        }
      }
    }

    if (sum >= POOL_GATE || sum + reachable < POOL_GATE) {
      continue;
    }

    cells.sort((a, b) => a.depth - b.depth || a.i - b.i);

    for (const cell of cells) {
      if (sum >= POOL_GATE) {
        break;
      }

      const cur = base[cell.i] ?? 0;

      if (cur < STUD_LUM) {
        base[cell.i] = STUD_LUM;
        sum += STUD_LUM - cur;
      }
    }
  }
}

/**
 * Static architecture: the egg head — crown outline, fanned grille ribs
 * converging toward the chin, the curved nameplate band, the smooth chrome
 * shell below it — then the U-yoke cradle (arms, pivot bosses, U-strap),
 * the swivel knuckle, the thin pole, the low two-tier base, and the
 * full-bleed floor line.
 */
function buildBase(cols: number, rows: number): void {
  base = new Float32Array(cols * rows);
  baseCols = cols;
  baseRows = rows;

  const geo = geometry(cols, rows);
  const hwBand = Math.max(1, eggHalfWidth(geo.bandMid, geo));
  const hwInBand = Math.max(2, hwBand - CROWN_T);

  // The head: crown outline around a fanned grille, the curved nameplate
  // band, and the smooth shell below it down to the chin rim.
  for (let y = geo.headTop; y <= geo.headBot; y++) {
    const hw = eggHalfWidth(y, geo);

    if (hw < 0) {
      continue;
    }

    const hwI = Math.max(1, Math.round(hw));

    for (let dx = -hwI; dx <= hwI; dx++) {
      const x = geo.cx + dx;

      // The crown cap: the top two rows are solid outline.
      if (y <= geo.headTop + 1) {
        putMax(base, cols, rows, x, y, CROWN_LUM);
        continue;
      }

      // The chin rim: the bottom two rows close the egg.
      if (y >= geo.headBot - 1) {
        putMax(base, cols, rows, x, y, CHIN_RIM_LUM);
        continue;
      }

      // The nameplate band curves down toward the edges (convex surface).
      const bandOff = Math.round(BAND_CURVE * Math.pow(Math.abs(dx) / hwBand, 2));
      const yb = y - bandOff;

      if (yb >= geo.bandY0 && yb <= geo.bandY1) {
        const u = Math.min(1, Math.abs(dx) / hwI);
        const v =
          yb === geo.bandMid
            ? Math.abs(dx) <= 2
              ? BAND_CORE_LUM
              : BAND_MID_LUM + BAND_GAIN * (1 - u)
            : BAND_EDGE_LUM + BAND_GAIN * (1 - u);
        putMax(base, cols, rows, x, y, v);
        continue;
      }

      const belowBand = yb > geo.bandY1;

      if (Math.abs(dx) >= hw - (belowBand ? SHELL_T : CROWN_T)) {
        putMax(base, cols, rows, x, y, belowBand ? SHELL_EDGE_LUM : CROWN_LUM);
        continue;
      }

      // Below the band: smooth chrome shell — but the fan's wide ribs
      // continue as sparser, quieter strokes through the chin taper, so
      // the grille doesn't end on a hard seam (no Shell-logo scallop).
      if (belowBand) {
        const hwIn2 = hw - SHELL_T;
        let lum = SHELL_FILL_LUM;

        if (hwIn2 >= 2 && y < geo.headBot - 2) {
          const s2 = Math.sqrt(hwIn2 / hwInBand);

          for (let k = 0; k < RIB_FRACTIONS.length; k += 2) {
            if (Math.abs(Math.abs(dx) - (RIB_FRACTIONS[k] ?? 0) * hwInBand * s2) <= 0.6) {
              lum = CHIN_RIB_LUM;
              break;
            }
          }
        }

        putMax(base, cols, rows, x, y, lum);
        continue;
      }

      // The grille fan: rib anchors are fractions of the band-row width,
      // scaled per row by sqrt(width ratio) — near-vertical ribs that open
      // at the wide crown and converge gently toward the narrow chin.
      const hwIn = hw - CROWN_T;

      if (hwIn < 2) {
        putMax(base, cols, rows, x, y, SLOT_LUM);
        continue;
      }

      const s = Math.sqrt(hwIn / hwInBand);
      const uEdge = Math.min(1, Math.abs(dx) / hwIn);
      let ribLum = SLOT_LUM + SLOT_SHEEN * uEdge * uEdge * uEdge;

      for (let k = 0; k < RIB_FRACTIONS.length; k++) {
        const d = Math.abs(Math.abs(dx) - (RIB_FRACTIONS[k] ?? 0) * hwInBand * s);
        const wide = (k & 1) === 0;

        if (d <= (wide ? 0.9 : 0.45)) {
          const g = 1 - Math.min(1, Math.abs(y - geo.bandMid) / Math.max(1, geo.headBot - geo.headTop));
          ribLum = (wide ? RIB_EVEN_LUM : RIB_ODD_LUM) + RIB_GAIN * g;
          break;
        }
      }

      putMax(base, cols, rows, x, y, ribLum);
    }
  }

  // The yoke: straight VERTICAL arms flanking the egg — the dark wedge
  // that opens between the narrowing head and the arms is what makes the
  // egg read as HELD in a cradle — closed by an elliptical strap whose
  // dark throat separates the chin from the stand.
  const armX = Math.round(Math.max(0, eggHalfWidth(geo.pivotY, geo))) + YOKE_GAP + 1;
  const uTop = Math.min(geo.uBot - 1, geo.headBot + 1);
  const uRyOut = Math.max(2, geo.uBot - uTop) + 0.5;
  const uRxOut = armX + YOKE_ARM_T - 0.5;

  for (let y = geo.pivotY; y < uTop; y++) {
    for (let j = 0; j < YOKE_ARM_T; j++) {
      const lum = j === 0 || j === YOKE_ARM_T - 1 ? YOKE_EDGE_LUM : YOKE_FILL_LUM;
      putMax(base, cols, rows, geo.cx - armX - j, y, lum);
      putMax(base, cols, rows, geo.cx + armX + j, y, lum);
    }
  }

  // The U-strap: a thin curved band riding the outer ellipse arc from arm
  // tip to arm tip — constant STRAP_T thickness, never a filled bowl, so
  // nothing below the chin tapers like a funnel; the throat above the
  // strap stays dark and the chin floats HELD.
  for (let dx = -Math.ceil(uRxOut); dx <= Math.ceil(uRxOut); dx++) {
    const q = 1 - (dx / uRxOut) * (dx / uRxOut);

    if (q <= 0) {
      continue;
    }

    const yOut = uRyOut * Math.sqrt(q);
    const vy0 = Math.max(0, Math.ceil(yOut - STRAP_T));

    for (let vy = vy0; vy <= Math.floor(yOut); vy++) {
      const edge = yOut - vy < 0.9 || vy === vy0;
      putMax(base, cols, rows, geo.cx + dx, uTop + vy, edge ? YOKE_EDGE_LUM : YOKE_FILL_LUM);
    }
  }

  // The pivot-screw bosses: a '+'-weight block with a '#' screw center
  // capping each arm, beside the head — the cradle visibly HOLDS.
  for (let dy = -2; dy <= 2; dy++) {
    const o0 = Math.abs(dy) === 2 ? armX : armX - 1;
    const o1 = Math.abs(dy) === 2 ? armX + 3 : armX + 4;

    for (let o = o0; o <= o1; o++) {
      const v = dy === 0 && o === armX + 2 ? BOSS_CORE_LUM : BOSS_LUM;
      putMax(base, cols, rows, geo.cx + o, geo.pivotY + dy, v);
      putMax(base, cols, rows, geo.cx - o, geo.pivotY + dy, v);
    }
  }

  // The stand adapter: a small RECTANGULAR block — four cells wide, no
  // taper — coupling the strap to the pole. It shares the pole's bin
  // column (cx..cx+3 at the tuned grid) so the stem stays continuous at
  // deep scroll, and it kills the wine-glass funnel outright.
  for (let y = geo.uBot; y <= geo.knuckleBot; y++) {
    for (let dx = 0; dx < 4; dx++) {
      putMax(base, cols, rows, geo.cx + dx, y, y === geo.uBot ? YOKE_EDGE_LUM : ADAPTER_LUM);
    }
  }

  // The pole: three thin cells starting at cx — at the tuned 224-col grid
  // cx = 112 is bin-aligned (112 % 4 == 0), so the stem's pooled luminance
  // crosses the bin-4 threshold and survives deep scroll as a column.
  for (let y = geo.knuckleBot + 1; y < geo.baseTop; y++) {
    for (let j = 0; j < POLE_LUMS.length; j++) {
      putMax(base, cols, rows, geo.cx + j, y, POLE_LUMS[j] ?? 0);
    }
  }

  // The base: two low wide tiers with rounded ends, hugging the floor.
  const split = geo.baseTop + Math.max(1, Math.floor((geo.floorRow - geo.baseTop) * 0.4));

  for (let y = geo.baseTop; y < geo.floorRow; y++) {
    const hw = y < split ? Math.round(geo.baseHalf * 0.62) : geo.baseHalf;
    const top = y === geo.baseTop || y === split;

    for (let dx = -hw; dx <= hw; dx++) {
      const end = Math.abs(dx) > hw - 2;
      putMax(base, cols, rows, geo.cx + 1 + dx, y, end ? BASE_END_LUM : top ? BASE_TOP_LUM : BASE_FILL_LUM);
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

  // Last: the bin-4 skeleton ring, measured against the finished statics.
  reinforceEggSkeleton(cols, rows, geo);
}

export const scene: SceneModule = {
  dockGlyph: [
    "  ·+====+·  ",
    " ·|=|==|=|· ",
    " +·|#@#|·+  ",
    "  =·|--|·=  ",
    "    ·||·    ",
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
      arcInner: 9,
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
      arcInner = 9,
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
    // nameplate band to both sides — pure f(time): phase = r - speed*time.
    // Brightness falls with radius and the arcs fade before the edges.
    // arcR0 clears the egg's crown corners (their radius from the band
    // center is ~1.3x crownR), so no ring ever paints the grille.
    const arcR0 = geo.crownR + arcInner;
    const arcR1 = Math.max(arcR0 + 8, w * arcSpanFrac);
    // The arcs' floor: trimmed above the waveform's horizon so their
    // bottoms never curl under the head and close into a badge circle.
    const arcCut = geo.waveRow - 8;
    const arcSpan = Math.max(1, arcR1 - arcR0);
    const hazeR = geo.crownR * hazeRadius;
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

        if (r < arcR0 || r >= arcR1 || y >= arcCut) {
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
      // Follow the plate's convex dip (same per-column offset as buildBase)
      // so the crest brightens the curved nameplate itself, never a straight
      // bar flashing across the grille above its edges.
      const hwBand = Math.max(1, eggHalfWidth(geo.bandMid, geo));
      const hwMax = Math.round(hwBand);

      for (let dx = -hwMax; dx <= hwMax; dx++) {
        const x = geo.cx + dx;

        if (x < 0 || x >= w) {
          continue;
        }

        const bandOff = Math.round(BAND_CURVE * Math.pow(Math.abs(dx) / hwBand, 2));

        for (let y = geo.bandY0 + bandOff; y <= geo.bandY1 + bandOff; y++) {
          if (y < 0 || y >= h) {
            continue;
          }

          const hw = eggHalfWidth(y, geo);

          if (hw < 1 || Math.abs(dx) > hw) {
            continue;
          }

          const i = y * w + x;
          data[i] = clamp01((data[i] ?? 0) + pulse * (1 - Math.abs(dx) / hwBand));
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
