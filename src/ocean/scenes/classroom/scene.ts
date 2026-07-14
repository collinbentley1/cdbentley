/**
 * Scene 3 — "A classroom at night, chairs on desks: chalk ghosts animating
 * faintly." (design-brief-ocean.md)
 *
 * A dark room built once into static luminance bases at init: chalkboard
 * with frame and tray, a mullioned window with the moon in its upper pane,
 * a door on the far-left wall, desks with chairs stacked upside down on
 * top plus one larger offset teacher's desk, and a moonlight shaft that
 * falls visibly FROM the window onto the floor (a faint mullion shadow
 * seams the pool). The board says chalkboard: four rows of faint
 * dash-writing — word-length runs with gaps, never letters or words, so
 * nothing reads as copy — and one recognizable chalk figure, a circle
 * with a chord. The one quiet idiomatic motion is those chalk marks
 * breathing: each surfaces a little brighter out of the board dust and
 * settles again on slow staggered cycles, over a barely-there chalk-dust
 * shimmer, while one SDK light source sways imperceptibly over the
 * moonlight pool.
 *
 * Compaction legibility: the room is line art, and 1-cell strokes average
 * away to black under bin-4 pooling. So init bakes THREE bases with stroke
 * thickness matched to the bin stride (1/2/4, small gain), and update picks
 * one via resolutionForDepth(context.depth) — a pure function of depth, so
 * scroll-up re-blooms along the exact same path. As the scene forgets
 * itself the dust and chalk marks drain away first; the thickened skeleton
 * (board frame, desks, window, door) is what survives into the residue.
 *
 * No human-readable text is rendered by this sim; the chalk marks are
 * deliberately non-lexical. The chapter prose beside this scene is DOM.
 */

import { createValueNoise, fbm2, resolutionForDepth } from "../../sdk/index.ts";
import type { LuminanceBuffer, SceneContext, SceneModule } from "../../sdk/index.ts";

const noise = createValueNoise(31);

/** Deterministic hash -> [0,1), used to cut the writing into word runs. */
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;

  return s - Math.floor(s);
}

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

interface MarkSample {
  readonly index: number;
  readonly weight: number;
}

/** One breathing chalk mark: baked samples plus its apply-time gain. */
interface Mark {
  readonly samples: MarkSample[];
  readonly gain: number;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Max-blend drawing pen over a Float32Array, with stroke width and gain. */
interface Pen {
  cell(x: number, y: number, v: number): void;
  rect(r: Rect, v: number): void;
  h(x0: number, x1: number, y: number, v: number): void;
  v(x: number, y0: number, y1: number, v: number): void;
}

/** Static room luminance, one base per bin stride (strokes thicken with bin). */
let bases: Partial<Record<1 | 2 | 4, Float32Array>> = {};
/** Breathing chalk marks (writing rows + the circle figure). */
let marks: Mark[] = [];
/** Board interior (dust shimmer + mark region), buffer cell coords. */
let board: Rect = { x0: 0, x1: 0, y0: 0, y1: 0 };
/** Resting position of the moonlight pool light. */
let moonX = 0;
let moonY = 0;

function makePen(target: Float32Array, w: number, h: number, stroke: number, gain: number): Pen {
  const put = (x: number, y: number, v: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) {
      return;
    }

    const i = y * w + x;
    target[i] = Math.max(target[i] ?? 0, clamp01(v * gain));
  };
  const rect = (r: Rect, v: number): void => {
    for (let y = r.y0; y <= r.y1; y++) {
      for (let x = r.x0; x <= r.x1; x++) {
        put(x, y, v);
      }
    }
  };

  return {
    cell: put,
    h: (x0, x1, y, v) => {
      rect({ x0, x1, y0: y, y1: y + stroke - 1 }, v);
    },
    rect,
    v: (x, y0, y1, v) => {
      rect({ x0: x, x1: x + stroke - 1, y0, y1 }, v);
    },
  };
}

/** One desk with an upside-down chair on top (seat down, legs up). */
function drawDeskWithChair(
  pen: Pen,
  cx: number,
  deskTopY: number,
  deskW: number,
  legDrop: number,
  chairLegH: number,
  dim: number,
): void {
  const half = Math.floor(deskW / 2);
  const x0 = cx - half;
  const x1 = cx + half;

  // Desk slab: bright top edge, dimmer underside, legs down to the floor.
  pen.h(x0, x1, deskTopY, 0.56 * dim);
  pen.h(x0 + 1, x1 - 1, deskTopY + 1, 0.3 * dim);
  pen.v(x0 + 1, deskTopY + 2, deskTopY + legDrop, 0.6 * dim);
  pen.v(x1 - 1, deskTopY + 2, deskTopY + legDrop, 0.6 * dim);

  // Inverted chair: seat slab resting on the desk, legs up, a crossbar.
  const seatY = deskTopY - 1;
  const seatHalf = Math.max(2, Math.floor(deskW * 0.3));
  pen.h(cx - seatHalf, cx + seatHalf, seatY, 0.44 * dim);
  const legTopY = seatY - chairLegH;
  pen.v(cx - seatHalf + 1, legTopY, seatY - 1, 0.64 * dim);
  pen.v(cx + seatHalf - 1, legTopY, seatY - 1, 0.64 * dim);
  pen.h(cx - seatHalf + 1, cx + seatHalf - 1, legTopY, 0.4 * dim);
}

/** The larger offset teacher's desk: wide slab, modesty panel, no chair. */
function drawTeacherDesk(pen: Pen, cx: number, topY: number, deskW: number, legDrop: number): void {
  const half = Math.floor(deskW / 2);
  const x0 = cx - half;
  const x1 = cx + half;

  pen.h(x0, x1, topY, 0.62);
  pen.h(x0 + 1, x1 - 1, topY + 1, 0.32);
  pen.v(x0 + 1, topY + 2, topY + legDrop, 0.62);
  pen.v(x1 - 1, topY + 2, topY + legDrop, 0.62);

  // Modesty panel between the legs: a faint mottled face, unlike the open
  // student desks — some cells fall below the first ramp step on purpose.
  for (let y = topY + 2; y <= topY + legDrop - 1; y++) {
    for (let x = x0 + 3; x <= x1 - 3; x++) {
      pen.cell(x, y, 0.07 + 0.08 * fbm2(noise, x * 0.5, y * 0.7, 2));
    }
  }

  // Something left on top: a short stack and one small mug-like dot.
  const stackX = x0 + Math.max(3, Math.floor(deskW * 0.22));
  pen.h(stackX, stackX + 3, topY - 1, 0.5);
  pen.cell(x1 - Math.max(3, Math.floor(deskW * 0.2)), topY - 1, 0.46);
}

/** Draw the whole room through a pen; returns the board interior rect. */
function drawRoom(pen: Pen, w: number, h: number): Rect {
  const X = (f: number): number => Math.round(f * (w - 1));
  const Y = (f: number): number => Math.round(f * (h - 1));

  // Chalkboard: frame (= top/bottom, | sides, # corners), dusty interior.
  const frame: Rect = { x0: X(0.16), x1: X(0.72), y0: Y(0.1), y1: Y(0.48) };
  const interior: Rect = { x0: frame.x0 + 1, x1: frame.x1 - 1, y0: frame.y0 + 1, y1: frame.y1 - 1 };
  pen.h(frame.x0, frame.x1, frame.y0, 0.56);
  pen.h(frame.x0, frame.x1, frame.y1, 0.56);
  pen.v(frame.x0, frame.y0, frame.y1, 0.69);
  pen.v(frame.x1, frame.y0, frame.y1, 0.69);
  pen.cell(frame.x0, frame.y0, 0.81);
  pen.cell(frame.x1, frame.y0, 0.81);
  pen.cell(frame.x0, frame.y1, 0.81);
  pen.cell(frame.x1, frame.y1, 0.81);

  // Board interior: uneven chalk-dust residue (static component). Fine-grain
  // and mostly below the first ramp step, so the board reads as near-black
  // slate with sparse dust — the writing must be the visible event.
  for (let y = interior.y0; y <= interior.y1; y++) {
    for (let x = interior.x0; x <= interior.x1; x++) {
      const n = fbm2(noise, x * 0.33, y * 0.61, 2);
      pen.cell(x, y, 0.05 + 0.05 * n);
    }
  }

  // Chalk tray under the board, with a couple of brighter chalk stubs.
  const trayY = Math.min(h - 1, frame.y1 + 2);
  pen.h(frame.x0 + 2, frame.x1 - 2, trayY, 0.44);
  pen.h(X(0.3), X(0.32), trayY - 1, 0.62);
  pen.h(X(0.55), X(0.56), trayY - 1, 0.62);

  // Window, right wall: frame, mullion cross, the moon in the upper-left
  // pane, faint night panes, a sill.
  const win: Rect = { x0: X(0.8), x1: X(0.94), y0: Y(0.08), y1: Y(0.46) };
  const midX = Math.round((win.x0 + win.x1) / 2);
  const midY = Math.round((win.y0 + win.y1) / 2);

  // Night panes: near-black with the faintest noise, plus a soft gradient
  // fading down and away from the moon.
  for (let y = win.y0 + 1; y <= win.y1 - 1; y++) {
    for (let x = win.x0 + 1; x <= win.x1 - 1; x++) {
      const n = fbm2(noise, x * 0.41, y * 0.53, 2);
      const down = (y - win.y0) / (win.y1 - win.y0);
      pen.cell(x, y, 0.03 + 0.03 * n + 0.05 * (1 - down));
    }
  }

  // The moon: a bright disc with a soft halo, clipped to the upper-left
  // pane so the mullion cross stays legible in front of the glow.
  const moonCX = win.x0 + (midX - win.x0) * 0.55;
  const moonCY = win.y0 + (midY - win.y0) * 0.45;
  const moonR = Math.max(2.4, (midX - win.x0) * 0.36);

  for (let y = win.y0 + 1; y <= midY - 1; y++) {
    for (let x = win.x0 + 1; x <= midX - 1; x++) {
      const d = Math.hypot(x - moonCX, y - moonCY) / moonR;

      if (d <= 1) {
        pen.cell(x, y, 0.8 + 0.08 * (1 - d * d));
      } else {
        pen.cell(x, y, 0.22 * Math.exp(-(d - 1) * 2.6));
      }
    }
  }

  // Two faint stars in the other panes.
  pen.cell(win.x1 - 3, win.y0 + 3, 0.3);
  pen.cell(midX + 3, midY + 5, 0.26);

  // Frame, mullion cross, sill — drawn after the panes so they stay crisp.
  pen.h(win.x0, win.x1, win.y0, 0.56);
  pen.h(win.x0, win.x1, win.y1, 0.56);
  pen.v(win.x0, win.y0, win.y1, 0.69);
  pen.v(win.x1, win.y0, win.y1, 0.69);
  pen.h(win.x0 + 1, win.x1 - 1, midY, 0.5);
  pen.v(midX, win.y0 + 1, win.y1 - 1, 0.5);
  pen.h(win.x0 - 1, win.x1 + 1, Math.min(h - 1, win.y1 + 1), 0.44);

  // Moonlight shaft: a diagonal band falling FROM the window down-left to
  // the floor. Barely-there in the air, brighter where it pools on the
  // floor, with a dark seam where the vertical mullion shadows the pool.
  const shaftTop = win.y1 + 2;
  const shaftBottom = Y(0.95);
  const floorStart = Y(0.74);
  const drop = Math.max(1, shaftBottom - shaftTop);
  const slide = (win.x1 - win.x0) * 1.35;

  for (let y = shaftTop; y <= shaftBottom; y++) {
    const t = (y - shaftTop) / drop;
    const xL = win.x0 + 1 - slide * t - 2 * t;
    const xR = win.x1 - 1 - slide * t + 3 * t;

    for (let x = Math.max(0, Math.round(xL)); x <= Math.min(w - 1, Math.round(xR)); x++) {
      const u = (x - xL) / Math.max(1, xR - xL);
      const soft = Math.sin(Math.PI * clamp01(u));
      const n = fbm2(noise, x * 0.21, y * 0.37, 2);
      // The mullion's shadow runs down the middle of the shaft.
      const seam = Math.abs(u - 0.5) < 0.055 ? 0.35 : 1;

      if (y < floorStart) {
        pen.cell(x, y, (0.04 + 0.045 * soft + 0.02 * n) * seam);
      } else {
        pen.cell(x, y, (0.08 + 0.1 * soft + 0.03 * n) * seam);
      }
    }
  }

  // Door, far left: lintel + jambs down to the floor line, one bright
  // handle. Jamb columns land on even x so both pool identically at bin 2
  // (the board and window frames pool the same way).
  const door: Rect = { x0: X(0.045), x1: X(0.105), y0: Y(0.18), y1: Y(0.7) };
  pen.h(door.x0, door.x1, door.y0, 0.56);
  pen.v(door.x0, door.y0, door.y1, 0.69);
  pen.v(door.x1, door.y0, door.y1, 0.69);
  pen.cell(door.x1 - 2, Y(0.43), 0.85); // handle dot

  // Desks with stacked chairs: back row (dimmer, higher), then front row.
  // The front-left slot belongs to the larger, offset teacher's desk.
  const backW = Math.max(6, Math.round(w * 0.09));
  const frontW = Math.max(8, Math.round(w * 0.13));

  for (const cx of [0.16, 0.38, 0.62, 0.86]) {
    drawDeskWithChair(pen, X(cx), Y(0.66), backW, Math.round(h * 0.07), Math.round(h * 0.07), 0.72);
  }

  for (const cx of [0.52, 0.8]) {
    drawDeskWithChair(pen, X(cx), Y(0.82), frontW, Math.round(h * 0.1), Math.round(h * 0.09), 1);
  }

  drawTeacherDesk(pen, X(0.19), Y(0.8), Math.round(w * 0.17), Math.round(h * 0.12));

  return interior;
}

/**
 * Stamp a fractional point into a sample map with bilinear weights, so
 * strokes stay soft at grid scale.
 */
function stamp(samples: Map<number, number>, w: number, h: number, px: number, py: number, weight: number): void {
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const fx = px - x0;
  const fy = py - y0;
  const parts: [number, number, number][] = [
    [x0, y0, (1 - fx) * (1 - fy)],
    [x0 + 1, y0, fx * (1 - fy)],
    [x0, y0 + 1, (1 - fx) * fy],
    [x0 + 1, y0 + 1, fx * fy],
  ];

  for (const [x, y, k] of parts) {
    if (x < 0 || y < 0 || x >= w || y >= h) {
      continue;
    }

    const index = y * w + x;
    samples.set(index, Math.min(1, (samples.get(index) ?? 0) + weight * k));
  }
}

/**
 * Bake one row of dash-writing: word-length runs (2-5 cells) separated by
 * short gaps, pressure jittered per cell so it reads as erased handwriting,
 * never as glyphs.
 */
function bakeWritingRow(u0: number, u1: number, v: number, seed: number, w: number, h: number): MarkSample[] {
  const samples = new Map<number, number>();
  const bw = board.x1 - board.x0;
  const bh = board.y1 - board.y0;
  const y = board.y0 + v * bh;
  let x = board.x0 + u0 * bw;
  const end = board.x0 + u1 * bw;
  let word = 0;

  while (x < end) {
    const runLength = 2 + Math.floor(hash01(seed * 53 + word) * 4);
    const gap = 1 + Math.floor(hash01(seed * 71 + word) * 2);

    for (let k = 0; k < runLength && x < end; k++) {
      const pressure = 0.7 + 0.3 * hash01(seed * 97 + word * 13 + k);
      const jitterY = (hash01(seed * 41 + word * 7 + k) - 0.5) * 0.55;
      stamp(samples, w, h, x, y + jitterY, pressure);
      x += 1;
    }

    x += gap;
    word++;
  }

  return [...samples.entries()].map(([index, weight]) => ({ index, weight }));
}

/** Bake a parametric chalk stroke with mild fragmentation (chalk texture). */
function bakeStroke(
  path: (t: number) => readonly [number, number],
  steps: number,
  seed: number,
  w: number,
  h: number,
  dropout = 0.1,
): MarkSample[] {
  const samples = new Map<number, number>();

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;

    // Mild chalk dropout — the figure must stay recognizable.
    if (hash01(seed * 61 + s) < dropout) {
      continue;
    }

    const [px, py] = path(t);
    const pressure = 0.62 + 0.38 * hash01(seed * 97 + s);
    stamp(samples, w, h, px, py, pressure);
  }

  return [...samples.entries()].map(([index, weight]) => ({ index, weight }));
}

function buildMarks(w: number, h: number): Mark[] {
  const built: Mark[] = [];

  // Four rows of dash-writing down the left side of the board, the last
  // one shorter, like a trailing line of notes.
  built.push({ gain: 1, samples: bakeWritingRow(0.05, 0.62, 0.16, 1, w, h) });
  built.push({ gain: 1, samples: bakeWritingRow(0.05, 0.58, 0.36, 2, w, h) });
  built.push({ gain: 1, samples: bakeWritingRow(0.05, 0.62, 0.56, 3, w, h) });
  built.push({ gain: 1, samples: bakeWritingRow(0.05, 0.38, 0.76, 4, w, h) });

  // One recognizable chalk figure: a circle with a chord, right of the
  // writing. Drawn in cell space so it renders round (cells are square).
  const bw = board.x1 - board.x0;
  const bh = board.y1 - board.y0;
  const cx = board.x0 + 0.8 * bw;
  const cy = board.y0 + 0.5 * bh;
  const r = Math.min(bh * 0.38, bw * 0.14);
  const circle = bakeStroke(
    (t) => {
      const a = t * Math.PI * 2;

      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    },
    150,
    6,
    w,
    h,
  );
  const a1 = (170 * Math.PI) / 180;
  const a2 = (315 * Math.PI) / 180;
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const chord = bakeStroke((t) => [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t], 80, 7, w, h, 0.04);
  built.push({ gain: 1.2, samples: circle.concat(chord) });

  return built;
}

function buildBases(buffer: LuminanceBuffer): void {
  const w = buffer.width;
  const h = buffer.height;
  bases = {};

  // Stroke thickness tracks the bin stride so line art survives average
  // pooling; the small gain offsets partial block coverage at the edges.
  for (const [stroke, gain] of [
    [1, 1],
    [2, 1.15],
    [4, 1.35],
  ] as const) {
    const target = new Float32Array(w * h);
    board = drawRoom(makePen(target, w, h, stroke, gain), w, h);
    bases[stroke as 1 | 2 | 4] = target;
  }

  // The light rests over the floor pool, down-left of the window.
  moonX = Math.round(0.69 * (w - 1));
  moonY = Math.round(0.85 * (h - 1));
  marks = buildMarks(w, h);
}

/**
 * Mark envelope: each chalk mark brightens once per period inside its duty
 * window, eased in and out; staggered so the board is never crowded.
 */
function markEnvelope(time: number, index: number, period: number, stagger: number, duty: number): number {
  const p = time / Math.max(0.001, period) + index * stagger;
  const cycle = p - Math.floor(p);
  const d = Math.min(0.95, Math.max(0.02, duty));

  if (cycle >= d) {
    return 0;
  }

  const s = Math.sin((Math.PI * cycle) / d);

  return s * s;
}

export const scene: SceneModule = {
  dockGlyph: [
    "#==========#",
    "| --- -- · |",
    "| -- ----  |",
    "#==========#",
    "  |·|  |·|  ",
    " -========- ",
  ],
  id: "classroom",
  init(context: SceneContext): void {
    buildBases(context.buffer);
    context.lights.length = 0;
    context.lights.push({
      intensity: this.tuning.motion.moonIntensity ?? 0.07,
      radius: Math.max(6, context.buffer.width * 0.1),
      x: moonX,
      y: moonY,
    });
  },
  summaryChip: "Beijing, 2019–2020 — teaching STEM at AndKids.",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 176,
    minimalGlyph: "·",
    motion: {
      chalkBase: 0.24,
      chalkBreathe: 0.14,
      chalkDuty: 0.42,
      chalkPeriod: 19,
      chalkStagger: 0.23,
      dustAmp: 0.03,
      dustDrift: 0.05,
      moonIntensity: 0.07,
      moonSway: 0.02,
    },
    ramp: " ·:-=|#@",
    rows: 80,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, lights, time } = context;
    const {
      chalkBase = 0.24,
      chalkBreathe = 0.14,
      chalkDuty = 0.42,
      chalkPeriod = 19,
      chalkStagger = 0.23,
      dustAmp = 0.03,
      dustDrift = 0.05,
      moonIntensity = 0.07,
      moonSway = 0.02,
    } = this.tuning.motion;
    const data = buffer.data;

    if ((bases[1]?.length ?? 0) !== data.length) {
      buildBases(buffer);
    }

    // 1) Static room, stroke-matched to the current bin stride (pure in depth).
    const resolution = resolutionForDepth(context.depth, this.tuning.resolution);
    data.set(bases[resolution.bin] ?? bases[1] ?? data);

    // 2) Chalk-dust shimmer, board interior only: slow, barely-there.
    const w = buffer.width;

    for (let y = board.y0; y <= board.y1; y++) {
      const ny = y * 0.47 - time * dustDrift * 0.6;

      for (let x = board.x0; x <= board.x1; x++) {
        const n = fbm2(noise, x * 0.29 + time * dustDrift, ny, 2);
        const i = y * w + x;
        data[i] = clamp01((data[i] ?? 0) + (n - 0.5) * 2 * dustAmp);
      }
    }

    // 3) The chalk marks: always faintly present, breathing brighter one
    // at a time. Applied at cell resolution, so compaction pools them away
    // before the room's skeleton — the writing is forgotten first.
    for (let g = 0; g < marks.length; g++) {
      const mark = marks[g];

      if (!mark) {
        continue;
      }

      const breathe = markEnvelope(time, g, chalkPeriod, chalkStagger, chalkDuty) * chalkBreathe;
      const a = (chalkBase + breathe) * mark.gain;

      if (a <= 0.004) {
        continue;
      }

      for (const { index, weight } of mark.samples) {
        data[index] = clamp01((data[index] ?? 0) + weight * a);
      }
    }

    // 4) Moonlight pool sways on a decades-slow arc.
    const light = lights[0];

    if (light) {
      light.x = moonX + Math.sin(time * moonSway * Math.PI * 2) * 2;
      light.y = moonY + Math.cos(time * moonSway * Math.PI * 2 * 0.7) * 1;
      light.intensity = clamp01(moonIntensity);
    }
  },
};
