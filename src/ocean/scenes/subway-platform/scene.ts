/**
 * Scene 7 — "subway-platform": a subway platform at 2 a.m. Between trains.
 *
 * The present tense. The brief's tone risk lives here: threshold, not stuck —
 * so the diorama's one quiet motion is a distant headlight that keeps
 * arriving (a LightSource creeping in from the tunnel mouth, rails catching
 * the reflection) plus the air it pushes ahead of it: dust drifting through
 * the track trench and across the platform floor. A diorama, not a
 * screensaver: everything else stands still — tiled wall, blank sign slab,
 * columns, platform edge, tactile strip, pooled fixture light.
 *
 * ALL human-readable copy in this scene is TODO(collin) — his pen,
 * explicitly. The sign slab and the calm floor region are the two copy
 * slots; they render as blank luminance and are exported below as
 * integrator-facing overlay hints (`subwayCopySlots`). No FACTS.md claims
 * are rendered here.
 *
 * View: standing on the platform, looking across the tracks at the far wall.
 */

import { createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const airNoise = createValueNoise(72);
const wallNoise = createValueNoise(19);
const cycleNoise = createValueNoise(41);

/** Horizontal/vertical layout, as fractions of the buffer (top = 0). */
const F = {
  beamTop: 0.07,
  edgeBottom: 0.65,
  edgeTop: 0.62,
  gapBottom: 0.44,
  railA: 0.515,
  railB: 0.555,
  signBottom: 0.24,
  signLeft: 0.4,
  signRight: 0.6,
  signTop: 0.13,
  stripeBottom: 0.21,
  stripeTop: 0.17,
  tactileBottom: 0.7,
  tunnelMouth: 0.05,
  wallBottom: 0.42,
  wallTop: 0.1,
} as const;

/**
 * Static luminance values, placed against the scene ramp's 11 equal bins
 * (width 1/11 ≈ 0.091): wall 0.265 sits at the ':'/'~' boundary so tiny
 * breathing reads; trench 0.055 sits just under '·' so drifting air
 * surfaces as sparse dots out of the black.
 */
const V = {
  beam: 0.14,
  ceiling: 0.04,
  column: 0.58,
  edge: 0.86,
  fixture: 0.95,
  floor: 0.15,
  gap: 0.05,
  mortar: 0.13,
  poolAdd: 0.11,
  railBase: 0.4,
  sign: 0.5,
  stripe: 0.3,
  tactileHigh: 0.42,
  tactileLow: 0.14,
  trench: 0.055,
  wall: 0.26,
} as const;

export interface SubwayCopySlot {
  /** Stable id for the integrator's DOM overlay. */
  readonly id: string;
  /** TODO(collin) placeholder only — scene 7 copy is Collin's pen. */
  readonly placeholder: string;
  /** Overlay rect, normalized to the scene canvas (0..1, y down). */
  readonly rect: { readonly h: number; readonly w: number; readonly x: number; readonly y: number };
}

/**
 * The two copy slots this scene reserves. The sim keeps both regions calm
 * (the sign is a blank slab; the floor region gets only faint air) so DOM
 * prose can sit on them. Placeholder text only — never rendered as glyphs.
 */
export const subwayCopySlots: readonly SubwayCopySlot[] = [
  {
    id: "subway-sign",
    placeholder: "TODO(collin): scene 7 sign line — threshold, not stuck",
    rect: { h: F.signBottom - F.signTop, w: F.signRight - F.signLeft, x: F.signLeft, y: F.signTop },
  },
  {
    id: "subway-body",
    placeholder: "TODO(collin): scene 7 body copy — between trains, present tense",
    rect: { h: 0.26, w: 0.44, x: 0.3, y: 0.72 },
  },
];

let staticBase: Float32Array | null = null;
let staticKey = "";
let airPhase = 0;

function clamp01(value: number): number {
  return value <= 0 ? 0 : value >= 1 ? 1 : value;
}

function smooth01(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function rowOf(height: number, fraction: number): number {
  return Math.round(height * fraction);
}

/** Precomputed still life: everything that does not move between trains. */
function buildStatic(width: number, height: number, columnSpacing: number, fixtureSpacing: number): Float32Array {
  const data = new Float32Array(width * height);
  const beamTop = rowOf(height, F.beamTop);
  const wallTop = rowOf(height, F.wallTop);
  const wallBottom = rowOf(height, F.wallBottom);
  const trenchTop = rowOf(height, F.gapBottom);
  const railA = rowOf(height, F.railA);
  const railB = rowOf(height, F.railB);
  const edgeTop = rowOf(height, F.edgeTop);
  const edgeBottom = rowOf(height, F.edgeBottom);
  const tactileBottom = rowOf(height, F.tactileBottom);
  const stripeTop = rowOf(height, F.stripeTop);
  const stripeBottom = rowOf(height, F.stripeBottom);
  const signLeft = Math.round(width * F.signLeft);
  const signRight = Math.round(width * F.signRight);
  const signTop = rowOf(height, F.signTop);
  const signBottom = rowOf(height, F.signBottom);
  const mouthRight = Math.max(4, Math.round(width * F.tunnelMouth));

  const fixtureStep = Math.max(6, Math.round(fixtureSpacing));
  const fixtureXs: number[] = [];
  for (let x = Math.round(fixtureStep / 2); x < width; x += fixtureStep) {
    fixtureXs.push(x);
  }

  const columnStep = Math.max(8, Math.round(columnSpacing));
  const columnXs: number[] = [];
  for (let x = Math.round(columnStep / 2); x < width - 1; x += columnStep) {
    // Columns never cross the sign slab (the copy slot stays clear) and
    // never stand inside the tunnel mouth.
    if (x + 1 >= signLeft - 2 && x <= signRight + 1) {
      continue;
    }
    if (x < mouthRight + 2) {
      continue;
    }
    columnXs.push(x);
  }

  for (let y = 0; y < height; y++) {
    const base = y * width;

    for (let x = 0; x < width; x++) {
      let v: number = V.ceiling;

      if (y >= beamTop && y < wallTop) {
        v = V.beam;
      } else if (y >= wallTop && y < wallBottom) {
        v = V.wall;
        if (x % 8 === 0 || (y - wallTop) % 3 === 2) {
          v = V.mortar;
        }
        if (y >= stripeTop && y < stripeBottom) {
          v = V.stripe;
        }
        if (x >= signLeft && x < signRight && y >= signTop && y < signBottom) {
          v = V.sign;
        }
      } else if (y >= wallBottom && y < trenchTop) {
        v = V.gap;
      } else if (y >= trenchTop && y < edgeTop) {
        // Rails fade as they run into the tunnel mouth.
        v = y === railA || y === railB ? V.railBase * smooth01(x / Math.max(1, width * 0.07)) : V.trench;
      } else if (y >= edgeTop && y < edgeBottom) {
        v = V.edge;
      } else if (y >= edgeBottom && y < tactileBottom) {
        v = Math.floor(x / 2) % 2 === 0 ? V.tactileHigh : V.tactileLow;
      } else if (y >= tactileBottom) {
        v = V.floor;
        // Fixture light pooling on the platform floor, fading with distance.
        const depth = 1 - (y - tactileBottom) / Math.max(1, height - tactileBottom);
        for (const fx of fixtureXs) {
          const dx = x - fx;
          v += V.poolAdd * Math.exp(-(dx * dx) / 40) * depth * depth;
        }
      }

      // The tunnel mouth: a dark portal cut into the left end of the far
      // wall, down through the trench. The headlight resolves out of it.
      if (x < mouthRight && y >= wallTop + 2 && y < edgeTop && y !== railA && y !== railB) {
        v = Math.min(v, 0.03);
      }

      data[base + x] = clamp01(v);
    }
  }

  // Fixtures on the ceiling beam (steady — no flicker; that motif belongs
  // to the corridor scene).
  for (const fx of fixtureXs) {
    for (let y = beamTop; y < wallTop; y++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = fx + dx;
        if (x < width) {
          data[y * width + x] = V.fixture;
        }
      }
    }
  }

  // I-beam columns from the ceiling beam down to the platform edge; the near
  // rails are drawn in front of them (they belong to the near track).
  for (const cx of columnXs) {
    for (let y = beamTop; y < edgeTop; y++) {
      if (y === railA || y === railB) {
        continue;
      }
      const base = y * width;
      data[base + cx] = V.column;
      if (cx + 1 < width) {
        data[base + cx + 1] = V.column;
      }
    }
  }

  return data;
}

export const subwayPlatformScene: SceneModule = {
  dockGlyph: [
    "  @      @  ",
    " |  :==:  | ",
    " |  ::::  | ",
    "------------",
    "############",
    " · · · · · ·",
  ],
  id: "subway-platform",
  init(context: SceneContext): void {
    airPhase = 0;
    staticBase = null;
    staticKey = "";
    context.lights.push({
      intensity: 0,
      radius: 11,
      x: -4,
      y: rowOf(context.buffer.height, (F.railA + F.railB) / 2),
    });
  },
  summaryChip: "TODO(collin): subway-platform summary line",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 160,
    minimalGlyph: "·",
    motion: {
      airAmount: 0.05,
      breeze: 0.32,
      breezePush: 2,
      columnSpacing: 38,
      fixtureSpacing: 20,
      headlightApproach: 9,
      headlightHold: 5,
      headlightIntensity: 0.8,
      headlightPeriod: 42,
      headlightRadius: 11,
      headlightReach: 0.15,
      headlightRecede: 7,
      noiseScale: 0.11,
      railFalloff: 0.2,
      railGlow: 0.32,
      tileBreath: 0.015,
    },
    ramp: " ·:~-=|+*#@",
    rows: 72,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, lights, time } = context;
    const {
      airAmount = 0.05,
      breeze = 0.32,
      breezePush = 2,
      columnSpacing = 38,
      fixtureSpacing = 20,
      headlightApproach = 9,
      headlightHold = 5,
      headlightIntensity = 0.8,
      headlightPeriod = 42,
      headlightRadius = 11,
      headlightReach = 0.15,
      headlightRecede = 7,
      noiseScale = 0.11,
      railFalloff = 0.2,
      railGlow = 0.32,
      tileBreath = 0.015,
    } = this.tuning.motion;
    const width = buffer.width;
    const height = buffer.height;
    const data = buffer.data;

    const key = `${width}x${height}|${columnSpacing}|${fixtureSpacing}`;
    if (!staticBase || staticBase.length !== data.length || key !== staticKey) {
      staticBase = buildStatic(width, height, columnSpacing, fixtureSpacing);
      staticKey = key;
    }

    // --- The distant headlight: a pure function of time. Each cycle the
    // light enters the tunnel mouth, approaches a little way down the rails,
    // holds (a train waiting on its signal), and dims. Deterministic
    // per-cycle jitter keeps the interval from reading as a loop.
    const approach = Math.max(0.25, headlightApproach);
    const hold = Math.max(0, headlightHold);
    const recede = Math.max(0.25, headlightRecede);
    const active = approach + hold + recede;
    const period = Math.max(active + 1, headlightPeriod);
    const cycle = Math.floor(time / period);
    const jitterA = cycleNoise(cycle * 12.9 + 0.37, 4.7);
    const jitterB = cycleNoise(cycle * 5.3 + 8.11, 21.5);
    const delay = Math.min(period * 0.3, Math.max(0, period - active)) * jitterA;
    const s = time - cycle * period - delay;

    let envelope = 0;
    let travel = 0;
    if (s > 0 && s < active) {
      if (s < approach) {
        travel = smooth01(s / approach);
        envelope = travel;
      } else if (s < approach + hold) {
        travel = 1;
        envelope = 1;
      } else {
        travel = 1;
        envelope = smooth01(1 - (s - approach - hold) / recede);
      }
    }
    const peak = clamp01(headlightIntensity * (0.8 + 0.25 * jitterB));

    // --- Air movement: the breeze a train pushes ahead of itself. The drift
    // phase integrates so the push accelerates smoothly with the envelope.
    airPhase += dt * breeze * (1 + envelope * breezePush);

    data.set(staticBase);

    const wallTop = rowOf(height, F.wallTop);
    const wallBottom = rowOf(height, F.wallBottom);
    const trenchTop = rowOf(height, F.gapBottom);
    const railA = rowOf(height, F.railA);
    const railB = rowOf(height, F.railB);
    const edgeTop = rowOf(height, F.edgeTop);
    const tactileBottom = rowOf(height, F.tactileBottom);
    const signLeft = Math.round(width * F.signLeft);
    const signRight = Math.round(width * F.signRight);
    const signTop = rowOf(height, F.signTop);
    const signBottom = rowOf(height, F.signBottom);
    const wallPhase = time * 0.05;

    // Wall tiles breathe faintly (the scene's water-adjacent part), never
    // under the sign slab: the copy slot stays calm.
    for (let y = wallTop; y < wallBottom; y++) {
      const base = y * width;
      const ny = y * noiseScale * 0.9;
      for (let x = 0; x < width; x++) {
        if (x >= signLeft && x < signRight && y >= signTop && y < signBottom) {
          continue;
        }
        const v = (data[base + x] ?? 0) + (fbm2(wallNoise, x * noiseScale * 0.6 + wallPhase, ny, 1) - 0.5) * 2 * tileBreath;
        data[base + x] = clamp01(v);
      }
    }

    // Dust drifting through the track trench (rail rows stay crisp).
    for (let y = trenchTop; y < edgeTop; y++) {
      if (y === railA || y === railB) {
        continue;
      }
      const base = y * width;
      const ny = y * noiseScale * 1.7;
      for (let x = 0; x < width; x++) {
        const v = (data[base + x] ?? 0) + (fbm2(airNoise, x * noiseScale + airPhase, ny, 2) - 0.5) * 2 * airAmount;
        data[base + x] = clamp01(v);
      }
    }

    // Fainter air over the platform floor.
    const floorAmount = airAmount * 0.7;
    for (let y = tactileBottom; y < height; y++) {
      const base = y * width;
      const ny = y * noiseScale * 1.7;
      for (let x = 0; x < width; x++) {
        const v = (data[base + x] ?? 0) + (fbm2(airNoise, x * noiseScale + airPhase, ny, 2) - 0.5) * 2 * floorAmount;
        data[base + x] = clamp01(v);
      }
    }

    // Rails catch the headlight: a reflection spreading from the light.
    const lightX = -4 + travel * (headlightReach * width + 4);
    if (envelope > 0) {
      const fall = Math.max(1, width * railFalloff);
      for (const y of [railA, railB]) {
        const base = y * width;
        for (let x = 0; x < width; x++) {
          const add = envelope * railGlow * Math.exp(-Math.abs(x - lightX) / fall);
          data[base + x] = clamp01((data[base + x] ?? 0) + add);
        }
      }
    }

    const light = lights[0];
    if (light) {
      light.x = lightX;
      light.y = (railA + railB) / 2;
      light.radius = headlightRadius;
      light.intensity = envelope * peak;
    }
  },
};
