/**
 * Scene — "kitchen-table": a kitchen at night, true black. One table (a solid
 * mass, classroom-desk build: slab top, apron, four legs), one chair pulled up
 * to its near-right corner, and a phone lying face-up on the wood — the
 * room's ONLY light source, the SDK lure mechanic used exactly as designed:
 * the glow is three small LightSource lobes riding the screen's long axis
 * (one phone, one pool — stretched along the wood instead of a floating orb),
 * and inside that pool the ramp lifts and hidden detail resolves out of the
 * black: the wood grain, the mug by the phone, the chair's near edge. A
 * window hints at distance: thin mullion cross, two faint far lights. Outside
 * the pool the furniture is a whisper (sparse grain speckle, a dotted near
 * edge at most); the room stays black.
 *
 * One quiet motion idiom, phone-shaped: the glow breathes; on a slow cycle a
 * message arrives — the glow swells and two-to-three glyph rows flicker
 * across the face — and once per long cycle a soft concentric voice-ripple
 * expands one ring off the phone and dissolves. A diorama, not a screensaver.
 *
 * The sim is STATELESS by construction: every frame is a closed-form function
 * of context.time (no accumulators), so arbitrary sleep gaps land the room
 * exactly where it should be — scene.test.ts proves buffer equality across
 * different dt partitions.
 *
 * Compaction legibility: the room is line art, and 1-cell strokes average
 * away to black under bin pooling, so init bakes THREE static bases with
 * stroke thickness matched to the bin stride (1/2/4, small gain) and update
 * picks one via resolutionForDepth(context.depth) — pure in depth, so scroll
 * up re-blooms along the same path. As the scene forgets itself the furniture
 * fades first; what survives longest is what the room remembers: the pool of
 * phone light, the table's near edge, the far lights in the window.
 *
 * Copy note (binding): this scene renders no text — the message rows are
 * non-lexical glyph shimmer, never words. The chapter prose beside this
 * scene is DOM.
 *
 * Ramp intent (hand-tunable, Collin's brush), dark -> bright:
 * " ·:-=+*#@" — the night lives in the first two glyphs (black + sparse '·'
 * silhouettes), lit wood grain breathes on ':-=', the mug rim and chair edge
 * resolve on '·:', the phone face lands on '+*', message rows and the screen
 * core on '#@'. simplifyRamp level 2 residue is " ·": the compacted memory of
 * the kitchen is a small pool of dots where the phone was.
 */

import { createValueNoise, fbm2, resolutionForDepth } from "../../sdk/index.ts";
import type { LuminanceBuffer, SceneContext, SceneModule } from "../../sdk/index.ts";

const grainNoise = createValueNoise(47);

/** Deterministic integer hash -> [0, 1). Keeps the message shimmer replayable. */
function hash(seed: number, a: number, b: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
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
/** Phone screen interior (dynamic fill + message rows), buffer cell coords. */
let screen: Rect = { x0: 0, x1: 0, y0: 0, y1: 0 };
/** Phone/light center — also the origin of the voice-ripple. */
let phoneX = 0;
let phoneY = 0;
/** Far-light cells in the window (index, phase) for the slow twinkle. */
let farLights: Array<{ index: number; phase: number }> = [];

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

/** Draw the static room; returns the phone-screen interior rect. */
function drawRoom(pen: Pen, w: number, h: number): Rect {
  const X = (f: number): number => Math.round(f * (w - 1));
  const Y = (f: number): number => Math.round(f * (h - 1));

  // Window, upper left: thin frame, mullion cross, near-black glass — one
  // quiet ramp step above black, a window you notice second.
  const win: Rect = { x0: X(0.1), x1: X(0.21), y0: Y(0.1), y1: Y(0.33) };
  pen.rect({ x0: win.x0 + 1, x1: win.x1 - 1, y0: win.y0 + 1, y1: win.y1 - 1 }, 0.02);
  pen.h(win.x0, win.x1, win.y0, 0.13);
  pen.h(win.x0, win.x1, win.y1, 0.13);
  pen.v(win.x0, win.y0, win.y1, 0.13);
  pen.v(win.x1, win.y0, win.y1, 0.13);
  pen.h(win.x0 + 1, win.x1 - 1, Y(0.215), 0.115);
  pen.v(X(0.155), win.y0 + 1, win.y1 - 1, 0.115);

  // Two far lights through the glass: someone else's night, kilometres off.
  // Self-luminous (they ARE lights), one-cell halos, slow twinkle in update.
  // Under compaction these outlive the furniture.
  const farA = { x: X(0.13), y: Y(0.27) };
  const farB = { x: X(0.185), y: Y(0.16) };
  pen.cell(farA.x, farA.y, 0.34);
  pen.cell(farA.x - 1, farA.y, 0.11);
  pen.cell(farA.x + 1, farA.y, 0.11);
  pen.cell(farB.x, farB.y, 0.26);
  pen.cell(farB.x + 1, farB.y, 0.09);

  // The table: one solid mass. Slab top seen at a shallow angle (a trapezoid
  // of wood grain), a firm near edge, an apron, four legs. The grain rides
  // just under the first ramp step — sparse speckle where the figure peaks
  // keeps the slab present in the dark; the pool resolves all of it.
  const backY = Y(0.5);
  const frontY = Y(0.63);
  const backL = X(0.3);
  const backR = X(0.7);
  const frontL = X(0.245);
  const frontR = X(0.755);

  for (let y = backY; y <= frontY; y++) {
    const t = (y - backY) / Math.max(1, frontY - backY);
    const x0 = Math.round(backL + (frontL - backL) * t);
    const x1 = Math.round(backR + (frontR - backR) * t);

    for (let x = x0; x <= x1; x++) {
      // Wood grain: long horizontal figure, a few darker pores.
      const g = fbm2(grainNoise, x * 0.11, y * 0.9, 2);
      const pore = fbm2(grainNoise, x * 0.45 + 40, y * 1.7, 1);
      pen.cell(x, y, clamp01(0.1 + (g - 0.5) * 2 * 0.055 - (pore > 0.72 ? 0.035 : 0)));
    }
  }

  // Back-edge whisper, near-edge line, apron shadow under the slab.
  pen.h(backL, backR, backY, 0.1);
  pen.h(frontL, frontR, frontY, 0.23);
  pen.h(frontL + 1, frontR - 1, frontY + 1, 0.075);

  // Legs: front pair to the floor, back pair shorter (depth), dimmer.
  pen.v(frontL + 2, frontY + 2, Y(0.88), 0.13);
  pen.v(frontR - 3, frontY + 2, Y(0.88), 0.13);
  pen.v(backL + 2, frontY + 1, Y(0.8), 0.09);
  pen.v(backR - 3, frontY + 1, Y(0.8), 0.09);

  // The chair, pulled up at the near-right corner: a tall narrow backrest
  // rising above the slab (two rails), stiles down to the seat, the seat
  // overhanging toward the table, legs beneath. Its inner stile sits at
  // light height — the "chair edge" that resolves as the glow swells.
  const seatY = Y(0.68);
  const stileL = X(0.775);
  const stileR = X(0.825);
  pen.h(stileL, stileR, Y(0.39), 0.13);
  pen.h(stileL + 1, stileR - 1, Y(0.44), 0.12);
  pen.h(stileL + 1, stileR - 1, Y(0.52), 0.115);
  pen.v(stileL, Y(0.39), seatY, 0.13);
  pen.v(stileR, Y(0.39), seatY, 0.12);
  pen.h(stileL - 4, stileR, seatY, 0.135);
  pen.v(stileL - 2, seatY + 1, Y(0.9), 0.12);
  pen.v(stileR - 1, seatY + 1, Y(0.9), 0.11);

  // The mug, close by the phone where its rim catches the glow: a dark
  // cylinder against the lit wood — bright rim, near-black coffee, a
  // two-cell handle on the shadow side.
  const mugL = X(0.555);
  const mugR = mugL + 4;
  const mugTop = backY + 1;
  pen.rect({ x0: mugL, x1: mugR, y0: mugTop + 1, y1: mugTop + 5 }, 0.05);
  pen.h(mugL, mugR, mugTop, 0.22);
  pen.rect({ x0: mugL + 1, x1: mugR - 1, y0: mugTop + 1, y1: mugTop + 1 }, 0.02);
  pen.cell(mugL - 1, mugTop + 2, 0.12);
  pen.cell(mugL - 2, mugTop + 3, 0.12);
  pen.cell(mugL - 1, mugTop + 4, 0.12);

  // The phone, face-up: a one-cell bezel around a screen the update() pass
  // fills every frame. The bezel is silhouette-grade; the screen is the sun.
  const scr: Rect = { x0: X(0.615), x1: X(0.615) + 8, y0: backY + 3, y1: backY + 6 };
  pen.h(scr.x0 - 1, scr.x1 + 1, scr.y0 - 1, 0.13);
  pen.h(scr.x0 - 1, scr.x1 + 1, scr.y1 + 1, 0.13);
  pen.v(scr.x0 - 1, scr.y0 - 1, scr.y1 + 1, 0.13);
  pen.v(scr.x1 + 1, scr.y0 - 1, scr.y1 + 1, 0.13);

  return scr;
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
    screen = drawRoom(makePen(target, w, h, stroke, gain), w, h);
    bases[stroke as 1 | 2 | 4] = target;
  }

  phoneX = (screen.x0 + screen.x1) / 2;
  phoneY = (screen.y0 + screen.y1) / 2;

  const X = (f: number): number => Math.round(f * (w - 1));
  const Y = (f: number): number => Math.round(f * (h - 1));
  farLights = [
    { index: Y(0.27) * w + X(0.13), phase: 0.9 },
    { index: Y(0.16) * w + X(0.185), phase: 3.7 },
  ];
}

/** sin^2 arrival envelope: 0 outside the window, eased in and out inside. */
function pulseEnvelope(time: number, phase: number, period: number, length: number): number {
  const p = (((time + phase) % period) + period) % period;

  if (p >= length) {
    return 0;
  }

  const s = Math.sin((Math.PI * p) / length);

  return s * s;
}

export const scene: SceneModule = {
  dockGlyph: [
    "            ",
    "     ·:·    ",
    "    :·@·:   ",
    "  ========  ",
    "  |      |  ",
    "  |      |  ",
  ],
  id: "kitchen-table",
  init(context: SceneContext): void {
    buildBases(context.buffer);
    const radius = Math.max(this.tuning.motion.glowRadiusMin ?? 8, this.tuning.motion.glowRadius ?? 15);
    const spread = this.tuning.motion.glowSpread ?? 8;
    context.lights.length = 0;

    // One phone, one pool: three lobes along the screen's long axis stretch
    // the glow across the wood instead of floating a single ball of light;
    // glowDropY biases the pool into the tabletop, where the detail lives.
    for (const offset of [-spread, 0, spread]) {
      context.lights.push({
        intensity: this.tuning.motion.glowIntensity ?? 0.21,
        radius,
        x: phoneX + offset,
        y: phoneY + (this.tuning.motion.glowDropY ?? 1.5),
      });
    }
  },
  summaryChip: "Healthyr, 2024–2025 — clinical care by app, SMS, and voice.",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 176,
    minimalGlyph: "·",
    motion: {
      breatheAmp: 0.16,
      breatheSpeed: 0.22,
      farTwinkle: 0.045,
      flickerHz: 8,
      glowDropY: 1.5,
      glowIntensity: 0.21,
      glowRadius: 15,
      glowRadiusMin: 8,
      glowSpread: 8,
      msgLen: 2.4,
      msgPeriod: 13,
      msgPhase: 8.4,
      msgRadiusSwell: 0.22,
      msgScreenLift: 0.12,
      msgSwell: 0.5,
      rippleAmp: 0.13,
      rippleLen: 3.5,
      rippleMax: 30,
      ripplePeriod: 29,
      ripplePhase: 20,
      rippleWidth: 1.6,
      screenBase: 0.52,
      screenBreathe: 0.06,
    },
    ramp: " ·:-=+*#@",
    rows: 80,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, lights, time: t } = context;
    const {
      breatheAmp = 0.16,
      breatheSpeed = 0.22,
      farTwinkle = 0.045,
      flickerHz = 8,
      glowDropY = 1.5,
      glowIntensity = 0.21,
      glowRadius = 15,
      glowRadiusMin = 8,
      glowSpread = 8,
      msgLen = 2.4,
      msgPeriod = 13,
      msgPhase = 8.4,
      msgRadiusSwell = 0.22,
      msgScreenLift = 0.12,
      msgSwell = 0.5,
      rippleAmp = 0.13,
      rippleLen = 3.5,
      rippleMax = 30,
      ripplePeriod = 29,
      ripplePhase = 20,
      rippleWidth = 1.6,
      screenBase = 0.52,
      screenBreathe = 0.06,
    } = this.tuning.motion;
    const w = buffer.width;
    const h = buffer.height;
    const data = buffer.data;

    if ((bases[1]?.length ?? 0) !== data.length) {
      buildBases(buffer);
    }

    // 1) Static room, stroke-matched to the current bin stride (pure in depth).
    const resolution = resolutionForDepth(context.depth, this.tuning.resolution);
    data.set(bases[resolution.bin] ?? bases[1] ?? data);

    // 2) Far lights twinkle — slow, a glyph step at most.
    for (const { index, phase } of farLights) {
      data[index] = clamp01((data[index] ?? 0) + farTwinkle * Math.sin(t * 0.7 + phase));
    }

    // 3) The phone face breathes; a message arriving swells it and flickers
    //    two-to-three non-lexical glyph rows across the screen.
    const breathe = Math.sin(t * breatheSpeed * Math.PI * 2);
    const msg = pulseEnvelope(t, msgPhase, msgPeriod, msgLen);
    const screenLum = clamp01(screenBase + screenBreathe * breathe + msgScreenLift * msg);

    for (let y = screen.y0; y <= screen.y1; y++) {
      const row = y * w;

      for (let x = screen.x0; x <= screen.x1; x++) {
        data[row + x] = screenLum;
      }
    }

    if (msg > 0.02) {
      const tick = Math.floor(t * flickerHz);
      const rows = msg > 0.55 ? 3 : 2;

      for (let k = 0; k < rows; k++) {
        const y = screen.y0 + 1 + k;

        if (y > screen.y1) {
          break;
        }

        const row = y * w;

        for (let x = screen.x0 + 1; x <= screen.x1 - 1; x++) {
          const hv = hash(k + 1, x, tick);

          if (hv < 0.3) {
            continue; // gaps, so the rows read as lines, not bars
          }

          data[row + x] = clamp01(screenLum + msg * (0.12 + 0.32 * hv));
        }
      }
    }

    // 4) Once per long cycle, a voice-ripple: one soft concentric ring
    //    expanding off the phone and dissolving as it goes.
    const rippleT = (((t + ripplePhase) % ripplePeriod) + ripplePeriod) % ripplePeriod;

    if (rippleT < rippleLen) {
      const q = rippleT / rippleLen;
      const ease = 1 - (1 - q) * (1 - q);
      const radius = 6 + (rippleMax - 6) * ease;
      const amp = rippleAmp * (1 - q);

      if (amp > 0.008) {
        const x0 = Math.max(0, Math.floor(phoneX - radius - 2));
        const x1 = Math.min(w - 1, Math.ceil(phoneX + radius + 2));
        const y0 = Math.max(0, Math.floor(phoneY - radius - 2));
        const y1 = Math.min(h - 1, Math.ceil(phoneY + radius + 2));

        for (let y = y0; y <= y1; y++) {
          const dy = y - phoneY;
          const row = y * w;

          for (let x = x0; x <= x1; x++) {
            const dx = x - phoneX;
            const tent = 1 - Math.abs(Math.sqrt(dx * dx + dy * dy) - radius) / rippleWidth;

            if (tent > 0) {
              data[row + x] = clamp01((data[row + x] ?? 0) + amp * tent);
            }
          }
        }
      }
    }

    // 5) THE light: three lobes riding the screen. They breathe with the
    //    face and swell (intensity and radius) as the message arrives. The
    //    radius never drops below glowRadiusMin — the mobile floor.
    const radius = Math.max(glowRadiusMin, glowRadius * (1 + msgRadiusSwell * msg));
    const intensity = clamp01(glowIntensity * (1 + breatheAmp * breathe) + glowIntensity * msgSwell * msg);

    for (let i = 0; i < lights.length; i++) {
      const light = lights[i];

      if (light) {
        light.x = phoneX + (i - (lights.length - 1) / 2) * glowSpread;
        light.y = phoneY + glowDropY;
        light.radius = radius;
        light.intensity = intensity;
      }
    }
  },
};
