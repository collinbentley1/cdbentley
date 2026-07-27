/**
 * Depth-driven bidirectional resolution — THE compaction contract.
 *
 * Resolution is a PURE function of depth-past-the-memory-line. There is no
 * trigger, no stored state, no hysteresis: scrolling down coarsens, scrolling
 * up re-blooms along the exact same path, because both directions evaluate
 * the same function at the same depth.
 *
 * FROZEN UNIT: `depth` is measured in viewport-heights past the memory line.
 * depth <= 0 means the scene has not crossed the line (full resolution);
 * depth grows as the scene scrolls further past it.
 *
 * Damping: the discrete bin / rampLevel switch instantly with depth (no
 * hysteresis, by design). The only damping in the system is `smoothDetail`,
 * a tiny exponential smoother scenes and the renderer may apply to the
 * continuous `detail` scalar (e.g. to fade motion amplitude). Keep tau small.
 */

export interface ResolutionConfig {
  /** Depths at which grid binning becomes 2 then 4. Ascending, > 0. */
  readonly binDepths: readonly [number, number];
  /** Depths at which ramp simplification reaches level 1 then level 2. */
  readonly rampDepths: readonly [number, number];
  /** Depths across which the scene collapses toward its dock glyph (start, end). */
  readonly collapseDepths: readonly [number, number];
  /** Time constant (seconds) for smoothDetail. Tiny by decree. */
  readonly dampingTau: number;
}

export const DEFAULT_RESOLUTION: ResolutionConfig = {
  binDepths: [0.35, 0.85],
  collapseDepths: [1.0, 1.5],
  dampingTau: 0.12,
  rampDepths: [0.5, 1.05],
};

export interface Resolution {
  /** Continuous 1 -> 0 as the scene forgets itself. 1 at depth <= 0. */
  readonly detail: number;
  /** Grid coarsening stride: 1 -> 2 -> 4. */
  readonly bin: 1 | 2 | 4;
  /** Ramp simplification level (see simplifyRamp). */
  readonly rampLevel: 0 | 1 | 2;
  /** 0 before collapse starts, 1 when fully docked as the ~12x6 glyph. */
  readonly collapse: number;
}

export function resolutionForDepth(depth: number, config: Partial<ResolutionConfig> = {}): Resolution {
  const cfg: ResolutionConfig = { ...DEFAULT_RESOLUTION, ...config };
  validateResolutionConfig(cfg);

  const collapseEnd = cfg.collapseDepths[1];
  const detail = depth <= 0 ? 1 : depth >= collapseEnd ? 0 : 1 - depth / collapseEnd;
  const bin: 1 | 2 | 4 = depth < cfg.binDepths[0] ? 1 : depth < cfg.binDepths[1] ? 2 : 4;
  const rampLevel: 0 | 1 | 2 = depth < cfg.rampDepths[0] ? 0 : depth < cfg.rampDepths[1] ? 1 : 2;
  const collapseStart = cfg.collapseDepths[0];
  const collapse =
    depth <= collapseStart ? 0 : depth >= collapseEnd ? 1 : (depth - collapseStart) / (collapseEnd - collapseStart);

  return { bin, collapse, detail, rampLevel };
}

/**
 * Exponential approach of `current` toward `target`. Frame-rate independent.
 * The ONLY sanctioned damping; tau defaults to DEFAULT_RESOLUTION.dampingTau.
 */
export function smoothDetail(current: number, target: number, dt: number, tau = DEFAULT_RESOLUTION.dampingTau): number {
  if (tau <= 0 || dt <= 0) {
    return target;
  }

  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

export function validateResolutionConfig(cfg: ResolutionConfig): void {
  const ascending = (pair: readonly [number, number]): boolean => pair[0] > 0 && pair[1] > pair[0];

  if (!ascending(cfg.binDepths) || !ascending(cfg.rampDepths) || !ascending(cfg.collapseDepths)) {
    throw new Error("ResolutionConfig: binDepths, rampDepths and collapseDepths must each be ascending and > 0");
  }

  if (cfg.dampingTau < 0) {
    throw new Error("ResolutionConfig: dampingTau must be >= 0");
  }
}
