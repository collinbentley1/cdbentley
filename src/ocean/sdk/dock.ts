/**
 * Shelf docking/restore — spring-on-bezier drift.
 *
 * The scene's residue (a ~12x6 glyph) travels from its scene rect to its
 * shelf slot along a fixed cubic bezier; a spring integrates a scalar
 * progress along that path. reverse() retargets the SAME spring to the
 * opposite end, so restore replays the exact path backward (the fluid-
 * interfaces rule: things return the way they left).
 *
 * Pure math, no DOM: callers position whatever element/canvas they like
 * from the returned frames.
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DockFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Path parameter actually used this frame, clamped to [0, 1]. */
  progress: number;
}

export interface DockOptions {
  /** Spring stiffness (1/s^2). Default 110. */
  stiffness?: number;
  /** Spring damping (1/s). Default 21 (near-critical, no visible overshoot). */
  damping?: number;
  /** Sideways bow of the bezier as a fraction of travel distance. Default 0.3. */
  bow?: number;
}

export interface DockAnimation {
  /** Integrate dt seconds and return the current frame. */
  step(dt: number): DockFrame;
  /** Sample the path at an arbitrary progress (pure; ignores spring state). */
  frameAt(progress: number): DockFrame;
  /** Retarget toward the opposite end along the same path. */
  reverse(): void;
  readonly progress: number;
  /** 1 = drifting toward the shelf (dock), -1 = restoring. */
  readonly direction: 1 | -1;
  readonly settled: boolean;
}

export function createDockAnimation(from: Rect, to: Rect, options: DockOptions = {}): DockAnimation {
  const stiffness = options.stiffness ?? 110;
  const damping = options.damping ?? 21;
  const bow = options.bow ?? 0.3;

  const p0x = from.x + from.w / 2;
  const p0y = from.y + from.h / 2;
  const p3x = to.x + to.w / 2;
  const p3y = to.y + to.h / 2;
  const dx = p3x - p0x;
  const dy = p3y - p0y;
  const dist = Math.hypot(dx, dy);
  const nx = dist > 0 ? -dy / dist : 0;
  const ny = dist > 0 ? dx / dist : 0;
  const p1x = p0x + dx * 0.25 + nx * bow * dist;
  const p1y = p0y + dy * 0.25 + ny * bow * dist;
  const p2x = p0x + dx * 0.75 + nx * bow * dist * 0.5;
  const p2y = p0y + dy * 0.75 + ny * bow * dist * 0.5;

  let s = 0;
  let velocity = 0;
  let target = 1;

  const frameAt = (progress: number): DockFrame => {
    const t = progress <= 0 ? 0 : progress >= 1 ? 1 : progress;
    const u = 1 - t;
    const cx = u * u * u * p0x + 3 * u * u * t * p1x + 3 * u * t * t * p2x + t * t * t * p3x;
    const cy = u * u * u * p0y + 3 * u * u * t * p1y + 3 * u * t * t * p2y + t * t * t * p3y;
    const ease = t * t * (3 - 2 * t);
    const w = from.w + (to.w - from.w) * ease;
    const h = from.h + (to.h - from.h) * ease;

    return { h, progress: t, w, x: cx - w / 2, y: cy - h / 2 };
  };

  return {
    get direction(): 1 | -1 {
      return target === 1 ? 1 : -1;
    },
    frameAt,
    get progress(): number {
      return s;
    },
    reverse(): void {
      target = target === 1 ? 0 : 1;
    },
    get settled(): boolean {
      return Math.abs(target - s) < 0.001 && Math.abs(velocity) < 0.001;
    },
    step(dt: number): DockFrame {
      // Semi-implicit Euler in <= 8ms substeps for stability.
      let remaining = Math.max(0, dt);

      while (remaining > 0) {
        const h = Math.min(remaining, 0.008);
        velocity += (stiffness * (target - s) - damping * velocity) * h;
        s += velocity * h;
        remaining -= h;
      }

      if (Math.abs(target - s) < 0.001 && Math.abs(velocity) < 0.001) {
        s = target;
        velocity = 0;
      }

      return frameAt(s);
    },
  };
}
