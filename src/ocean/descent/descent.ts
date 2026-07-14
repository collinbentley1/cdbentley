/**
 * The descent (WS-C Phase C integrator) — assembles "The Ocean Remembers":
 * scenes 1-8 in order with the deep register between subway and floor, the
 * always-on ocean field, the memory-line depth mapping (pure, bidirectional),
 * scroll-velocity -> turbulence coupling, the shelf, provenance packets, and
 * a reduced-motion path that keeps the same document and spatial context.
 *
 * Grammar: depth = viewport-heights past the memory line (FROZEN unit).
 * Everything resolution-related is a pure function of scroll position; the
 * only damping is the SDK's smoothDetail inside each runner.
 */

import { bindSleepWake, createGlyphRenderer, createSceneRunner, resolutionForDepth, type Rect, type SceneRunner } from "../sdk/index.ts";
import { createBridgeLayer } from "../scenes/beach/bridge-layer.ts";
import { depthForSectionTop, SECTIONS, TURBULENCE } from "./content.ts";
import { createOceanField } from "./field.ts";
import { bindProvenancePackets } from "./provenance.ts";
import { createShelf } from "./shelf.ts";

interface BenchStats {
  avgCpuMs: number;
  avgFps: number;
  avgFrameMs: number;
  frames: number;
  frameOver17msPct: number;
  p95CpuMs: number;
  p95FrameMs: number;
  seconds: number;
}

declare global {
  interface Window {
    __oceanBench?: { ready: boolean; run(seconds?: number): Promise<BenchStats> };
  }
}

interface MountedScene {
  canvas: HTMLCanvasElement;
  lastReducedDepth: number;
  runner: SceneRunner;
  section: HTMLElement;
  slot: number | null;
  stage: HTMLElement;
}

const params = new URLSearchParams(location.search);
const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const shelfNav = document.getElementById("shelf");
const fieldCanvas = document.getElementById("ocean-field");
const bridgeCue = document.querySelector<HTMLElement>(".bridge-cue");
const bridgeCanvas = bridgeCue?.querySelector<HTMLCanvasElement>(".bridge-canvas") ?? null;
const bridgeLayer = bridgeCanvas ? createBridgeLayer(bridgeCanvas) : null;

// Paint immediately so reduced-motion and a briefly paused first frame both
// retain the bridge cue. Normal motion is driven by the shared frame below.
bridgeLayer?.draw(0);

// --- Mount every scene against its static section ------------------------
// Staggered one-per-frame so page load never queues 10 renderer+atlas+init
// tasks in one long block (TBT): the beach mounts in the first task, the
// rest arrive over the next few frames, well before they can scroll on.

const mounted: MountedScene[] = [];
let deepShape: MountedScene | null = null;

function summonDeepShape(): void {
  if (!deepShape || prefersReduced) {
    return;
  }

  deepShape.runner.scene.tuning.motion["summon"] = 1;
  const target = deepShape;
  window.setTimeout(() => {
    target.runner.scene.tuning.motion["summon"] = 0;
  }, 120);
}

function mountSection(entry: (typeof SECTIONS)[number]): void {
  const section = document.querySelector<HTMLElement>(`section[data-scene="${entry.scene.id}"]`);
  const stage = section?.querySelector<HTMLElement>(".scene-stage") ?? null;
  const box = section?.querySelector<HTMLElement>(".canvas-box") ?? null;

  if (!section || !stage || !box) {
    console.error(`descent: missing section markup for ${entry.scene.id}`);
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.className = "scene-canvas";
  canvas.setAttribute("aria-hidden", "true");
  box.prepend(canvas);

  const { cols, rows } = entry.scene.tuning;
  const cellW = entry.scene.tuning.cellW ?? 8;
  const cellH = entry.scene.tuning.cellH ?? 8;
  const renderer = createGlyphRenderer(canvas, { cellH, cellW, cols, rows });
  // Responsive: CSS-scale the fixed grid down on narrow viewports.
  canvas.style.maxWidth = `min(96vw, ${cols * cellW}px)`;
  canvas.style.height = "auto";
  canvas.style.aspectRatio = `${cols * cellW} / ${rows * cellH}`;

  const runner = createSceneRunner(entry.scene, renderer, {
    onFrame(info) {
      benchCpuAccum += info.cpuMs;
    },
  });

  // Animated scenes sleep offscreen. Reduced-motion visitors keep the same
  // ocean layout, but each scene is rendered only when scroll changes depth.
  if (prefersReduced) {
    runner.step(0);
  } else {
    bindSleepWake(runner, stage);
  }

  const mount: MountedScene = { canvas, lastReducedDepth: Number.NaN, runner, section, slot: entry.shelfSlot, stage };
  mounted.push(mount);

  if (entry.scene.id === "beach") {
    // The beach contact block is real DOM (never washed, never compacted) —
    // the in-buffer placeholder marker goes off now that the DOM overlays it.
    runner.scene.tuning.motion["contactMarker"] = 0;
  }

  if (entry.scene.id === "deep-shape") {
    // The deep register's discoverable gesture: double-click (or the ~ key
    // while it is on screen) summons one pass. Never named; motion.summon is
    // the hook.
    deepShape = mount;
    stage.addEventListener("dblclick", summonDeepShape);
  }
}

// Section heights land in ONE style pass before first paint (zero CLS from
// the staggered mounts below); the mode class comes with them.
for (const entry of SECTIONS) {
  document.querySelector<HTMLElement>(`section[data-scene="${entry.scene.id}"]`)?.style.setProperty("--section-h", `${entry.heightVh}vh`);
}

document.body.classList.add("ocean");
document.body.classList.toggle("reduced-motion", prefersReduced);

const mountQueue = [...SECTIONS];

function mountNext(): void {
  const entry = mountQueue.shift();

  if (!entry) {
    return;
  }

  mountSection(entry);
  requestAnimationFrame(mountNext);
}

mountNext();
document.addEventListener("keydown", (event) => {
  if (event.key === "~" && deepShape) {
    const rect = deepShape.section.getBoundingClientRect();

    if (rect.top < window.innerHeight && rect.bottom > 0) {
      summonDeepShape();
    }
  }
});

// --- Shelf ----------------------------------------------------------------

const shelfSections = SECTIONS.filter((section) => section.shelfSlot !== null).sort((a, b) => (a.shelfSlot ?? 0) - (b.shelfSlot ?? 0));

const shelf = shelfNav
  ? createShelf(shelfNav, shelfSections, {
      onNavigate(slot) {
        const entry = shelfSections[slot];
        const target = entry ? mounted.find((m) => m.runner.scene.id === entry.scene.id) : undefined;
        target?.section.scrollIntoView({ behavior: prefersReduced ? "auto" : "smooth", block: "start" });
      },
    })
  : null;

// --- Ocean field (the only always-on sim) ---------------------------------

const field = fieldCanvas instanceof HTMLCanvasElement ? createOceanField(fieldCanvas) : null;

function resizeField(): void {
  field?.resize(window.innerWidth, window.innerHeight);

  if (prefersReduced) {
    field?.step(0, 0);
  }
}

resizeField();
window.addEventListener("resize", resizeField);

// --- Provenance packets ----------------------------------------------------

bindProvenancePackets(document, () => !prefersReduced);

// --- Frame driver: scroll -> depth -> compaction/dock/turbulence -----------

let benchCpuAccum = 0;
let lastScrollY = window.scrollY;
let lastNow = performance.now();
let turbulence = 0;

interface BenchState {
  cpu: number[];
  deltas: number[];
  endY: number;
  lastStamp: number;
  resolve: (stats: BenchStats) => void;
  startedAt: number;
  totalSeconds: number;
  warmupSeconds: number;
}

let bench: BenchState | null = null;

function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
}

function driveBench(now: number): void {
  if (!bench) {
    return;
  }

  const elapsed = (now - bench.startedAt) / 1000;

  // Scripted full-run: top -> bottom over the first half, back up over the
  // second (the round trip exercises compaction in BOTH directions).
  const travel = Math.min(1, Math.max(0, (elapsed - bench.warmupSeconds) / (bench.totalSeconds - bench.warmupSeconds)));
  const phase = travel < 0.5 ? travel * 2 : 2 - travel * 2;
  window.scrollTo(0, bench.endY * phase);

  if (elapsed > bench.warmupSeconds) {
    bench.deltas.push(now - bench.lastStamp);
    bench.cpu.push(benchCpuAccum);
  }

  bench.lastStamp = now;
  benchCpuAccum = 0;

  if (elapsed >= bench.totalSeconds) {
    const { cpu, deltas } = bench;
    const seconds = deltas.reduce((a, b) => a + b, 0) / 1000;
    const stats: BenchStats = {
      avgCpuMs: cpu.reduce((a, b) => a + b, 0) / Math.max(1, cpu.length),
      avgFps: deltas.length / Math.max(0.001, seconds),
      avgFrameMs: (seconds * 1000) / Math.max(1, deltas.length),
      frameOver17msPct: (deltas.filter((d) => d > 17).length / Math.max(1, deltas.length)) * 100,
      frames: deltas.length,
      p95CpuMs: percentile(cpu, 0.95),
      p95FrameMs: percentile(deltas, 0.95),
      seconds,
    };
    bench.resolve(stats);
    bench = null;
  }
}

function frame(now: number): void {
  const dt = Math.min(0.1, Math.max(0.0001, (now - lastNow) / 1000));
  lastNow = now;

  const vh = Math.max(1, window.innerHeight);
  const scrolled = Math.abs(window.scrollY - lastScrollY) / vh / dt;
  lastScrollY = window.scrollY;
  const target = Math.min(1, scrolled / TURBULENCE.vhPerSecAtMax);
  turbulence += (target - turbulence) * (1 - Math.exp(-dt / TURBULENCE.tau));

  if (field && !prefersReduced) {
    benchCpuAccum += field.step(dt, turbulence);
  }

  if (bridgeLayer && bridgeCue && !prefersReduced) {
    const bridgeRect = bridgeCue.getBoundingClientRect();

    if (bridgeRect.top < vh && bridgeRect.bottom > 0) {
      benchCpuAccum += bridgeLayer.draw(now / 1000);
    }
  }

  for (const m of mounted) {
    const rect = m.section.getBoundingClientRect();
    const depth = depthForSectionTop(rect.top, vh);
    m.runner.setDepth(depth);

    if (prefersReduced && Math.abs(depth - m.lastReducedDepth) >= 0.005) {
      m.runner.step(0);
      m.lastReducedDepth = depth;
    }

    const resolution = resolutionForDepth(depth, m.runner.scene.tuning.resolution ?? {});
    m.canvas.style.opacity = (1 - resolution.collapse).toFixed(3);

    if (m.slot !== null && shelf) {
      const c = m.canvas.getBoundingClientRect();
      const rectPx: Rect = { h: c.height, w: c.width, x: c.x, y: c.y };
      const shelfCollapse = prefersReduced ? (resolution.collapse >= 0.98 ? 1 : 0) : resolution.collapse;
      const visited = rect.top <= 0 && rect.bottom > 0;
      shelf.update(m.slot, shelfCollapse, rectPx, visited);
    }
  }

  driveBench(now);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

// --- Bench hook (?bench=1) — the Phase A method, full-run edition ----------

if (params.has("bench")) {
  window.__oceanBench = {
    ready: true,
    run(seconds = 26): Promise<BenchStats> {
      return new Promise<BenchStats>((resolve) => {
        const doc = document.documentElement;
        bench = {
          cpu: [],
          deltas: [],
          endY: Math.max(0, doc.scrollHeight - window.innerHeight),
          lastStamp: performance.now(),
          resolve,
          startedAt: performance.now(),
          totalSeconds: seconds,
          warmupSeconds: 2,
        };
      });
    },
  };
}
