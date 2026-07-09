/**
 * The shelf (WS-C Phase C) — persistent compressed memory of the descent,
 * doubling as nav. Eight slots; each scene's ~12x6 dock glyph drifts here
 * along the SDK's spring-on-bezier path as its section collapses, and
 * re-blooms back along the SAME path on scroll-up/restore (the dock path is
 * sampled purely from collapse, so it is bidirectional by construction).
 *
 * Hover/focus a slot = one-line summary chip (TODO(collin) placeholders
 * tonight). Click = restore (scroll returns; re-bloom is the pure depth
 * function). "restore full context" surfaces to the top, re-blooming every
 * scene on the way. Docked state persists in sessionStorage.
 */

import { createDockAnimation, DOCK_GLYPH_COLS, type Rect } from "../sdk/index.ts";
import type { DescentSection } from "./content.ts";

const STORAGE_KEY = "ocean.shelf.docked";

export interface Shelf {
  /**
   * Drive slot `slot` from the scene's collapse (0..1) and its canvas rect
   * in viewport px. Handles the traveling glyph, slot fill, and storage.
   */
  update(slot: number, collapse: number, canvasRect: Rect): void;
  /** Docked flags (for tests/state checks). */
  readonly docked: readonly boolean[];
}

export interface ShelfCallbacks {
  onRestore(slot: number): void;
  onRestoreAll(): void;
}

function loadDocked(count: number): boolean[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    const flags = new Array<boolean>(count).fill(false);

    if (Array.isArray(parsed)) {
      for (const index of parsed) {
        if (typeof index === "number" && index >= 0 && index < count) {
          flags[index] = true;
        }
      }
    }

    return flags;
  } catch {
    return new Array<boolean>(count).fill(false);
  }
}

function saveDocked(flags: readonly boolean[]): void {
  try {
    const docked = flags.flatMap((flag, index) => (flag ? [index] : []));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(docked));
  } catch {
    // sessionStorage unavailable (private mode etc.) — shelf still works.
  }
}

export function createShelf(nav: HTMLElement, sections: readonly DescentSection[], callbacks: ShelfCallbacks): Shelf {
  // The static <ul> stays for no-JS/plain nav; CSS swaps which list shows.
  const list = document.createElement("ol");
  list.className = "shelf-slots";
  nav.append(list);

  const docked = loadDocked(sections.length);
  const slotPres: HTMLPreElement[] = [];
  const slotButtons: HTMLButtonElement[] = [];
  const travelers: HTMLPreElement[] = [];
  const baseWidths: Array<number | undefined> = [];

  const emptyGlyph = Array.from({ length: 6 }, () => "·".padStart(Math.ceil(DOCK_GLYPH_COLS / 2)).padEnd(DOCK_GLYPH_COLS)).join("\n");

  sections.forEach((section, slot) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shelf-slot";
    button.dataset["slot"] = String(slot);
    button.setAttribute("aria-label", `${section.label} — restore full scene`);

    const pre = document.createElement("pre");
    pre.setAttribute("aria-hidden", "true");
    pre.textContent = docked[slot] ? section.scene.dockGlyph.join("\n") : emptyGlyph;
    pre.className = docked[slot] ? "shelf-glyph is-docked" : "shelf-glyph";
    button.append(pre);

    const chip = document.createElement("span");
    chip.className = "shelf-chip";
    chip.setAttribute("role", "tooltip");
    chip.id = `shelf-chip-${slot}`;
    chip.textContent = section.scene.summaryChip ?? `TODO(collin): ${section.scene.id} summary line`;
    button.setAttribute("aria-describedby", chip.id);
    button.append(chip);

    button.addEventListener("click", () => {
      callbacks.onRestore(slot);
    });

    item.append(button);
    list.append(item);
    slotPres.push(pre);
    slotButtons.push(button);

    const traveler = document.createElement("pre");
    traveler.className = "dock-traveler";
    traveler.setAttribute("aria-hidden", "true");
    traveler.textContent = section.scene.dockGlyph.join("\n");
    traveler.style.display = "none";
    document.body.append(traveler);
    travelers.push(traveler);
  });

  const restoreAll = document.createElement("button");
  restoreAll.type = "button";
  restoreAll.className = "shelf-restore-all";
  restoreAll.textContent = "restore full context";
  restoreAll.addEventListener("click", () => {
    callbacks.onRestoreAll();
  });
  nav.append(restoreAll);

  const setDocked = (slot: number, value: boolean): void => {
    if (docked[slot] === value) {
      return;
    }

    docked[slot] = value;
    const pre = slotPres[slot];
    const section = sections[slot];

    if (pre && section) {
      pre.textContent = value ? section.scene.dockGlyph.join("\n") : emptyGlyph;
      pre.className = value ? "shelf-glyph is-docked" : "shelf-glyph";
    }

    saveDocked(docked);
  };

  return {
    get docked(): readonly boolean[] {
      return docked;
    },
    update(slot: number, collapse: number, canvasRect: Rect): void {
      const traveler = travelers[slot];
      const button = slotButtons[slot];

      if (!traveler || !button) {
        return;
      }

      if (collapse <= 0) {
        traveler.style.display = "none";
        setDocked(slot, false);
        return;
      }

      if (collapse >= 1) {
        traveler.style.display = "none";
        setDocked(slot, true);
        return;
      }

      // Mid-flight: sample the SAME bezier path purely from collapse, both
      // directions (dock on the way down, re-bloom on the way up).
      setDocked(slot, false);
      const slotRect = button.getBoundingClientRect();
      const to: Rect = { h: slotRect.height, w: slotRect.width, x: slotRect.x, y: slotRect.y };
      const frame = createDockAnimation(canvasRect, to).frameAt(collapse);
      let baseW = baseWidths[slot];

      if (baseW === undefined || baseW <= 0) {
        traveler.style.display = "block";
        traveler.style.transform = "none";
        baseW = traveler.getBoundingClientRect().width;
        baseWidths[slot] = baseW;
      }

      traveler.style.display = "block";
      const sx = baseW > 0 ? frame.w / baseW : 1;
      traveler.style.transform = `translate(${frame.x.toFixed(1)}px, ${frame.y.toFixed(1)}px) scale(${sx.toFixed(4)})`;
      traveler.style.opacity = Math.min(1, collapse * 1.4).toFixed(3);
    },
  };
}
