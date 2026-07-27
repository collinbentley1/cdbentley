/**
 * Descent content model (WS-C Phase C) — the scene order, per-section layout
 * constants, and the pure depth mapping. DOM-free so bun test can exercise
 * the wiring; descent.ts does the DOM assembly.
 */

import { scene as airportGateScene } from "../scenes/airport-gate/scene.ts";
import { anglerfishScene } from "../scenes/anglerfish/scene.ts";
import { scene as beachScene } from "../scenes/beach/scene.ts";
import { scene as classroomScene } from "../scenes/classroom/scene.ts";
import { scene as corridorScene } from "../scenes/corridor/scene.ts";
import { scene as kitchenTableScene } from "../scenes/kitchen-table/scene.ts";
import { stageScene } from "../scenes/stage/scene.ts";
import { subwayPlatformScene } from "../scenes/subway-platform/scene.ts";
import { tradingFloorScene } from "../scenes/trading-floor/scene.ts";
import type { SceneModule } from "../sdk/index.ts";

export interface DescentSection {
  scene: SceneModule;
  /** Section height in viewport-heights (scroll room the scene owns). */
  heightVh: number;
  /** The seven chapters dock to the shelf; the deep register does not. */
  shelfSlot: number | null;
  /** Accessible label for nav + headings (mechanical place name, not copy). */
  label: string;
}

/**
 * The memory line, in viewport-heights: a scene starts forgetting once the
 * visitor has scrolled this far past its opening. depth stays the FROZEN SDK
 * unit (viewport-heights past the memory line), purely a function of scroll.
 */
export const MEMORY_LINE_VH = 0.5;

/**
 * Scene order: the beach hero opens (the name in the sand — no chapter, no
 * shelf slot, no prose), then seven strictly chronological chapters from the
 * Yale stage (2016-2019) through the Beijing classroom, Humana corridor,
 * Healthyr kitchen table, OTseek trading floor, OTseek airport gate, and the
 * subway platform (2026, now), then the deep register (anglerfish) closing
 * the descent. Chapters are labeled by their years; the hero and the deep
 * register stay out of the nav and never dock.
 */
export const SECTIONS: readonly DescentSection[] = [
  { heightVh: 150, label: "Collin Bentley", scene: beachScene, shelfSlot: null },
  { heightVh: 180, label: "2016-2019", scene: stageScene, shelfSlot: 0 },
  { heightVh: 180, label: "2019-2020", scene: classroomScene, shelfSlot: 1 },
  { heightVh: 180, label: "2020-2024", scene: corridorScene, shelfSlot: 2 },
  { heightVh: 180, label: "2024-2025", scene: kitchenTableScene, shelfSlot: 3 },
  { heightVh: 180, label: "2025", scene: tradingFloorScene, shelfSlot: 4 },
  { heightVh: 190, label: "2026", scene: airportGateScene, shelfSlot: 5 },
  { heightVh: 190, label: "2026", scene: subwayPlatformScene, shelfSlot: 6 },
  { heightVh: 150, label: "The deep", scene: anglerfishScene, shelfSlot: null },
];

/** The seven shelf-docking sections, in slot order. */
export const SHELF_SECTIONS: readonly DescentSection[] = [...SECTIONS]
  .filter((section) => section.shelfSlot !== null)
  .sort((a, b) => (a.shelfSlot ?? 0) - (b.shelfSlot ?? 0));

/**
 * Depth past the memory line for a section whose bounding rect starts at
 * `topPx` (viewport coords, px). Pure and bidirectional by construction —
 * the SDK's resolutionForDepth does the rest.
 */
export function depthForSectionTop(topPx: number, viewportPx: number): number {
  if (viewportPx <= 0) {
    return 0;
  }

  return -topPx / viewportPx - MEMORY_LINE_VH;
}

/** Scroll-velocity -> turbulence coupling (subtle; discovered, not announced). */
export const TURBULENCE = {
  /** Exponential smoothing time constant for the velocity signal, seconds. */
  tau: 0.35,
  /** Viewport-heights/second of scroll that saturates turbulence at 1. */
  vhPerSecAtMax: 3.5,
} as const;
