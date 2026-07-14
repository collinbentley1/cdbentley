/**
 * Scene 5 — "trading-floor": a trading floor at 4 a.m. Silhouette first:
 * three rows of desks as solid horizontal masses receding toward a back wall, a
 * ticker of drifting digits anchored under the wall line, and monitor
 * rectangles standing ON the desks — bright single-cell borders, interiors
 * three to four cells tall. Six monitors are lit and scroll silent figures,
 * each pooling a little light onto its desk (one LightSource per screen); the
 * rest are dark rectangles. One chair, empty, at a lit desk. Every digit in
 * the scene lives INSIDE a monitor interior or ON the ticker row — the dark
 * air and the architecture never enter the ramp's digit band.
 *
 * The one idiomatic motion is the scroll (screens step up one discrete row at
 * a time; the ticker steps sideways). Beneath it the dark air breathes barely
 * on the sparse end of the ramp, the glow flickers slightly, and single cells
 * blink as quotes update. A diorama, not a screensaver.
 *
 * Copy note (binding): this scene renders NO text — the scrolling figures
 * are luminance noise quantized through the ramp, never characters chosen
 * by code. The chapter prose beside this scene is DOM.
 *
 * Ramp intent (hand-tunable, Collin's brush), dark -> bright:
 * " ·:-=1739#@" — architecture sits in ·:-= (air dust '·', lower desk faces
 * ':', upper faces '-', desk tops '='), lit-screen backgrounds land on '=',
 * figures land in the digit band 1739, '#' is the lit-monitor border, and @
 * is reserved for quote blinks and glow cores. Structural luminance is capped
 * at 0.37 and glow peaks near 0.08, so architecture + glow stays below the
 * 0.4545 digit threshold — digits cannot leak out of the screens.
 * simplifyRamp level 1 samples this to " :=79@" (still numeric); level 2
 * residue is " ·".
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const ambientNoise = createValueNoise(41);
const flickerNoise = createValueNoise(97);

/** Deterministic integer hash -> [0, 1). Keeps the sim reproducible. */
function hash(seed: number, a: number, b: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Luminance plan against the 11-glyph ramp (bin width 1/11 ≈ 0.0909):
 * digits '1739' own [0.4545, 0.8182). Architecture tops out at deskTop 0.37;
 * the strongest glow adds ~0.08 at its core, so structure + glow < 0.4545.
 */
const LUM = {
  air: 0.05,
  blink: 0.95,
  ceiling: 0.02,
  chair: 0.19,
  chairBase: 0.14,
  chairTop: 0.26,
  deskFace: 0.3,
  deskFaceLow: 0.21,
  deskTop: 0.37,
  figureMax: 0.8,
  figureMin: 0.47,
  floor: 0.05,
  litBorder: 0.83,
  screenBg: 0.38,
  tickerMax: 0.78,
  tickerMin: 0.5,
  unlitBorder: 0.13,
  unlitScreen: 0.05,
  wallLine: 0.3,
} as const;

interface LitMonitor {
  cx: number;
  deskY: number;
  /** Interior box (inside the 1-cell border). */
  ih: number;
  iw: number;
  ix0: number;
  iy0: number;
  phase: number;
  /** 0..1 nearness scale; near rows glow brighter. */
  scale: number;
  seed: number;
  speedMul: number;
}

interface DeskRowSpec {
  deskY: number;
  /** Central aisle half-width at this depth (converges toward the back). */
  gapHalf: number;
  insetX: number;
  litSlots: ReadonlySet<number>;
  /** Desk-mass height in rows, top edge included. */
  massH: number;
  /** Monitor outer height/width, 1-cell borders included. */
  monH: number;
  monW: number;
  pitch: number;
  scale: number;
}

/** Static architecture layer, rebuilt by init (and if buffer dims change). */
let base = new Float32Array(0);
let monitors: LitMonitor[] = [];
let tickerY = 0;
let tickerX0 = 0;
let tickerX1 = 0;

function drawRect(width: number, height: number, x0: number, y0: number, x1: number, y1: number, v: number): void {
  for (let y = Math.max(0, y0); y <= y1 && y < height; y++) {
    const row = y * width;

    for (let x = Math.max(0, x0); x <= x1 && x < width; x++) {
      base[row + x] = v;
    }
  }
}

/** Monitor rectangle: 1-cell border at `borderV`, interior at `screenV`. */
function drawMonitor(
  width: number,
  height: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  borderV: number,
  screenV: number,
): void {
  drawRect(width, height, x0, y0, x0 + w - 1, y0 + h - 1, borderV);
  drawRect(width, height, x0 + 1, y0 + 1, x0 + w - 2, y0 + h - 2, screenV);
}

function buildScene(width: number, height: number): void {
  base = new Float32Array(width * height);
  monitors = [];

  // Back wall line near the ceiling; the ticker hangs two rows under it.
  const wallY = Math.max(2, Math.round(height * 0.055));
  tickerY = wallY + 2;
  tickerX0 = Math.round(width * 0.025);
  tickerX1 = width - 1 - tickerX0;

  base.fill(LUM.air);
  drawRect(width, height, 0, 0, width - 1, wallY - 1, LUM.ceiling);

  for (let x = 0; x < width; x++) {
    base[wallY * width + x] = LUM.wallLine;
  }

  // Three desk rows in perspective: each nearer row is lower, wider, thicker
  // and carries bigger monitors. A central aisle converges toward the back.
  const centerX = width / 2;
  const rows: DeskRowSpec[] = [
    {
      deskY: Math.round(height * 0.4),
      gapHalf: Math.round(width * 0.045),
      insetX: Math.round(width * 0.15),
      litSlots: new Set([1]),
      massH: 3,
      monH: 5,
      monW: 12,
      pitch: 16,
      scale: 0.7,
    },
    {
      deskY: Math.round(height * 0.6),
      gapHalf: Math.round(width * 0.06),
      insetX: Math.round(width * 0.09),
      litSlots: new Set([0, 4]),
      massH: 4,
      monH: 5,
      monW: 14,
      pitch: 19,
      scale: 0.85,
    },
    {
      deskY: Math.round(height * 0.81),
      gapHalf: Math.round(width * 0.085),
      insetX: Math.round(width * 0.02),
      litSlots: new Set([1, 3, 5]),
      massH: 5,
      monH: 6,
      monW: 16,
      pitch: 22,
      scale: 1,
    },
  ];

  // Floor catches a hair more light than the air behind the far desks.
  drawRect(width, height, 0, (rows[0]?.deskY ?? 0) + (rows[0]?.massH ?? 0), width - 1, height - 1, LUM.floor);

  let litIndex = 0;

  for (const row of rows) {
    const segments: ReadonlyArray<readonly [number, number]> = [
      [row.insetX, Math.floor(centerX - row.gapHalf)],
      [Math.ceil(centerX + row.gapHalf), width - 1 - row.insetX],
    ];

    // Desk mass: bright top edge, solid dark face — a horizontal slab.
    for (const [x0, x1] of segments) {
      drawRect(width, height, x0, row.deskY, x1, row.deskY, LUM.deskTop);
      drawRect(width, height, x0, row.deskY + 1, x1, row.deskY + Math.ceil(row.massH / 2), LUM.deskFace);
      drawRect(width, height, x0, row.deskY + Math.ceil(row.massH / 2) + 1, x1, row.deskY + row.massH - 1, LUM.deskFaceLow);
    }

    // Monitors stand on the desk top, evenly slotted along each segment.
    let slot = 0;

    for (const [x0, x1] of segments) {
      for (let mx = x0 + 2; mx + row.monW - 1 <= x1; mx += row.pitch) {
        const my = row.deskY - row.monH;

        if (row.litSlots.has(slot)) {
          drawMonitor(width, height, mx, my, row.monW, row.monH, LUM.litBorder, LUM.screenBg);
          monitors.push({
            cx: mx + (row.monW - 1) / 2,
            deskY: row.deskY,
            ih: row.monH - 2,
            iw: row.monW - 2,
            ix0: mx + 1,
            iy0: my + 1,
            phase: hash(litIndex + 1, 3, 17) * 40,
            scale: row.scale,
            seed: 100 + litIndex * 37,
            speedMul: 0.7 + 0.6 * hash(litIndex + 1, 5, 23),
          });
          litIndex++;
        } else {
          drawMonitor(width, height, mx, my, row.monW, row.monH, LUM.unlitBorder, LUM.unlitScreen);
        }

        slot++;
      }
    }
  }

  // One empty chair at a lit desk on the near row, pushed back and a little
  // off-center — somebody just left. It reads as a silhouette in the pool.
  const near = rows[2];
  const nearLit = monitors.filter((m) => near && m.deskY === near.deskY);
  const chairMonitor = nearLit[1] ?? nearLit[0];

  if (near && chairMonitor) {
    const cx = Math.round(chairMonitor.cx) - 4;
    const cy = near.deskY + near.massH + 1;
    drawRect(width, height, cx - 2, cy, cx + 1, cy, LUM.chairTop);
    drawRect(width, height, cx - 3, cy + 1, cx + 2, cy + 3, LUM.chair);
    drawRect(width, height, cx - 2, cy + 4, cx + 1, cy + 4, LUM.chairBase);
  }
}

export const tradingFloorScene: SceneModule = {
  dockGlyph: [
    " 1739·317·9 ",
    "            ",
    " #9#·--·#7# ",
    "============",
    "·#79#··#31#·",
    "============",
  ],
  id: "trading-floor",
  init(context: SceneContext): void {
    buildScene(context.buffer.width, context.buffer.height);
    context.lights.length = 0;

    for (const monitor of monitors) {
      context.lights.push({
        intensity: 0.075 * monitor.scale,
        radius: (monitor.iw + 2) * 0.7,
        x: monitor.cx,
        y: monitor.deskY + 1,
      });
    }
  },
  summaryChip: "OTseek, 2025 — zero to one with bond traders.",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 160,
    minimalGlyph: "·",
    motion: {
      ambientAmount: 0.04,
      ambientScale: 0.09,
      ambientSpeed: 0.05,
      blinkRate: 0.7,
      flickerAmount: 0.12,
      flickerSpeed: 1.6,
      glowIntensity: 0.075,
      glowRadius: 0.7,
      screenBrightness: 1,
      scrollSpeed: 1.8,
      tickerSpeed: 4,
    },
    ramp: " ·:-=1739#@",
    rows: 72,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, lights, time } = context;
    const {
      ambientAmount = 0.04,
      ambientScale = 0.09,
      ambientSpeed = 0.05,
      blinkRate = 0.7,
      flickerAmount = 0.12,
      flickerSpeed = 1.6,
      glowIntensity = 0.075,
      glowRadius = 0.7,
      screenBrightness = 1,
      scrollSpeed = 1.8,
      tickerSpeed = 4,
    } = this.tuning.motion;
    const width = buffer.width;
    const data = buffer.data;

    if (base.length !== data.length) {
      buildScene(width, buffer.height);
    }

    // 1) Architecture + breathing dark air (only cells darker than 0.1
    //    shimmer, so desks, monitors and the wall line stay still).
    const drift = time * ambientSpeed;

    for (let y = 0; y < buffer.height; y++) {
      const ny = y * ambientScale * 1.6;
      const rowBase = y * width;

      for (let x = 0; x < width; x++) {
        const b = base[rowBase + x] ?? 0;

        if (b < 0.1 && ambientAmount > 0) {
          const n = fbm2(ambientNoise, x * ambientScale + drift, ny + drift * 0.35, 2);
          const v = b + (n - 0.5) * 2 * ambientAmount;
          data[rowBase + x] = v < 0 ? 0 : v > 1 ? 1 : v;
        } else {
          data[rowBase + x] = b;
        }
      }
    }

    // 2) The ticker: one row of digits drifting sideways under the wall
    //    line, grouped like quotes with dark gaps between the groups.
    const tickerShift = Math.floor(time * tickerSpeed);
    const tickerRow = tickerY * width;

    for (let x = tickerX0; x <= tickerX1; x++) {
      const tape = x + tickerShift;
      const group = Math.floor(tape / 9);
      const offset = tape - group * 9;
      const groupLen = 4 + Math.floor(hash(7, group, 1) * 3);

      if (offset < groupLen) {
        data[tickerRow + x] = LUM.tickerMin + (LUM.tickerMax - LUM.tickerMin) * hash(7, tape, 2);
      }
    }

    // 3) Six screens: silent figures scrolling up one discrete row at a time,
    //    per-monitor speed and phase, gap columns like a quote table. Digits
    //    exist ONLY here and on the ticker row.
    for (const [index, monitor] of monitors.entries()) {
      const scrolled = Math.floor(time * scrollSpeed * monitor.speedMul + monitor.phase);

      for (let cy = 0; cy < monitor.ih; cy++) {
        const line = scrolled + cy;
        const dimRow = hash(monitor.seed, line, 997) < 0.22;
        const rowBase = (monitor.iy0 + cy) * width;

        for (let cx = 0; cx < monitor.iw; cx++) {
          let v: number = LUM.screenBg;

          if (cx % 5 !== 4 && hash(monitor.seed, line * 131 + cx, 61) > 0.25) {
            v = dimRow
              ? LUM.figureMin
              : LUM.figureMin + (LUM.figureMax - LUM.figureMin) * hash(monitor.seed, line * 977 + cx * 7, 199);
          }

          v *= screenBrightness;
          data[rowBase + monitor.ix0 + cx] = v < 0 ? 0 : v > 0.92 ? 0.92 : v;
        }
      }

      // A quote updates: one cell blinks to full ink, briefly, rarely.
      if (blinkRate > 0) {
        const beat = time * blinkRate + index * 0.37;
        const tick = Math.floor(beat);

        if (beat - tick < 0.35) {
          const bx = Math.floor(hash(monitor.seed, tick, 5) * monitor.iw);
          const by = Math.floor(hash(monitor.seed, tick, 11) * monitor.ih);
          data[(monitor.iy0 + by) * width + monitor.ix0 + bx] = LUM.blink;
        }
      }

      // 4) Glow pooling on the desk, flickering slightly (runner stamps it).
      const light = lights[index];

      if (light) {
        const flick = 1 + flickerAmount * (flickerNoise(time * flickerSpeed, 50 + index * 7.7) - 0.5);
        light.intensity = Math.max(0, glowIntensity * monitor.scale * flick);
        light.radius = Math.max(1, (monitor.iw + 2) * glowRadius);
        light.x = monitor.cx;
        light.y = monitor.deskY;
      }
    }
  },
};
