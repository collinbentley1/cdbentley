/**
 * Descent content model (WS-C Phase C) — the scene order, per-section layout
 * constants, contact links, and the pure depth mapping. DOM-free so bun test
 * can exercise the wiring; descent.ts does the DOM assembly.
 */

import { scene as airportGateScene } from "../scenes/airport-gate/scene.ts";
import { anglerfishScene } from "../scenes/anglerfish/scene.ts";
import { scene as beachScene } from "../scenes/beach/scene.ts";
import { scene as classroomScene } from "../scenes/classroom/scene.ts";
import { scene as corridorScene } from "../scenes/corridor/scene.ts";
import { deepShapeScene } from "../scenes/deep-shape/scene.ts";
import { scene as kitchenTableScene } from "../scenes/kitchen-table/scene.ts";
import { scene as oceanFloorScene } from "../scenes/ocean-floor/scene.ts";
import { stageScene } from "../scenes/stage/scene.ts";
import { subwayPlatformScene } from "../scenes/subway-platform/scene.ts";
import { tradingFloorScene } from "../scenes/trading-floor/scene.ts";
import type { SceneModule } from "../sdk/index.ts";

export interface DescentSection {
  scene: SceneModule;
  /** Section height in viewport-heights (scroll room the scene owns). */
  heightVh: number;
  /** Scenes 1-8 dock to the shelf; the deep register does not. */
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
 * Scene order, strictly resume-chronological: beach (opening), Yale stage,
 * Beijing classroom, Humana corridor, Healthyr kitchen table, OTseek trading
 * floor, OTseek airport gate, subway platform (now), then the deep register
 * (anglerfish, the unnamed deep shape) between the subway and the ocean
 * floor. Beach at 150vh puts bin-2 (depth 0.35) ~0.85 viewports past the
 * fold and the dock collapse before two full scrolls — first compaction
 * inside two scrolls, checked in descent.test.ts.
 */
export const SECTIONS: readonly DescentSection[] = [
  { heightVh: 150, label: "Collin Bentley", scene: beachScene, shelfSlot: 0 },
  { heightVh: 180, label: "Stage", scene: stageScene, shelfSlot: 1 },
  { heightVh: 180, label: "Classroom", scene: classroomScene, shelfSlot: 2 },
  { heightVh: 180, label: "Corridor", scene: corridorScene, shelfSlot: 3 },
  { heightVh: 180, label: "Kitchen table", scene: kitchenTableScene, shelfSlot: 4 },
  { heightVh: 180, label: "Trading floor", scene: tradingFloorScene, shelfSlot: 5 },
  { heightVh: 190, label: "Airport gate", scene: airportGateScene, shelfSlot: 6 },
  { heightVh: 190, label: "Subway platform", scene: subwayPlatformScene, shelfSlot: 7 },
  { heightVh: 150, label: "The deep", scene: anglerfishScene, shelfSlot: null },
  { heightVh: 170, label: "Deeper", scene: deepShapeScene, shelfSlot: null },
  { heightVh: 102, label: "Ocean floor", scene: oceanFloorScene, shelfSlot: 8 },
];

/** The nine shelf-docking sections, in slot order. */
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

/**
 * Contact links — filled from the WS-A patch branch (the verified set:
 * `git -C ../ws-a-patch show HEAD:public/index.html`), per the integration
 * order. LinkedIn answers 999 to curl (bot wall) — verified by WS-A via the
 * PR preview; kept as WS-A shipped it.
 */
export interface DescentContactLink {
  href: string;
  label: string;
}

export const DESCENT_CONTACT_LINKS: readonly DescentContactLink[] = [
  { href: "mailto:collin.bentley@me.com", label: "Email" },
  { href: "https://github.com/collinbentley1", label: "GitHub" },
  { href: "https://www.linkedin.com/in/collinbentley", label: "LinkedIn" },
  { href: "/resume.pdf", label: "Resume" },
];

/** Scroll-velocity -> turbulence coupling (subtle; discovered, not announced). */
export const TURBULENCE = {
  /** Exponential smoothing time constant for the velocity signal, seconds. */
  tau: 0.35,
  /** Viewport-heights/second of scroll that saturates turbulence at 1. */
  vhPerSecAtMax: 3.5,
} as const;
