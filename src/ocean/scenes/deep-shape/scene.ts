/**
 * Deep register — "deep-shape": the deepest water on the site. Almost
 * nothing: near-black water breathing on the sparse end of the ramp, marine
 * snow sinking, and one small wandering glow — a lure-like patch where the
 * ramp lifts out of the black. Rarely — after ~30 seconds of dwelling here at
 * full resolution (motion.idleDelay), or when the discoverable gesture fires
 * (Phase C sets motion.summon >= 1; the harness can too) — something enormous
 * and serpentine crosses the frame, once, and is gone. Silhouette only: the
 * body OCCLUDES water, snow and glow (a moving hole in the texture), and
 * where it passes near the glow a thin rim catches the light — swelling
 * slightly while the body's nearest point passes the light and fading a beat
 * after (rimBloom / rimBloomFade). The undulation is enveloped along the
 * spine (WAVE_TAPER_*): the head holds its line, the tail carries the full
 * sweep, so the crossing reads as mass driving itself. It is never
 * named — not in code, comments, copy, commits, or the PR. Neutral
 * identifiers only; the silhouette is an original design (undulating spine,
 * blunt nose, ridge serrations, tapered tail), built from a radius profile,
 * not from any prior asset.
 *
 * Why the glow is drawn inside update() instead of context.lights: the
 * runner stamps context.lights ADDITIVELY AFTER update returns, so a light
 * there cannot be occluded — the silhouette would wash out at the one moment
 * it matters. The same quartic falloff as sdk/light.ts is applied in-update,
 * then the body is carved out of it. context.lights stays empty by design
 * (the contract allows it); a test pins this so Phase C knows.
 *
 * Rarity discipline: one pass per trigger, then the idle clock restarts.
 * The clock only accrues while depth < the first bin threshold (you must be
 * watching at full resolution), and sleep() aborts any pass and resets the
 * clock — you have to dwell in the deep. Screenshot-worthy and missable is
 * the point.
 *
 * Copy rule: this scene renders no text — that absence is the point. The
 * dock glyph deliberately compresses to what MOST visitors saw — dark
 * water, the small glow, a faint undulation underneath — so the shelf
 * never spoils the encounter for those who missed it.
 *
 * Ramp intent (hand-tunable, Collin's brush), dark -> bright: " ·:~≈=+*#@".
 * Water breathes in " ·:", the glow halo lifts it to "~≈", the lit rim
 * reaches "=+*", and "@" belongs to two things only: the lure's hot core and
 * the single eye glint when the light finds the head. simplifyRamp level 1 =
 * " :=*@" (still watery); level 2 residue = " ·" (the pooled core is what
 * keeps the residue inked at bin 4).
 */

import { DEFAULT_RESOLUTION, createValueNoise, fbm2, type SceneContext, type SceneModule } from "../../sdk/index.ts";

const waterNoise = createValueNoise(53);
const glowFlickerNoise = createValueNoise(211);

/** Deterministic integer hash -> [0, 1). Keeps every pass reproducible. */
function hash(seed: number, a: number, b: number): number {
  let h = Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Horizontal off-screen margin (cells) a pass starts and ends beyond. */
const EDGE_MARGIN = 14;
/** Rim thickness (cells) outside the body where the glow catches the edge. */
const RIM_WIDTH = 1.8;
/**
 * Wake-follow taper: fraction of waveAmp the head keeps. The head holds its
 * line (intent); the wave builds along the spine so the tail carries the full
 * sweep (mass). Uniform amplitude read as a corrugated ribbon sliding — the
 * taper is what makes the undulation read as a body driving itself.
 */
const WAVE_TAPER_HEAD = 0.28;
/** Shape of the build head -> tail (u^exp). >1 keeps the fore-body calm. */
const WAVE_TAPER_EXP = 1.7;
/** Secondary ripple floor at the head; the fine wave lives aft (u^2 build). */
const RIPPLE_HEAD = 0.15;
/** Extra rim thickness (fraction of RIM_WIDTH) at full flank bloom. */
const RIM_BLOOM_WIDEN = 0.4;
/** Surface distance (cells) inside which bloom no longer grows (deadband). */
const BLOOM_DEADBAND = 1.5;
/** Bloom falloff range as a fraction of glowRadius. */
const BLOOM_RANGE = 0.45;
/** Attack rate (1/s) when the flank nears the light; decay is rimBloomFade. */
const BLOOM_ATTACK = 5;
/**
 * Adaptation time constant (s). The bloom responds to the ARRIVAL of the
 * body's nearest point, not its dwell: a slow follower of raw proximity is
 * subtracted from it, so a long stretch of body streaming through the pool
 * swells once and relaxes back to the base rim instead of staying lit.
 */
const BLOOM_ADAPT_TAU = 3.5;
/** Interior silhouette luminance — below the first ramp step: a hole. */
const BODY_FLOOR = 0.012;
/**
 * Mobile readability floor. At the mobile breakpoint the canvas is drawn at
 * ~96vw (≈2.3px/cell on a 390px grid), where a true hole in near-black water
 * carries zero contrast and the pass vanishes. There the interior is lifted to
 * a dim, uniform silhouette — its darkest visible state sits two ramp steps
 * above black (ramp " ·:~≈…" index 2 = ":"), so the shape reads as a form even
 * away from the glow, while still staying darker than the glow-lit rim it
 * carves. Desktop keeps the true hole (BODY_FLOOR). Snapshot at module load,
 * mirroring the beach scene's orientation probe; guarded for the test/no-DOM
 * environment so the desktop hole is what the contract test measures.
 */
const BODY_FLOOR_MOBILE = 0.26;
/** Radius multiplier at the mobile breakpoint (§4.11): a bigger silhouette. */
const MOBILE_GIRTH = 1.5;
const IS_MOBILE =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(max-width: 760px)").matches;
const BODY_FLOOR_EFF = IS_MOBILE ? BODY_FLOOR_MOBILE : BODY_FLOOR;
const GIRTH_EFF = IS_MOBILE ? MOBILE_GIRTH : 1;
/** Idle depth gate: the clock only runs at full resolution (bin 1). */
const IDLE_MAX_DEPTH = DEFAULT_RESOLUTION.binDepths[0];
/**
 * A pass in flight is aborted once the scene starts collapsing to its dock
 * glyph. Two reasons: scrolling away mid-pass should cost you the encounter
 * (rarity), and the body crossing the glow core would otherwise blank the
 * bin-4/level-2 residue while the scene is nearly forgotten.
 */
const PASS_ABORT_DEPTH = DEFAULT_RESOLUTION.collapseDepths[0];

/**
 * Body radius profile head (u=0) -> tail (u=1), in cells at bodyGirth 1.
 * Blunt nose, slight neck, deep mid-body, long taper. Original silhouette.
 */
const RADIUS_PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0, 0.5],
  [0.035, 2.7],
  [0.09, 3.3],
  [0.16, 2.7],
  [0.4, 4.3],
  [0.62, 3.4],
  [0.82, 1.9],
  [0.94, 0.9],
  [1, 0.35],
];

function radiusAt(u: number, girth: number): number {
  let r = RADIUS_PROFILE[RADIUS_PROFILE.length - 1]?.[1] ?? 0.35;

  for (let i = 0; i < RADIUS_PROFILE.length - 1; i++) {
    const p0 = RADIUS_PROFILE[i];
    const p1 = RADIUS_PROFILE[i + 1];

    if (!p0 || !p1 || u > p1[0]) {
      continue;
    }

    const t = (u - p0[0]) / (p1[0] - p0[0]);
    const smooth = (1 - Math.cos(Math.PI * t)) / 2;
    r = p0[1] + (p1[1] - p0[1]) * smooth;
    break;
  }

  // Ridge serrations along the back half of the spine — reads as segment
  // plates in silhouette, never as texture (radius-only, still a shadow).
  const ridge = u > 0.12 && u < 0.88 ? 0.55 * Math.abs(Math.sin(u * Math.PI * 9)) ** 6 : 0;

  return girth * (r + ridge);
}

interface PassState {
  baseY: number;
  bodyLen: number;
  dir: 1 | -1;
  phase1: number;
  phase2: number;
  speed: number;
  startX: number;
  t: number;
  total: number;
}

/** Module state — fully reset by init() so re-init is idempotent. */
let idleTime = 0;
let passCount = 0;
let pass: PassState | null = null;
let glowX = 0;
let glowY = 0;
let sdf = new Float32Array(0);
/**
 * Flank bloom 0..1: eased proximity of the body's nearest surface point to
 * the light. Attacks fast as the mass swings in, decays over rimBloomFade
 * after it moves on — the swell-and-linger is the one temporal accent of the
 * pass. Also gates the eye glint to the closest-approach beat.
 */
let flankBloom = 0;
/** Slow follower of raw proximity (see BLOOM_ADAPT_TAU). */
let bloomAdapt = 0;
/** Diagnostic only (probe/trace): glow luminance sampled at the eye cell. */
let eyeLocal = 0;

function startPass(width: number, height: number, motion: Record<string, number>): PassState {
  const bodySpan = motion.bodySpan ?? 1.25;
  const traverseTime = Math.max(4, motion.traverseTime ?? 20);
  const n = ++passCount;
  const dir: 1 | -1 = hash(21, n, 1) < 0.5 ? 1 : -1;
  const bodyLen = Math.max(20, bodySpan * width);
  const speed = (width + 2 * EDGE_MARGIN) / traverseTime;

  return {
    baseY: height * (0.32 + 0.3 * hash(21, n, 2)),
    bodyLen,
    dir,
    phase1: hash(21, n, 3) * Math.PI * 2,
    phase2: hash(21, n, 4) * Math.PI * 2,
    speed,
    startX: dir > 0 ? -EDGE_MARGIN : width + EDGE_MARGIN,
    t: 0,
    total: (width + 2 * EDGE_MARGIN + bodyLen) / speed,
  };
}

/**
 * Spine centerline: y as a function of x, so the body follows its own wake.
 * `u` (0 head -> 1 tail) drives the amplitude envelope: the head keeps
 * WAVE_TAPER_HEAD of the sweep and the wave builds toward the tail, so the
 * undulation reads as mass driving itself, not a ribbon sliding. The fine
 * secondary wave is weighted aft the same way (u^2): the fore-body stays
 * smooth and heavy, the ripple lives in the tail.
 */
function pathY(state: PassState, x: number, time: number, waveAmp: number, waveLength: number, u: number): number {
  const k1 = (Math.PI * 2) / Math.max(8, waveLength);
  const k2 = k1 * 2.33;
  const envelope = WAVE_TAPER_HEAD + (1 - WAVE_TAPER_HEAD) * u ** WAVE_TAPER_EXP;
  const ripple = RIPPLE_HEAD + (1 - RIPPLE_HEAD) * u * u;

  return (
    state.baseY +
    waveAmp * envelope * Math.sin(x * k1 + state.phase1 + time * 0.22) +
    waveAmp * 0.32 * envelope * ripple * Math.sin(x * k2 + state.phase2 - time * 0.31)
  );
}

/**
 * Glow luminance at squared distance dist2 from the glow center: a soft
 * quartic halo (same falloff as sdk/light.ts) plus a tight bright core. The
 * core matters twice: it makes the lure read as a point of light inside its
 * own halo at full resolution, and it keeps the scene's residue alive at
 * bin 4 + ramp level 2 (without it the pooled glow averages below the two-
 * glyph threshold and the deepest memory would be pure black).
 */
function glowAt(dist2: number, haloIntensity: number, haloInvR2: number, coreIntensity: number, coreInvR2: number): number {
  const q = 1 - dist2 * haloInvR2;
  let v = q > 0 ? haloIntensity * q * q : 0;
  const qc = 1 - dist2 * coreInvR2;

  if (qc > 0) {
    v += coreIntensity * qc * qc;
  }

  return v;
}

/**
 * Test/debug probe (also handy in the harness console). Read-only snapshot;
 * not part of the frozen contract surface.
 */
export function deepShapeProbe(): {
  active: boolean;
  bloom: number;
  eyeLocal: number;
  headX: number;
  headY: number;
  idleTime: number;
  passes: number;
} {
  const headX = pass ? pass.startX + pass.dir * pass.speed * pass.t : Number.NaN;

  return {
    active: pass !== null,
    bloom: flankBloom,
    eyeLocal,
    headX,
    headY: pass ? pass.baseY : Number.NaN,
    idleTime,
    passes: passCount,
  };
}

export const deepShapeScene: SceneModule = {
  dockGlyph: [
    "            ",
    "    ·≈≈·    ",
    "   ·≈@≈·    ",
    "    ·≈≈·    ",
    "  ·~·  ·~·  ",
    "            ",
  ],
  id: "deep-shape",
  init(context: SceneContext): void {
    idleTime = 0;
    passCount = 0;
    pass = null;
    flankBloom = 0;
    bloomAdapt = 0;
    eyeLocal = 0;
    glowX = context.buffer.width * 0.5;
    glowY = context.buffer.height * 0.42;
    sdf = new Float32Array(context.buffer.data.length);
    // Deliberately no context.lights entry — see the header: the glow must be
    // occludable, so it is stamped (and carved) inside update() instead.
    context.lights.length = 0;
  },
  summaryChip: "Deeper — it doesn't have a name.",
  tuning: {
    cellH: 8,
    cellW: 8,
    cols: 160,
    minimalGlyph: "·",
    motion: {
      ambientAmount: 0.04,
      ambientScale: 0.06,
      ambientSpeed: 0.05,
      bodyGirth: 1,
      bodySpan: 1.25,
      coreGain: 1.3,
      eyeGain: 2,
      glowChase: 0.9,
      glowDrift: 0.03,
      glowIntensity: 0.36,
      glowRadius: 18,
      idleDelay: 30,
      rimBloom: 0.9,
      rimBloomFade: 1.4,
      rimGain: 1.1,
      snowBright: 0.22,
      snowCount: 34,
      snowSpeed: 1.2,
      summon: 0,
      traverseTime: 20,
      waveAmp: 7,
      waveLength: 58,
    },
    ramp: " ·:~≈=+*#@",
    rows: 72,
  },
  update(dt: number, context: SceneContext): void {
    const { buffer, time } = context;
    const {
      ambientAmount = 0.04,
      ambientScale = 0.06,
      ambientSpeed = 0.05,
      bodyGirth = 1,
      coreGain = 1.1,
      eyeGain = 2,
      glowChase = 0.9,
      glowDrift = 0.03,
      glowIntensity = 0.36,
      glowRadius = 18,
      idleDelay = 30,
      rimBloom = 0.9,
      rimBloomFade = 1.4,
      rimGain = 1.1,
      snowBright = 0.22,
      snowCount = 34,
      snowSpeed = 1.2,
      summon = 0,
      waveAmp = 7,
      waveLength = 58,
    } = this.tuning.motion;
    const width = buffer.width;
    const height = buffer.height;
    const data = buffer.data;

    if (sdf.length !== data.length) {
      sdf = new Float32Array(data.length);
    }

    // 1) Deep water: a dim column, marginally brighter overhead (where the
    //    surface was), breathing on the sparse end of the ramp.
    const drift = time * ambientSpeed;

    for (let y = 0; y < height; y++) {
      const base = 0.028 + 0.022 * (1 - y / height);
      const ny = y * ambientScale * 1.7 - drift * 0.6;
      const rowBase = y * width;

      for (let x = 0; x < width; x++) {
        const n = fbm2(waterNoise, x * ambientScale + drift, ny, 2);
        const v = base + (n - 0.5) * 2 * ambientAmount;
        data[rowBase + x] = v < 0 ? 0 : v > 1 ? 1 : v;
      }
    }

    // 2) Marine snow: sparse single-cell motes sinking with a slight sway.
    const motes = Math.max(0, Math.floor(snowCount));

    for (let i = 0; i < motes; i++) {
      const fall = snowSpeed * (0.5 + 0.7 * hash(7, i, 1));
      const sway = Math.sin(time * (0.12 + 0.1 * hash(7, i, 3)) + i * 1.7) * 2.2;
      const px = hash(7, i, 2) * width + sway;
      const py = hash(7, i, 4) * height + time * fall;
      const x = Math.floor(((px % width) + width) % width);
      const y = Math.floor(((py % height) + height) % height);
      const index = y * width + x;
      const bright = snowBright * (0.5 + 0.5 * hash(7, i, 5));
      const current = data[index] ?? 0;
      data[index] = bright > current ? (bright > 1 ? 1 : bright) : current;
    }

    // 3) Trigger clock. Idle accrues only at full resolution; a pass runs to
    //    completion once started, then the clock restarts (rarity).
    if (pass) {
      pass.t += dt;

      if (pass.t >= pass.total || context.depth >= PASS_ABORT_DEPTH) {
        pass = null;
        idleTime = 0;
      }
    } else {
      if (context.depth < IDLE_MAX_DEPTH) {
        idleTime += dt;
      }

      const due = idleTime >= Math.max(1, idleDelay);
      // A gesture summon is an explicit request: fire it as soon as the flag is
      // set, without waiting out the idle clock (which dropped any gesture in
      // the first ~1.5s after wake). It is still gated to the same shallow
      // window as the natural appearance, so a gesture never spawns a pass
      // while the scene is already compacting; the `pass` guard above means one
      // summon starts exactly one pass.
      const summoned = summon >= 1 && context.depth < IDLE_MAX_DEPTH;

      if (due || summoned) {
        pass = startPass(width, height, this.tuning.motion);
        flankBloom = 0;
        bloomAdapt = 0;
        idleTime = 0;
      }
    }

    // 4) The glow: eased toward a slow wander — or, during a pass, toward a
    //    point just above the fore-body, so the light catches the silhouette.
    const gr = Math.max(2, glowRadius);
    let targetX: number;
    let targetY: number;

    if (pass) {
      // Aim just ahead of the head: the lead term cancels most of the
      // exponential-chase lag, so the light actually catches the head and
      // the body then streams through the pool for the rest of the pass.
      const headX = pass.startX + pass.dir * pass.speed * pass.t;
      const foreX = headX + (pass.dir * pass.speed * 0.9) / Math.max(0.2, glowChase);
      targetX = Math.min(width - gr * 0.4, Math.max(gr * 0.4, foreX));
      targetY = Math.min(height - 6, Math.max(6, pathY(pass, foreX, time, waveAmp, waveLength, 0) - gr * 0.4));
    } else {
      targetX = width * (0.5 + 0.33 * Math.sin(time * glowDrift * Math.PI * 2 * 0.8));
      targetY = height * (0.45 + 0.28 * Math.sin(time * glowDrift * Math.PI * 2 * 1.27 + 1.7));
    }

    const ease = 1 - Math.exp(-(pass ? glowChase : glowChase * 0.4) * dt);
    glowX += (targetX - glowX) * ease;
    glowY += (targetY - glowY) * ease;

    // The halo breathes; the core holds steady so the level-2 residue (the
    // pooled core is the only thing bright enough to survive bin 4) never
    // blinks out and reads as a bug.
    const breathe = 1 + 0.2 * (glowFlickerNoise(time * 0.5, 3.7) - 0.5);
    const gi = Math.max(0, glowIntensity * breathe);
    const ci = Math.max(0, glowIntensity * coreGain);
    const invR2 = 1 / (gr * gr);
    const coreR = gr * 0.28;
    const coreInvR2 = 1 / (coreR * coreR);
    const gx0 = Math.max(0, Math.floor(glowX - gr));
    const gx1 = Math.min(width - 1, Math.ceil(glowX + gr));
    const gy0 = Math.max(0, Math.floor(glowY - gr));
    const gy1 = Math.min(height - 1, Math.ceil(glowY + gr));

    for (let y = gy0; y <= gy1; y++) {
      const dy = y - glowY;
      const rowBase = y * width;

      for (let x = gx0; x <= gx1; x++) {
        const dx = x - glowX;
        const lift = glowAt(dx * dx + dy * dy, gi, invR2, ci, coreInvR2);

        if (lift <= 0) {
          continue;
        }

        const added = (data[rowBase + x] ?? 0) + lift;
        data[rowBase + x] = added >= 1 ? 1 : added;
      }
    }

    // 5) The shape. Distance field along the spine, then a composite pass:
    //    interior -> silhouette floor (occludes water, snow AND glow); thin
    //    rim -> lifted only by local glow, so the light "catches" it.
    if (pass) {
      sdf.fill(1e9);

      const headX = pass.startX + pass.dir * pass.speed * pass.t;
      const samples = Math.max(24, Math.ceil(pass.bodyLen / 1.2));
      const reach = RIM_WIDTH * (1 + RIM_BLOOM_WIDEN) + 1;
      let yMin = height;
      let yMax = -1;
      let nearestToGlow = 1e9;

      for (let i = 0; i <= samples; i++) {
        const u = i / samples;
        const sx = headX - pass.dir * u * pass.bodyLen;

        if (sx < -8 || sx > width + 8) {
          continue;
        }

        const sy = pathY(pass, sx, time, waveAmp, waveLength, u);
        const r = radiusAt(u, bodyGirth * GIRTH_EFF);
        const gdx = sx - glowX;
        const gdy = sy - glowY;
        const surface = Math.sqrt(gdx * gdx + gdy * gdy) - r;

        if (surface < nearestToGlow) {
          nearestToGlow = surface;
        }

        const cx0 = Math.max(0, Math.floor(sx - r - reach));
        const cx1 = Math.min(width - 1, Math.ceil(sx + r + reach));
        const cy0 = Math.max(0, Math.floor(sy - r - reach));
        const cy1 = Math.min(height - 1, Math.ceil(sy + r + reach));

        if (cy0 < yMin) {
          yMin = cy0;
        }

        if (cy1 > yMax) {
          yMax = cy1;
        }

        for (let y = cy0; y <= cy1; y++) {
          const dy = y - sy;
          const rowBase = y * width;

          for (let x = cx0; x <= cx1; x++) {
            const dx = x - sx;
            const d = Math.sqrt(dx * dx + dy * dy) - r;

            if (d < (sdf[rowBase + x] ?? 1e9)) {
              sdf[rowBase + x] = d;
            }
          }
        }
      }

      // Flank bloom: the rim swells slightly while the body's nearest point
      // passes the light and fades over rimBloomFade after — attack is quick
      // (the light finds the flank), decay lingers a beat behind the mass.
      const bloomRange = gr * BLOOM_RANGE;
      const closeness = bloomRange > 0 ? 1 - Math.max(0, nearestToGlow - BLOOM_DEADBAND) / bloomRange : 0;
      const proximity = closeness > 0 ? closeness * closeness : 0;
      bloomAdapt += (proximity - bloomAdapt) * (1 - Math.exp(-dt / BLOOM_ADAPT_TAU));
      const bloomTarget = Math.max(0, proximity - bloomAdapt);
      const bloomEase =
        bloomTarget > flankBloom ? 1 - Math.exp(-BLOOM_ATTACK * dt) : 1 - Math.exp(-dt / Math.max(0.1, rimBloomFade));
      flankBloom += (bloomTarget - flankBloom) * bloomEase;

      const rimW = RIM_WIDTH * (1 + RIM_BLOOM_WIDEN * flankBloom);
      const rimBoost = rimGain * (1 + rimBloom * flankBloom);

      for (let y = yMin; y <= yMax; y++) {
        const rowBase = y * width;
        const dy = y - glowY;

        for (let x = 0; x < width; x++) {
          const s = sdf[rowBase + x] ?? 1e9;

          if (s >= rimW) {
            continue;
          }

          if (s <= 0) {
            data[rowBase + x] = BODY_FLOOR_EFF;
            continue;
          }

          const dx = x - glowX;
          const local = glowAt(dx * dx + dy * dy, gi, invR2, ci, coreInvR2);

          if (local <= 0) {
            continue;
          }

          const rimT = 1 - s / rimW;
          const lifted = (data[rowBase + x] ?? 0) + rimBoost * local * rimT * rimT;
          data[rowBase + x] = lifted >= 1 ? 1 : lifted;
        }
      }

      // The eye: one cell on the head (u ~ 0.045, where the skull is widest
      // enough to contain it). Gated to the bloom peak: it can only glint in
      // the beat where the flank is lit AND the glow is genuinely close —
      // one missable moment inside an already-rare pass. Some tracks never
      // get close enough; those passes keep the eye dark. That is intended.
      const eyeBack = headX - pass.dir * pass.bodyLen * 0.045;
      const eyeX = Math.round(eyeBack);
      const eyeY = Math.round(pathY(pass, eyeBack, time, waveAmp, waveLength, 0.045) - 1.2);
      eyeLocal = 0;

      if (eyeX >= 0 && eyeX < width && eyeY >= 0 && eyeY < height && (sdf[eyeY * width + eyeX] ?? 1e9) < 0) {
        const dx = eyeX - glowX;
        const dy = eyeY - glowY;
        eyeLocal = glowAt(dx * dx + dy * dy, gi, invR2, ci, coreInvR2);

        if (eyeLocal > 0.05 && flankBloom > 0.35) {
          const glint = 0.35 + eyeLocal * eyeGain;
          const index = eyeY * width + eyeX;
          const current = data[index] ?? 0;
          const value = glint > 0.95 ? 0.95 : glint;
          data[index] = value > current ? value : current;
        }
      }
    } else {
      eyeLocal = 0;
    }
  },
  wake(): void {
    idleTime = 0;
  },
  sleep(): void {
    pass = null;
    flankBloom = 0;
    bloomAdapt = 0;
    eyeLocal = 0;
    idleTime = 0;
  },
};
