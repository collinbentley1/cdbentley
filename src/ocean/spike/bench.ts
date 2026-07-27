/**
 * In-page benchmark harness shared by the two spike pages.
 *
 * The page animates continuously for eyeballing; tools/bench-renderers.ts
 * calls window.__bench.run(frames, warmup) which measures, per rAF frame:
 *   - cpuMs: performance.now() around the frame callback (sim + render
 *     submission; GPU-side time is NOT captured — noted in the report)
 *   - frameMs: delta between consecutive rAF timestamps
 * Warmup frames are discarded. Statistics are computed here and returned.
 */

export interface BenchStats {
  frames: number;
  seconds: number;
  avgFps: number;
  avgFrameMs: number;
  p95FrameMs: number;
  avgCpuMs: number;
  p50CpuMs: number;
  p95CpuMs: number;
  maxCpuMs: number;
  cpuOver8msPct: number;
  frameOver17msPct: number;
  info: string;
}

type FrameFn = (dt: number, time: number) => void;

declare global {
  interface Window {
    __bench: {
      run(frames?: number, warmup?: number): Promise<BenchStats>;
      ready: boolean;
    };
  }
}

export function installBench(frame: FrameFn, info: () => string): void {
  let time = 0;
  let lastTimestamp = -1;
  let measuring: {
    warmupLeft: number;
    left: number;
    cpu: number[];
    frameDeltas: number[];
    resolve: (stats: BenchStats) => void;
  } | null = null;

  const loop = (timestamp: number): void => {
    const dt = lastTimestamp < 0 ? 1 / 60 : Math.min(0.1, (timestamp - lastTimestamp) / 1000);
    const frameDelta = lastTimestamp < 0 ? Number.NaN : timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    time += dt;

    const started = performance.now();
    frame(dt, time);
    const cpuMs = performance.now() - started;

    if (measuring) {
      if (measuring.warmupLeft > 0) {
        measuring.warmupLeft--;
      } else if (measuring.left > 0) {
        measuring.cpu.push(cpuMs);

        if (Number.isFinite(frameDelta)) {
          measuring.frameDeltas.push(frameDelta);
        }

        measuring.left--;

        if (measuring.left === 0) {
          measuring.resolve(summarize(measuring.cpu, measuring.frameDeltas, info()));
          measuring = null;
        }
      }
    }

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);

  window.__bench = {
    ready: true,
    run(frames = 600, warmup = 90): Promise<BenchStats> {
      return new Promise((resolve) => {
        measuring = { cpu: [], frameDeltas: [], left: frames, resolve, warmupLeft: warmup };
      });
    },
  };
}

function summarize(cpu: number[], frameDeltas: number[], info: string): BenchStats {
  const seconds = frameDeltas.reduce((sum, v) => sum + v, 0) / 1000;
  const avg = (values: number[]): number => (values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);
  const pct = (values: number[], p: number): number => {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))] ?? 0;
  };

  return {
    avgCpuMs: avg(cpu),
    avgFps: seconds > 0 ? frameDeltas.length / seconds : 0,
    avgFrameMs: avg(frameDeltas),
    cpuOver8msPct: cpu.length > 0 ? (100 * cpu.filter((v) => v > 8).length) / cpu.length : 0,
    frameOver17msPct: frameDeltas.length > 0 ? (100 * frameDeltas.filter((v) => v > 17).length) / frameDeltas.length : 0,
    frames: cpu.length,
    info,
    maxCpuMs: cpu.length > 0 ? Math.max(...cpu) : 0,
    p50CpuMs: pct(cpu, 50),
    p95CpuMs: pct(cpu, 95),
    p95FrameMs: pct(frameDeltas, 95),
    seconds,
  };
}
