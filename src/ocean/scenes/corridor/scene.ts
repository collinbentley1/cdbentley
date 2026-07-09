/**
 * Scene 4 — "corridor": an empty hospital corridor.
 *
 * One-point perspective. A row of fluorescent ceiling fixtures recedes
 * toward a vanishing point; their light pools on polished linoleum; doors
 * and a bumper rail punctuate the walls; the far end is nearly black.
 *
 * The single idiomatic motion is fluorescent shimmer: every tube drifts a
 * few percent around full brightness on slow value noise, and ONE tube
 * (tunable) occasionally sags and recovers — a struggling ballast, not a
 * strobe. Restraint is deliberate (a11y): all modulation is smooth noise
 * with dominant periods measured in seconds (well under any flash-risk
 * frequency), amplitude is hand-tunable down to zero, and the reduced-motion
 * plain view exists site-wide (Phase C). The floor reflection is the scene's
 * water-adjacent part — it breathes on the sparse end of the ramp.
 *
 * Claim slot notes for the Phase C integrator (nothing here is rendered):
 * - FACTS S1 (DEFENSIBLE) grounds this scene's claim slot: enterprise LLM
 *   products inside a Fortune-50 payer, 2022–24; Humana Studio H public
 *   press receipts. Typeset at grade (mid-ramp + receipt chip).
 * - TODO(collin): the design brief mentions a "2M-member refill model".
 *   That claim is NOT in FACTS.md at any grade — it must never render as
 *   fact. If the slot wants it, it ships only as a Collin-written
 *   placeholder pending a receipt.
 *
 * This scene renders no human-readable copy (glyphs only); summaryChip is a
 * TODO(collin) placeholder per the copy rule.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const noise = createValueNoise(41);

/**
 * Structural geometry — baked into the static layers at init; changing these
 * requires a reload (the live-tunable per-frame constants live in
 * tuning.motion instead, per the SDK convention).
 */
const VANISH_Y = 0.44; // vanishing point, as a fraction of grid height
const Z_END = 14; // corridor length in depth units; beyond it: the end wall
const FIXTURE_Z = [1.75, 3.8, 6.0, 8.2, 10.4, 12.6] as const;
const DOOR_Z = [2.7, 5.1, 7.5, 9.9, 12.3] as const;

/** Emitters dim only slightly with distance (they are sources, not surfaces). */
function emitterFade(z: number): number {
  return 1 / (1 + (z - 1) * 0.06);
}

interface StaticLayers {
  /** Ambient architecture: ceiling, floor, walls, doors, rail, end wall. */
  readonly base: Float32Array;
  /** Emission added at flicker = 1 (ceiling bars + their floor pools). */
  readonly gain: Float32Array;
  /** Which fixture modulates this cell's emission; -1 = none. */
  readonly fixture: Int8Array;
  /** Floor-shimmer amplitude (the water-adjacent breathing); 0 elsewhere. */
  readonly shim: Float32Array;
}

let layers: StaticLayers | null = null;

function buildLayers(width: number, height: number): StaticLayers {
  const base = new Float32Array(width * height);
  const gain = new Float32Array(width * height);
  const fixture = new Int8Array(width * height).fill(-1);
  const shim = new Float32Array(width * height);

  const vx = width / 2;
  const vy = height * VANISH_Y;
  const rowStepUp = 1 / vy; // ceiling-space step per screen row
  const rowStepDown = 1 / (height - vy); // floor-space step per screen row

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
        // End wall: near-black, one faint static glow where the corridor ends.
        const dx = px - vx;
        const dy = py - vy;
        base[i] = (0.045 + 0.08 * Math.exp(-(dx * dx + dy * dy) / 36)) * vignette;
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
          const across = Math.min(1, Math.max(0, (0.4 - Math.abs(u)) / 0.1));
          const g = Math.exp(-d * d) * across * emitterFade(zf);

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
        // Floor: lighter linoleum, a soft pool + a narrow vertical streak of
        // reflection under each fixture (same minimum-footprint trick).
        const u = sx / vertical;
        base[i] = 0.34 * fade * (1 - 0.18 * Math.abs(u)) * vignette;

        let bestGain = 0;
        let bestIndex = -1;

        for (const [f, zf] of FIXTURE_Z.entries()) {
          const ffy = 1 / zf;
          const sigma = Math.max(0.45 * ffy * ffy, 0.8 * rowStepDown);
          const d = (vertical - ffy) / sigma;
          const ds = d / 1.8;
          const pool = 0.34 * Math.exp(-d * d) * Math.exp(-(u * u) / (0.5 * 0.5));
          const streak = 0.18 * Math.exp(-ds * ds) * Math.exp(-(u * u) / (0.14 * 0.14));
          const g = (pool + streak) * emitterFade(zf);

          if (g > bestGain) {
            bestGain = g;
            bestIndex = f;
          }
        }

        if (bestGain > 0.004) {
          gain[i] = bestGain * vignette;
          fixture[i] = bestIndex;
        }

        shim[i] = (0.05 * fade + 0.5 * bestGain) * vignette;
      } else {
        // Walls: vertical shading, recessed doors (frame + small window), and
        // a bumper rail that breaks at each doorway.
        const signedVertical = above ? -vertical : vertical;
        const vwall = signedVertical / Math.abs(sx); // -1 ceiling edge .. 1 floor edge
        let v = 0.26 * fade * (0.82 + 0.09 * (vwall + 1));
        let door = false;

        for (const zd of DOOR_Z) {
          const dz = Math.abs(z - zd);

          if (dz < 0.5 && vwall > -0.52) {
            door = true;
            v = 0.14 * fade; // dark recess

            if (dz > 0.42 || vwall < -0.44) {
              v = 0.34 * fade; // door frame
            } else if (dz < 0.1 && vwall > -0.34 && vwall < -0.1) {
              v = 0.27 * fade; // small door window
            }

            break;
          }
        }

        if (!door && vwall > 0.14 && vwall < 0.26) {
          v += 0.12 * fade; // bumper rail
        }

        base[i] = v * vignette;
      }
    }
  }

  return { base, fixture, gain, shim };
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
  summaryChip: "TODO(collin): corridor scene summary line",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 160,
    minimalGlyph: "·",
    motion: {
      ambient: 1,
      faultyDip: 0.5,
      faultyFixture: 1,
      faultyRate: 0.5,
      flickerDepth: 0.22,
      flickerRate: 0.6,
      lightLevel: 1,
      shimmerAmp: 0.5,
      shimmerScale: 0.35,
      shimmerSpeed: 0.5,
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
      faultyDip = 0.5,
      faultyFixture = 1,
      faultyRate = 0.5,
      flickerDepth = 0.22,
      flickerRate = 0.6,
      lightLevel = 1,
      shimmerAmp = 0.5,
      shimmerScale = 0.35,
      shimmerSpeed = 0.5,
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
        const surge = fbm2(noise, 40 + time * faultyRate, 9.3, 2);
        const s = Math.min(1, Math.max(0, (surge - 0.6) / 0.15));
        level *= 1 - faultyDip * s * s * (3 - 2 * s);
      }

      flicker.push(level <= 0 ? 0 : level >= 1 ? 1 : level);
    }

    const { base, fixture, gain, shim } = layers;
    const data = buffer.data;
    const width = buffer.width;

    for (let i = 0; i < data.length; i++) {
      let v = (base[i] ?? 0) * ambient;
      const f = fixture[i] ?? -1;

      if (f >= 0) {
        v += (gain[i] ?? 0) * (flicker[f] ?? 1) * lightLevel;
      }

      const s = shim[i] ?? 0;

      if (s > 0) {
        const x = i % width;
        const y = (i - x) / width;
        const n = fbm2(noise, x * shimmerScale * 0.55 - time * shimmerSpeed, y * shimmerScale + time * shimmerSpeed * 0.4, 2);
        v += s * shimmerAmp * (n - 0.5);
      }

      data[i] = v <= 0 ? 0 : v >= 1 ? 1 : v;
    }
  },
};
