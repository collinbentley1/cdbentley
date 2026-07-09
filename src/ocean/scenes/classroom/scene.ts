/**
 * Scene 3 — "A classroom at night, chairs on desks: chalk ghosts animating
 * faintly." (design-brief-ocean.md)
 *
 * A dark room built once into static luminance bases at init: chalkboard
 * with frame and tray, a window with muntins, a door outline, two rows of
 * desks with chairs stacked upside down on top, a moonlight pool on the
 * floor. The one quiet idiomatic motion is the chalk ghosts: four abstract
 * erased-stroke shapes (an orbit, a wave, hatching, a boxed diagram — never
 * letters or words, so nothing reads as copy) that surface out of the board
 * dust and fade again on slow staggered cycles. Beneath them, a barely-there
 * chalk-dust shimmer breathes on the board, and one SDK light source sways
 * imperceptibly over the moonlight pool.
 *
 * Compaction legibility: the room is line art, and 1-cell strokes average
 * away to black under bin-4 pooling. So init bakes THREE bases with stroke
 * thickness matched to the bin stride (1/2/4, small gain), and update picks
 * one via resolutionForDepth(context.depth) — a pure function of depth, so
 * scroll-up re-blooms along the exact same path. As the scene forgets
 * itself the dust and ghosts drain away first; the thickened skeleton
 * (board frame, desks, window) is what survives into the residue.
 *
 * Copy rules for this scene (binding): FACTS.md C5 — the school is
 * "international bilingual school, Beijing", never the brand name, anywhere.
 * The education thread is L3-listed but ungraded (including the "+60%
 * DIBELS" figure): claim slots stay TODO(collin) placeholders until graded.
 * No human-readable text is rendered by this sim; the ghost strokes are
 * deliberately non-lexical.
 */

import { createValueNoise, fbm2, resolutionForDepth } from "../../sdk/index.ts";
import type { LuminanceBuffer, SceneContext, SceneModule } from "../../sdk/index.ts";

const noise = createValueNoise(31);

/** Deterministic hash -> [0,1), used to fragment the ghost strokes. */
function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;

  return s - Math.floor(s);
}

function clamp01(v: number): number {
  return v <= 0 ? 0 : v >= 1 ? 1 : v;
}

interface GhostSample {
  readonly index: number;
  readonly weight: number;
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
/** One sample list per ghost stroke, in buffer indices. */
let ghosts: GhostSample[][] = [];
/** Board interior (dust shimmer + ghost region), buffer cell coords. */
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
  pen.v(cx - seatHalf + 1, legTopY, seatY - 1, 0.68 * dim);
  pen.v(cx + seatHalf - 1, legTopY, seatY - 1, 0.68 * dim);
  pen.h(cx - seatHalf + 1, cx + seatHalf - 1, legTopY, 0.4 * dim);
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
  // slate with sparse dust — the ghosts must be the visible event.
  for (let y = interior.y0; y <= interior.y1; y++) {
    for (let x = interior.x0; x <= interior.x1; x++) {
      const n = fbm2(noise, x * 0.33, y * 0.61, 2);
      pen.cell(x, y, 0.06 + 0.05 * n);
    }
  }

  // Chalk tray under the board, with a couple of brighter chalk stubs.
  const trayY = Math.min(h - 1, frame.y1 + 2);
  pen.h(frame.x0 + 2, frame.x1 - 2, trayY, 0.44);
  pen.h(X(0.3), X(0.32), trayY - 1, 0.62);
  pen.h(X(0.55), X(0.56), trayY - 1, 0.62);

  // Window, right wall: frame, cross muntins, faint moonlit panes.
  const win: Rect = { x0: X(0.8), x1: X(0.94), y0: Y(0.08), y1: Y(0.46) };
  pen.rect({ x0: win.x0 + 1, x1: win.x1 - 1, y0: win.y0 + 1, y1: win.y1 - 1 }, 0.17);
  pen.h(win.x0, win.x1, win.y0, 0.56);
  pen.h(win.x0, win.x1, win.y1, 0.56);
  pen.v(win.x0, win.y0, win.y1, 0.69);
  pen.v(win.x1, win.y0, win.y1, 0.69);
  pen.h(win.x0 + 1, win.x1 - 1, Math.round((win.y0 + win.y1) / 2), 0.44);
  pen.v(Math.round((win.x0 + win.x1) / 2), win.y0 + 1, win.y1 - 1, 0.44);

  // Door outline, far left: barely-there.
  const door: Rect = { x0: X(0.04), x1: X(0.11), y0: Y(0.14), y1: Y(0.7) };
  pen.h(door.x0, door.x1, door.y0, 0.19);
  pen.v(door.x0, door.y0, door.y1, 0.19);
  pen.v(door.x1, door.y0, door.y1, 0.19);
  pen.cell(X(0.1), Y(0.42), 0.31); // handle

  // Moonlight pool on the floor, slanting in from the window.
  const poolY0 = Y(0.74);
  const poolY1 = Y(0.94);

  for (let y = poolY0; y <= poolY1; y++) {
    const t = (y - poolY0) / Math.max(1, poolY1 - poolY0);
    const px0 = X(0.6 - 0.06 * t);
    const px1 = X(0.9 - 0.1 * t);

    for (let x = px0; x <= px1; x++) {
      const soft = 1 - Math.abs((x - (px0 + px1) / 2) / ((px1 - px0) / 2 || 1));
      pen.cell(x, y, 0.09 + 0.08 * soft);
    }
  }

  // Desks with stacked chairs: back row (dimmer, higher), then front row.
  const backW = Math.max(6, Math.round(w * 0.09));
  const frontW = Math.max(8, Math.round(w * 0.13));

  for (const cx of [0.14, 0.38, 0.62, 0.86]) {
    drawDeskWithChair(pen, X(cx), Y(0.66), backW, Math.round(h * 0.07), Math.round(h * 0.07), 0.72);
  }

  for (const cx of [0.24, 0.52, 0.8]) {
    drawDeskWithChair(pen, X(cx), Y(0.82), frontW, Math.round(h * 0.1), Math.round(h * 0.09), 1);
  }

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
 * Build one ghost stroke: sample a parametric path in board-local [0,1]²,
 * drop fragments deterministically (erased chalk is never continuous), and
 * bake the survivors into buffer-index samples.
 */
function bakeGhost(
  path: (t: number) => readonly [number, number],
  steps: number,
  seed: number,
  w: number,
  h: number,
): GhostSample[] {
  const samples = new Map<number, number>();
  const bw = board.x1 - board.x0;
  const bh = board.y1 - board.y0;

  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    // Erasure mask: contiguous-ish gaps, deterministic per stroke.
    const gap = hash01(seed * 61 + Math.floor(t * 14));

    if (gap < 0.34) {
      continue;
    }

    const [u, v] = path(t);
    const px = board.x0 + u * bw;
    const py = board.y0 + v * bh;
    const pressure = 0.55 + 0.45 * hash01(seed * 97 + s);
    stamp(samples, w, h, px, py, pressure);
  }

  return [...samples.entries()].map(([index, weight]) => ({ index, weight }));
}

function buildGhosts(w: number, h: number): GhostSample[][] {
  const built: GhostSample[][] = [];

  // Orbit: an erased ellipse with a small offset moon-dot, upper left.
  built.push(
    bakeGhost(
      (t) => {
        const a = t * Math.PI * 2;

        return [0.28 + 0.15 * Math.cos(a), 0.42 + 0.26 * Math.sin(a)];
      },
      170,
      1,
      w,
      h,
    ).concat(
      bakeGhost((t) => [0.47 + 0.015 * Math.cos(t * Math.PI * 2), 0.2 + 0.02 * Math.sin(t * Math.PI * 2)], 22, 5, w, h),
    ),
  );

  // Wave: a long sine stroke across the lower middle of the board.
  built.push(bakeGhost((t) => [0.12 + t * 0.74, 0.68 + 0.09 * Math.sin(t * Math.PI * 4.4)], 190, 2, w, h));

  // Hatching: six short slanted strokes, upper right cluster.
  {
    const cluster: GhostSample[] = [];

    for (let k = 0; k < 6; k++) {
      const ox = 0.6 + k * 0.045;
      cluster.push(...bakeGhost((t) => [ox + t * 0.05, 0.16 + t * 0.2], 26, 10 + k, w, h));
    }

    built.push(cluster);
  }

  // Boxed diagram: a rectangle outline with one diagonal, lower right.
  built.push(
    bakeGhost(
      (t) => {
        if (t < 0.25) {
          return [0.56 + (t / 0.25) * 0.26, 0.52];
        }

        if (t < 0.5) {
          return [0.82, 0.52 + ((t - 0.25) / 0.25) * 0.28];
        }

        if (t < 0.75) {
          return [0.82 - ((t - 0.5) / 0.25) * 0.26, 0.8];
        }

        return [0.56, 0.8 - ((t - 0.75) / 0.25) * 0.28];
      },
      180,
      3,
      w,
      h,
    ).concat(bakeGhost((t) => [0.56 + t * 0.26, 0.8 - t * 0.28], 60, 4, w, h)),
  );

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

  const X = (f: number): number => Math.round(f * (w - 1));
  const Y = (f: number): number => Math.round(f * (h - 1));
  moonX = X(0.76);
  moonY = Y(0.8);
  ghosts = buildGhosts(w, h);
}

/**
 * Ghost envelope: each ghost surfaces once per period inside its duty
 * window, eased in and out; staggered so the board is never crowded.
 */
function ghostEnvelope(time: number, index: number, period: number, stagger: number, duty: number): number {
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
    "|  ·:·   · |",
    "| ·   ··   |",
    "#==========#",
    "  |·|  |·|  ",
    " -========- ",
  ],
  id: "classroom",
  init(context: SceneContext): void {
    buildBases(context.buffer);
    context.lights.length = 0;
    context.lights.push({
      intensity: this.tuning.motion.moonIntensity ?? 0.1,
      radius: Math.max(6, context.buffer.width * 0.09),
      x: moonX,
      y: moonY,
    });
  },
  summaryChip: "TODO(collin): classroom summary line",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 176,
    minimalGlyph: "·",
    motion: {
      dustAmp: 0.035,
      dustDrift: 0.05,
      ghostDuty: 0.38,
      ghostMax: 0.2,
      ghostPeriod: 18,
      ghostStagger: 0.27,
      moonIntensity: 0.1,
      moonSway: 0.02,
    },
    ramp: " ·:-=|#@",
    rows: 80,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, lights, time } = context;
    const {
      dustAmp = 0.035,
      dustDrift = 0.05,
      ghostDuty = 0.38,
      ghostMax = 0.2,
      ghostPeriod = 18,
      ghostStagger = 0.27,
      moonIntensity = 0.1,
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

    // 3) Chalk ghosts surfacing and fading.
    for (let g = 0; g < ghosts.length; g++) {
      const a = ghostEnvelope(time, g, ghostPeriod, ghostStagger, ghostDuty) * ghostMax;

      if (a <= 0.004) {
        continue;
      }

      const samples = ghosts[g] ?? [];

      for (const { index, weight } of samples) {
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
