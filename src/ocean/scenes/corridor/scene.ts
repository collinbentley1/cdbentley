/**
 * Scene 4 — "corridor": an empty hospital corridor.
 *
 * One-point perspective. A row of fluorescent ceiling fixtures recedes
 * toward a vanishing point; their light lies on polished linoleum as a
 * dash-glyph sheen; recessed doors punctuate the walls; the far end is
 * nearly black except for one framed, illuminated sign.
 *
 * The single idiomatic motion is fluorescent shimmer: every tube drifts a
 * few percent around full brightness on slow value noise, and ONE tube
 * (tunable) occasionally sags and recovers — a struggling ballast, not a
 * strobe. The floor sheen breathes with it: each fixture's reflection is a
 * stippled field of one glyph class whose density thins as its tube sags
 * and whose stipple crawls on slow noise — light on wax, not weave.
 * Restraint is deliberate (a11y): all modulation is smooth noise with
 * dominant periods measured in seconds (well under any flash-risk
 * frequency), amplitude is hand-tunable down to zero, and the reduced-motion
 * plain view exists site-wide (Phase C).
 *
 * Design-brief refinements (polish pass):
 * - Floor reflection is a single glyph class (the ramp's dash band) at
 *   ~60% stipple density so it reads as sheen, not weave; nothing on the
 *   floor may leave that band.
 * - Door interiors sit 1-2 ramp steps below the wall, with a crisp 1-cell
 *   frame line stamped in screen space so doorways punch as openings.
 * - Wall luminance is down ~20% so the wall is a calm single-band dot
 *   field instead of two-band speckle (video static at zoom).
 * - The vanishing-point sign is an explicit bordered rectangle (1-cell
 *   frame, dim panel, one gapped text-suggestion row) so the glyph soup at
 *   the end of the corridor reads as A SIGN.
 *
 * Art pass (light temperature + rhythm):
 * - Tubes carry a quartic (flat-top, fast-cutoff) vertical profile with
 *   tight end caps: cold institutional bars, not warm glows.
 * - The floor sheen breaks at every door depth on its outer reach (the
 *   reflection of the recess), so the corridor floor reads wet-waxed with
 *   an interruption rhythm instead of uniform bands.
 * - The farthest right-hand doorway holds an absolute hint of glow plus a
 *   wide dim wash on the neighboring wall, giving the eye a step between
 *   the last fixture pool and the sign.
 * - The struggling ballast is the mid-corridor tube, gated to sag at long
 *   irregular intervals (median gap tens of seconds); the ambient all-tube
 *   drift is shallower so cold light reads steady between events.
 *
 * This scene renders no human-readable copy (glyphs only); the chapter
 * prose beside it is DOM.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const noise = createValueNoise(41);

/** Deterministic per-cell white noise in [0, 1) for the sheen stipple. */
function cellHash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

/**
 * Structural geometry — baked into the static layers at init; changing these
 * requires a reload (the live-tunable per-frame constants live in
 * tuning.motion instead, per the SDK convention).
 */
const VANISH_Y = 0.44; // vanishing point, as a fraction of grid height
const Z_END = 14; // corridor length in depth units; beyond it: the end wall
const FIXTURE_Z = [1.75, 3.8, 6.0, 8.2, 10.4, 12.6] as const;
const DOOR_Z = [2.7, 5.1, 7.5, 9.9, 12.3] as const;

/**
 * The farthest right-hand doorway holds a hint of glow — a lit room the
 * corridor never reaches — so the eye travels past the last fluorescent
 * pool to the end wall instead of stopping mid-corridor. Peak luminance
 * sits in the first ramp band (a soft dotted doorway, not a second sign).
 */
const FAR_DOOR_Z = 12.3;
const FAR_DOOR_GLOW = 0.17;
const FAR_WALL_WASH = 0.08;

/**
 * The dash band of the tuned ramp " ·:-|=+*#@" (10 glyphs, equal bins):
 * luminance in [0.3, 0.4) quantizes to "-". The floor sheen lives here and
 * nowhere brighter — single glyph class, per the brief.
 */
const DASH_LO = 0.31;
const DASH_SPAN = 0.07;
const FLOOR_CAP = 0.29; // floor base never enters the dash band on its own

/**
 * Emitters dim with distance (they are sources, not surfaces, so they fall off
 * gentler than the walls). The falloff is tuned so the nearest tube stays hot
 * while the last one or two before the vanishing point settle back — that keeps
 * the far end calm enough for the illuminated sign to read as the destination
 * instead of getting lost under a bright fixture convergence.
 */
function emitterFade(z: number): number {
  return 1 / (1 + (z - 1) * 0.11);
}

interface StaticLayers {
  /** Ambient architecture: ceiling, floor, walls, doors, frames, sign. */
  readonly base: Float32Array;
  /** Emission added at flicker = 1 (ceiling fixture bars only). */
  readonly gain: Float32Array;
  /** Which fixture modulates this cell (bar gain or floor sheen); -1 = none. */
  readonly fixture: Int8Array;
  /** Floor-sheen footprint weight in [0, 1]; 0 off the reflection. */
  readonly sheenW: Float32Array;
  /** Static stipple hash in [0, 1) for sheen cells. */
  readonly sheenH: Float32Array;
  /** Vignette factor for sheen cells (dashes dissolve at the frame edge). */
  readonly sheenV: Float32Array;
}

let layers: StaticLayers | null = null;

function buildLayers(width: number, height: number): StaticLayers {
  const base = new Float32Array(width * height);
  const gain = new Float32Array(width * height);
  const fixture = new Int8Array(width * height).fill(-1);
  const sheenW = new Float32Array(width * height);
  const sheenH = new Float32Array(width * height);
  const sheenV = new Float32Array(width * height);

  // Scratch masks for the screen-space door-frame pass.
  const doorInterior = new Uint8Array(width * height);
  const wallCell = new Uint8Array(width * height);
  const wallFV = new Float32Array(width * height); // fade * vignette per wall cell

  const vx = width / 2;
  const vy = height * VANISH_Y;
  const rowStepUp = 1 / vy; // ceiling-space step per screen row
  const rowStepDown = 1 / (height - vy); // floor-space step per screen row

  // Vanishing-point sign: an explicit rectangle on the end wall, sized to
  // sit just inside the end-wall footprint (t < 1/Z_END).
  const signHalfW = Math.max(4, Math.floor((width / 2) * (1 / Z_END)) - 1);
  const signL = Math.round(vx) - signHalfW;
  const signR = Math.round(vx) + signHalfW;
  const signT = Math.ceil(vy * (1 - 1 / Z_END));
  const signB = Math.floor(vy + (height - vy) * (1 / Z_END));

  for (let y = 0; y < height; y++) {
    const py = y + 0.5;

    for (let x = 0; x < width; x++) {
      const px = x + 0.5;
      const i = y * width + x;
      const sx = (px - vx) / (width / 2);
      // Rectangular vignette: the diorama dissolves into true black at the
      // frame edges instead of pressing midtones against them.
      const ny = (py - height / 2) / (height / 2);
      const r = Math.max(Math.abs(sx), Math.abs(ny));
      const rs = Math.min(1, Math.max(0, (r - 0.7) / 0.3));
      const vignette = 1 - 0.82 * rs * rs * (3 - 2 * rs);
      const above = py < vy;
      const vertical = above ? (vy - py) / vy : (py - vy) / (height - vy);
      const t = Math.max(Math.abs(sx), vertical);

      if (t < 1 / Z_END) {
        // End wall: near-black, carrying the corridor's one destination —
        // an illuminated sign with a 1-cell border so it reads as A SIGN.
        let v = 0.05;

        if (x >= signL && x <= signR && y >= signT && y <= signB) {
          const onSide = x === signL || x === signR;
          const onCap = y === signT || y === signB;

          if (onSide && !onCap) {
            v = 0.45; // vertical border cells land in the "|" band
          } else if (onCap) {
            v = 0.35; // top/bottom border cells land in the "-" band
          } else if (y === Math.round((signT + signB) / 2)) {
            // One text-suggestion row: gapped runs of the ":" band.
            v = cellHash(x, 7) < 0.78 ? 0.27 : 0.13;
          } else {
            v = 0.13; // dim lit panel
          }
        }

        base[i] = v * vignette;
        continue;
      }

      const z = 1 / t;
      const fade = 1 / (1 + (z - 1) * 0.32);

      if (above && vertical >= Math.abs(sx)) {
        // Ceiling, with thin fluorescent bars across it. Each bar keeps a
        // minimum on-screen footprint (max with the row step) so distant
        // fixtures stay a crisp bright dash instead of aliasing away.
        const u = sx / vertical;
        base[i] = 0.12 * fade * vignette;

        let bestGain = 0;
        let bestIndex = -1;

        for (const [f, zf] of FIXTURE_Z.entries()) {
          const fuy = 1 / zf;
          const sigma = Math.max(0.12 * fuy * fuy, 0.6 * rowStepUp);
          const d = (vertical - fuy) / sigma;
          // Cold light is even light: a quartic falloff gives each tube a
          // flat plateau with a fast vertical cutoff, so it reads as a
          // uniform institutional bar with crisp caps instead of a warm glow
          // that swells in the middle and bleeds upward.
          const d4 = d * d * d * d;
          const bar = Math.min(1, 1.35 * Math.exp(-d4));
          const across = Math.min(1, Math.max(0, (0.4 - Math.abs(u)) / 0.06));
          const g = bar * across * emitterFade(zf);

          if (g > bestGain) {
            bestGain = g;
            bestIndex = f;
          }
        }

        if (bestGain > 0.02) {
          gain[i] = bestGain * vignette;
          fixture[i] = bestIndex;
        }
      } else if (!above && vertical >= Math.abs(sx)) {
        // Floor: linoleum kept below the dash band; the light is carried by
        // a stippled dash sheen under each fixture (density + crawl live in
        // update, so the sheen breathes with its tube). Reflections dim
        // faster with distance than the tubes themselves, so the far floor
        // stays calm under the sign.
        const u = sx / vertical;

        let bestG = 0;
        let bestIndex = -1;

        for (const [f, zf] of FIXTURE_Z.entries()) {
          const ffy = 1 / zf;
          const sigma = Math.max(0.45 * ffy * ffy, 0.8 * rowStepDown);
          const d = (vertical - ffy) / sigma;
          const ds = d / 1.8;
          const pool = Math.exp(-d * d) * Math.exp(-(u * u) / (0.5 * 0.5));
          const streak = 0.7 * Math.exp(-ds * ds) * Math.exp(-(u * u) / (0.14 * 0.14));
          const g = (pool + streak) / (1 + (zf - 1) * 0.14);

          if (g > bestG) {
            bestG = g;
            bestIndex = f;
          }
        }

        // Wet-wax interruption rhythm: the sheen is a reflection of the lit
        // wall plane, so where a doorway recess interrupts the wall the outer
        // reach of each pool breaks — a dark gap sweeps across at every door
        // depth — while the center streak (reflecting the tubes themselves)
        // runs on unbroken. This is what keeps the floor from reading as a
        // uniform band: polished linoleum, not carpet.
        let gap = 0;

        for (const zd of DOOR_Z) {
          const dgz = (z - zd) / 0.55;
          gap = Math.max(gap, Math.exp(-dgz * dgz));
        }

        const sideLin = Math.min(1, Math.max(0, (Math.abs(u) - 0.12) / 0.3));
        const interrupt = 1 - 0.88 * gap * sideLin * sideLin;

        bestG *= interrupt;

        // Hard shoulder on the footprint: no stray dashes far from a pool,
        // full density in the core.
        const lin = Math.min(1, Math.max(0, (bestG - 0.12) / 0.38));
        const w = lin * lin * (3 - 2 * lin);

        // Polished linoleum: the specular patch replaces the diffuse ground,
        // so the floor darkens where the sheen lives and the dashes pop. The
        // diffuse ground also dims a touch inside each doorway's reflection
        // gap (the recess it mirrors is near-black).
        base[i] =
          Math.min(FLOOR_CAP, 0.3 * fade * (1 - 0.15 * Math.abs(u))) *
          (1 - 0.45 * w) *
          (1 - 0.22 * gap * sideLin) *
          vignette;

        if (w > 0.01) {
          sheenW[i] = w;
          sheenH[i] = cellHash(x, y);
          sheenV[i] = vignette;
          fixture[i] = bestIndex;
        }
      } else {
        // Walls: a calm single-band dot field (speckle contrast reduced ~20%
        // per the brief), recessed near-black doors, and a bumper rail that
        // breaks at each doorway. Door frames are stamped in a screen-space
        // pass below so they stay exactly 1 cell wide at every distance.
        const signedVertical = above ? -vertical : vertical;
        const vwall = signedVertical / Math.abs(sx); // -1 ceiling edge .. 1 floor edge
        let v = 0.21 * fade * (0.84 + 0.08 * (vwall + 1));
        let door = false;

        for (const zd of DOOR_Z) {
          const dz = Math.abs(z - zd);

          if (dz < 0.5 && vwall > -0.52) {
            door = true;
            doorInterior[i] = 1;
            v = 0.05 * fade; // near-black recess, 1-2 ramp steps below the wall

            if (dz < 0.1 && vwall > -0.34 && vwall < -0.1) {
              v = 0.24 * fade; // small lit door window
            }

            if (zd === FAR_DOOR_Z && sx > 0) {
              // The one lit room: an absolute (not distance-faded) glow with
              // a soft vertical falloff, so the farthest doorway carries a
              // faint dotted warmth at the end of the cold fixture run.
              v = Math.max(v, FAR_DOOR_GLOW * (1 - 0.45 * Math.max(0, vwall)));
            }

            break;
          }
        }

        if (!door) {
          wallCell[i] = 1;
          wallFV[i] = fade * vignette;

          if (vwall > 0.14 && vwall < 0.26) {
            v += 0.12 * fade; // bumper rail
          }

          if (sx > 0) {
            // Spill from the lit far room onto the neighboring wall: a dim
            // dotted wedge that lifts the near-black end of the right wall
            // just enough to catch the eye on its way to the sign. Very wide
            // in z on purpose — perspective compresses the last several
            // z-units into a few columns, and the wash needs those columns
            // to read as light instead of noise.
            const dzGlow = (z - FAR_DOOR_Z) / 3.2;
            v += FAR_WALL_WASH * Math.exp(-dzGlow * dzGlow);
          }
        }

        base[i] = v * vignette;
      }
    }
  }

  // Screen-space door frames: every wall cell touching a door recess becomes
  // a 1-cell frame line, bright enough to punch at near distance and to stay
  // a faint dotted outline far away.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;

      if (!wallCell[i]) {
        continue;
      }

      let touchesDoor = false;

      for (let dy = -1; dy <= 1 && !touchesDoor; dy++) {
        const yy = y + dy;

        if (yy < 0 || yy >= height) {
          continue;
        }

        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;

          if (xx < 0 || xx >= width) {
            continue;
          }

          if (doorInterior[yy * width + xx]) {
            touchesDoor = true;
            break;
          }
        }
      }

      if (touchesDoor) {
        // Near frames punch as a crisp bright edge against the near-black
        // recess; distant ones fade to a faint dotted outline (fv carries the
        // distance falloff), so every doorway reads as a framed opening.
        base[i] = Math.max(base[i] ?? 0, 0.72 * (wallFV[i] ?? 0));
      }
    }
  }

  return { base, fixture, gain, sheenH, sheenV, sheenW };
}

export const scene: SceneModule = {
  dockGlyph: [
    "=#==#==#==#=",
    "|·        ·|",
    "| :  ##  : |",
    "| :  ==  : |",
    "|·  ····  ·|",
    "-·--·--·--·-",
  ],
  id: "corridor",
  init(context: SceneContext): void {
    // Idempotent: the harness contract check and the runner both call init.
    layers = buildLayers(context.buffer.width, context.buffer.height);
  },
  summaryChip: "Humana, 2020–2024 — safe rails for AI products.",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 160,
    minimalGlyph: "·",
    motion: {
      ambient: 1,
      faultyDip: 0.55,
      faultyFixture: 2,
      faultyRate: 0.26,
      flickerDepth: 0.14,
      flickerRate: 0.45,
      lightLevel: 1,
      sheenDensity: 0.6,
      sheenScale: 0.3,
      sheenSpeed: 0.4,
    },
    ramp: " ·:-|=+*#@",
    rows: 72,
  },
  update(_dt: number, context: SceneContext): void {
    const { buffer, time } = context;

    if (!layers || layers.base.length !== buffer.data.length) {
      layers = buildLayers(buffer.width, buffer.height);
    }

    const {
      ambient = 1,
      faultyDip = 0.55,
      faultyFixture = 2,
      faultyRate = 0.26,
      flickerDepth = 0.14,
      flickerRate = 0.45,
      lightLevel = 1,
      sheenDensity = 0.6,
      sheenScale = 0.3,
      sheenSpeed = 0.4,
    } = this.tuning.motion;

    // Per-fixture flicker: smooth noise drift near full brightness, plus one
    // struggling tube that softly sags and recovers (smoothstep-gated noise —
    // never a square wave). Driven by context.time only, so arbitrary
    // sleep/wake gaps land on a consistent state.
    const faulty = Math.round(faultyFixture);
    const flicker: number[] = [];

    for (let f = 0; f < FIXTURE_Z.length; f++) {
      const drift = fbm2(noise, 3.1 + time * flickerRate, f * 5.7, 2);
      let level = 1 - flickerDepth * drift;

      if (f === faulty) {
        // The struggling ballast mid-corridor: a raised gate on slow noise so
        // the sag arrives at long, irregular intervals — most of the time the
        // tube holds steady, then it dims over a second or two and recovers.
        const surge = fbm2(noise, 40 + time * faultyRate, 9.3, 2);
        const s = Math.min(1, Math.max(0, (surge - 0.72) / 0.14));
        level *= 1 - faultyDip * s * s * (3 - 2 * s);
      }

      flicker.push(level <= 0 ? 0 : level >= 1 ? 1 : level);
    }

    const { base, fixture, gain, sheenH, sheenV, sheenW } = layers;
    const data = buffer.data;
    const width = buffer.width;

    for (let i = 0; i < data.length; i++) {
      let v = (base[i] ?? 0) * ambient;
      const f = fixture[i] ?? -1;

      if (f >= 0) {
        v += (gain[i] ?? 0) * (flicker[f] ?? 1) * lightLevel;
      }

      const w = sheenW[i] ?? 0;

      if (w > 0) {
        // Dash-band sheen: a stippled single-glyph reflection whose density
        // follows its tube (a sagging ballast thins the sheen) and whose
        // stipple crawls on slow noise — the scene's water-adjacent breath.
        const raw = (flicker[f] ?? 1) * lightLevel;
        const level = raw <= 0 ? 0 : raw >= 1 ? 1 : raw;
        const x = i % width;
        const y = (i - x) / width;
        const drift = fbm2(noise, x * sheenScale - time * sheenSpeed, y * sheenScale * 1.6 + time * sheenSpeed * 0.35, 2);
        const threshold = sheenDensity * w * (0.3 + 0.7 * level);

        if (0.62 * (sheenH[i] ?? 0) + 0.38 * drift < threshold) {
          const dash = (DASH_LO + DASH_SPAN * level) * (sheenV[i] ?? 1);
          v = Math.max(v, dash);
        }
      }

      data[i] = v <= 0 ? 0 : v >= 1 ? 1 : v;
    }
  },
};
