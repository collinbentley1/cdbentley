/**
 * Scene 5 — "trading-floor": a trading floor at 4 a.m. Dark rows of desks
 * recede toward a pre-dawn window band; six lit monitors scroll silent
 * numbers, each pooling a little light onto its desk (one LightSource per
 * screen). The one idiomatic motion is the scroll; beneath it the dark air
 * breathes barely on the sparse end of the ramp, the glow flickers slightly,
 * and single cells blink as quotes update. A diorama, not a screensaver.
 *
 * Copy note (binding): this scene renders NO text and NO claims — the
 * scrolling figures are luminance noise quantized through the ramp, never
 * characters chosen by code. The claim slots beside this scene (FACTS.md L1:
 * 11 domain routers, BWIC/prepay — C11/C12 binding: ~4 months of demos, then
 * pivot; never "production traders used it daily") are typeset by the Phase C
 * integrator from FACTS.md at grade. summaryChip stays TODO(collin).
 *
 * Ramp intent (hand-tunable, Collin's brush), dark -> bright:
 * " ·:-=1739#@" — architecture sits in ·:-=; screen data lands in the digit
 * band 1739 plus #, so monitors literally read as columns of figures; @ is
 * reserved for quote blinks and glow cores. simplifyRamp level 1 samples this
 * to " :=79@" (still numeric); level 2 residue is " ·".
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

interface DeskRow {
  deskY: number;
  inset: number;
  monH: number;
  monW: number;
  /** 0..1 nearness scale; near rows glow brighter. */
  scale: number;
  thickness: number;
}

interface LitMonitor {
  cx: number;
  h: number;
  phase: number;
  scale: number;
  seed: number;
  speedMul: number;
  standY: number;
  w: number;
  x0: number;
  y0: number;
}

/** The six lit screens: (desk row, horizontal position as a width fraction). */
const LIT_MONITORS: ReadonlyArray<{ cxFrac: number; row: number }> = [
  { cxFrac: 0.29, row: 0 },
  { cxFrac: 0.74, row: 0 },
  { cxFrac: 0.125, row: 1 },
  { cxFrac: 0.61, row: 1 },
  { cxFrac: 0.36, row: 2 },
  { cxFrac: 0.83, row: 2 },
];

/** Static architecture layer, rebuilt by init (and if buffer dims change). */
let base = new Float32Array(0);
let monitors: LitMonitor[] = [];

function buildScene(width: number, height: number): void {
  base = new Float32Array(width * height);
  base.fill(0.05);
  monitors = [];

  // Pre-dawn window band: mullions, a sill line, a few city lights.
  const windowTop = Math.round(height * 0.06);
  const windowBottom = Math.round(height * 0.17);
  const sillY = windowBottom + 1;

  if (sillY < height) {
    for (let x = 0; x < width; x++) {
      base[sillY * width + x] = 0.1;
    }
  }

  const mullionStep = Math.max(8, Math.round(width / 8));

  for (let y = windowTop; y <= windowBottom && y < height; y++) {
    for (let x = mullionStep >> 1; x < width; x += mullionStep) {
      base[y * width + x] = 0.12;
    }
  }

  for (let k = 0; k < 13; k++) {
    if (hash(3, k, 4) < 0.5) {
      continue;
    }

    const x = 4 + Math.floor(hash(3, k, 1) * (width - 8));
    const y = windowTop + Math.floor(hash(3, k, 2) * (windowBottom - windowTop + 1));
    base[y * width + x] = 0.14 + 0.1 * hash(3, k, 3);
  }

  // Three desk rows in perspective: far rows inset more, near row thicker.
  const rows: DeskRow[] = [
    { deskY: Math.round(height * 0.47), inset: Math.round(width * 0.11), monH: 4, monW: 7, scale: 0.7, thickness: 1 },
    { deskY: Math.round(height * 0.67), inset: Math.round(width * 0.075), monH: 5, monW: 9, scale: 0.85, thickness: 1 },
    { deskY: Math.round(height * 0.89), inset: Math.round(width * 0.04), monH: 6, monW: 11, scale: 1, thickness: 2 },
  ];
  const aisleLeft = Math.round(width * 0.465);
  const aisleRight = Math.round(width * 0.535);
  const litByRow: number[][] = rows.map(() => []);

  for (const lit of LIT_MONITORS) {
    litByRow[lit.row]?.push(Math.round(lit.cxFrac * width));
  }

  rows.forEach((row, rowIndex) => {
    const segments: ReadonlyArray<readonly [number, number]> = [
      [row.inset, aisleLeft - 1],
      [aisleRight, width - 1 - row.inset],
    ];

    // Desk surfaces (top edge catches more light than the front face).
    for (const [x0, x1] of segments) {
      for (let t = 0; t < row.thickness; t++) {
        const y = row.deskY + t;

        if (y >= height) {
          continue;
        }

        for (let x = x0; x <= x1 && x < width; x++) {
          base[y * width + x] = t === 0 ? 0.22 : 0.16;
        }
      }
    }

    const lit = litByRow[rowIndex] ?? [];
    const slabW = row.monW - 2;
    const slabH = row.monH - 1;

    // Unlit monitors as faint slabs along each desk segment, plus a chair
    // silhouette here and there, slightly off-center — nobody pushed them in.
    for (const [x0, x1] of segments) {
      for (let cx = x0 + Math.ceil(slabW / 2) + 1; cx + Math.ceil(slabW / 2) <= x1; cx += row.monW + 5) {
        if (lit.some((litCx) => Math.abs(litCx - cx) < row.monW + 3)) {
          continue;
        }

        const sx0 = cx - (slabW >> 1);
        const sy1 = row.deskY - 2;
        const sy0 = sy1 - slabH + 1;

        for (let y = sy0; y <= sy1; y++) {
          if (y < 0 || y >= height) {
            continue;
          }

          for (let x = sx0; x < sx0 + slabW; x++) {
            if (x >= 0 && x < width) {
              base[y * width + x] = y === sy0 ? 0.11 : 0.07;
            }
          }
        }

        if (hash(11, rowIndex * 53 + cx, 7) < 0.4) {
          const chairX = cx + (hash(11, cx, 13) < 0.5 ? -2 : 1);

          for (let y = row.deskY + row.thickness; y < row.deskY + row.thickness + 2 && y < height; y++) {
            for (let x = chairX; x < chairX + 2; x++) {
              if (x >= 0 && x < width) {
                base[y * width + x] = 0.1;
              }
            }
          }
        }
      }
    }

    // The lit monitors on this row (screens are drawn per-frame in update).
    for (const litCx of lit) {
      const index = monitors.length;
      const y1 = row.deskY - 2;
      monitors.push({
        cx: litCx,
        h: row.monH,
        phase: hash(index + 1, 3, 17) * 40,
        scale: row.scale,
        seed: 100 + index * 37,
        speedMul: 0.7 + 0.6 * hash(index + 1, 5, 23),
        standY: row.deskY - 1,
        w: row.monW,
        x0: litCx - (row.monW >> 1),
        y0: y1 - row.monH + 1,
      });
    }
  });
}

export const tradingFloorScene: SceneModule = {
  dockGlyph: [
    "            ",
    " @· @·  @·  ",
    " :::::::::: ",
    "  @· @·  @· ",
    " :::::::::: ",
    "            ",
  ],
  id: "trading-floor",
  init(context: SceneContext): void {
    buildScene(context.buffer.width, context.buffer.height);
    context.lights.length = 0;

    for (const monitor of monitors) {
      context.lights.push({
        intensity: 0.11 * monitor.scale,
        radius: 10 * (monitor.w / 9),
        x: monitor.cx,
        y: monitor.standY,
      });
    }
  },
  summaryChip: "TODO(collin): trading-floor summary line (FACTS L1 at grade; C11/C12: demo-stage, never daily-trader use)",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 160,
    minimalGlyph: "·",
    motion: {
      ambientAmount: 0.05,
      ambientScale: 0.09,
      ambientSpeed: 0.05,
      blinkRate: 0.7,
      flickerAmount: 0.2,
      flickerSpeed: 1.6,
      glowIntensity: 0.1,
      glowRadius: 10,
      screenBrightness: 1,
      scrollSpeed: 1.8,
    },
    ramp: " ·:-=1739#@",
    rows: 72,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, lights, time } = context;
    const {
      ambientAmount = 0.05,
      ambientScale = 0.09,
      ambientSpeed = 0.05,
      blinkRate = 0.7,
      flickerAmount = 0.2,
      flickerSpeed = 1.6,
      glowIntensity = 0.1,
      glowRadius = 10,
      screenBrightness = 1,
      scrollSpeed = 1.8,
    } = this.tuning.motion;
    const width = buffer.width;
    const data = buffer.data;

    if (base.length !== data.length) {
      buildScene(width, buffer.height);
    }

    // 1) Architecture + breathing dark air (only cells darker than 0.1
    //    shimmer, so desks and screens stay still).
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

    // 2) Six screens: silent figures scrolling up one discrete row at a time,
    //    per-monitor speed and phase, gap columns like a quote table.
    for (const [index, monitor] of monitors.entries()) {
      const scrolled = Math.floor(time * scrollSpeed * monitor.speedMul + monitor.phase);

      for (let cy = 0; cy < monitor.h; cy++) {
        const line = scrolled + cy;
        const lineKind = hash(monitor.seed, line, 997);
        const rowBase = (monitor.y0 + cy) * width;

        for (let cx = 0; cx < monitor.w; cx++) {
          let v = 0.3;

          if (cx % 4 !== 3 && hash(monitor.seed, line * 131 + cx, 61) > 0.25) {
            v = lineKind < 0.25 ? 0.48 : 0.5 + 0.4 * hash(monitor.seed, line * 977 + cx * 7, 199);
          }

          v *= screenBrightness;
          data[rowBase + monitor.x0 + cx] = v < 0 ? 0 : v > 0.92 ? 0.92 : v;
        }
      }

      data[monitor.standY * width + monitor.cx] = 0.14;

      // A quote updates: one cell blinks to full ink, briefly, rarely.
      if (blinkRate > 0) {
        const beat = time * blinkRate + index * 0.37;
        const tick = Math.floor(beat);

        if (beat - tick < 0.35) {
          const bx = Math.floor(hash(monitor.seed, tick, 5) * monitor.w);
          const by = Math.floor(hash(monitor.seed, tick, 11) * monitor.h);
          data[(monitor.y0 + by) * width + monitor.x0 + bx] = 0.96;
        }
      }

      // 3) Glow pooling on the desk, flickering slightly (runner stamps it).
      const light = lights[index];

      if (light) {
        const flick = 1 + flickerAmount * (flickerNoise(time * flickerSpeed, 50 + index * 7.7) - 0.5);
        light.intensity = Math.max(0, glowIntensity * monitor.scale * flick);
        light.radius = Math.max(1, glowRadius * (monitor.w / 9));
        light.x = monitor.cx;
        light.y = monitor.standY;
      }
    }
  },
};
