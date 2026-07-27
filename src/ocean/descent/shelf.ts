/**
 * The shelf (WS-C Phase C) — persistent compressed memory of the descent,
 * doubling as nav. Seven slots; each scene's ~12x6 dock glyph drifts here
 * along the SDK's spring-on-bezier path as its section collapses. Once a
 * frame reaches the shelf it stays collected for the lifetime of this page
 * load, even when the visitor scrolls back up.
 *
 * Hover/focus a slot = one-line summary chip. Click = navigate. Collected
 * state is deliberately runtime memory only: reload starts fresh; no
 * browser storage, cookie, or session is used.
 * The first slot is the only slot visible at load; once it docks, the
 * remaining empty slots reveal left-to-right so the shelf reads as earned
 * progress instead of chrome.
 */

import { createDockAnimation, DOCK_GLYPH_COLS, type Rect } from "../sdk/index.ts";
import type { DescentSection } from "./content.ts";

export interface Shelf {
  /**
   * Drive slot `slot` from the scene's collapse (0..1) and its canvas rect
   * in viewport px. Handles the traveling glyph and one-load collection.
   */
  update(slot: number, collapse: number, canvasRect: Rect, visited: boolean): void;
  /** Collected flags (named docked for the frozen integration surface). */
  readonly docked: readonly boolean[];
}

export interface ShelfCallbacks {
  onNavigate(slot: number): void;
}

export interface CollectionState {
  readonly flags: readonly boolean[];
  update(slot: number, collapse: number, active: boolean): boolean;
  readonly visited: readonly boolean[];
}

/**
 * Page-load memory: one-way false -> true, with no persistence surface.
 * Every chapter — including the last — collects through its own collapse;
 * the anglerfish tail leaves the final chapter enough scroll room to reach
 * collapse 1 before the document ends (pinned in descent.test.ts).
 */
export function createCollectionState(count: number): CollectionState {
  const flags = new Array<boolean>(count).fill(false);
  const visited = new Array<boolean>(count).fill(false);

  return {
    flags,
    update(slot: number, collapse: number, active: boolean): boolean {
      if (slot < 0 || slot >= flags.length) {
        return false;
      }

      if (active) {
        visited[slot] = true;
      }

      if (visited[slot] && collapse >= 1) {
        flags[slot] = true;
      }

      return flags[slot] ?? false;
    },
    visited,
  };
}

export function createShelf(nav: HTMLElement, sections: readonly DescentSection[], callbacks: ShelfCallbacks): Shelf {
  // The static <ul> stays for no-JS navigation; CSS swaps which list shows.
  const list = document.createElement("ol");
  list.className = "shelf-slots";
  nav.append(list);

  const collection = createCollectionState(sections.length);
  const docked = collection.flags;
  const slotPres: HTMLPreElement[] = [];
  const slotButtons: HTMLButtonElement[] = [];
  const travelers: HTMLPreElement[] = [];
  const baseWidths: Array<number | undefined> = [];

  const emptyGlyph = Array.from({ length: 6 }, () => "·".padStart(Math.ceil(DOCK_GLYPH_COLS / 2)).padEnd(DOCK_GLYPH_COLS)).join("\n");

  sections.forEach((section, slot) => {
    const item = document.createElement("li");
    item.className = "shelf-item";
    item.dataset["slot"] = String(slot);
    item.style.setProperty("--reveal-index", String(Math.max(0, slot - 1)));
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shelf-slot";
    button.dataset["slot"] = String(slot);
    button.setAttribute("aria-label", `Go to ${section.label}`);

    const pre = document.createElement("pre");
    pre.setAttribute("aria-hidden", "true");
    pre.textContent = docked[slot] ? section.scene.dockGlyph.join("\n") : emptyGlyph;
    pre.className = docked[slot] ? "shelf-glyph is-docked" : "shelf-glyph";
    button.append(pre);

    const chip = document.createElement("span");
    chip.className = "shelf-chip";
    chip.setAttribute("role", "tooltip");
    chip.id = `shelf-chip-${slot}`;
    chip.textContent = section.scene.summaryChip ?? section.label;
    button.setAttribute("aria-describedby", chip.id);
    button.append(chip);

    button.addEventListener("click", () => {
      callbacks.onNavigate(slot);
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

  let expanded = false;

  const revealRemainingSlots = (): void => {
    if (expanded) {
      return;
    }

    expanded = true;
    nav.classList.add("shelf-expanded");
  };

  const showCollected = (slot: number): void => {
    const pre = slotPres[slot];
    const button = slotButtons[slot];
    const section = sections[slot];

    if (pre && section) {
      pre.textContent = section.scene.dockGlyph.join("\n");
      pre.className = "shelf-glyph is-docked";
    }

    if (button && section) {
      button.setAttribute("aria-label", `Go to ${section.label} (collected)`);
    }
  };

  return {
    get docked(): readonly boolean[] {
      return docked;
    },
    update(slot: number, collapse: number, canvasRect: Rect, visited: boolean): void {
      const traveler = travelers[slot];
      const button = slotButtons[slot];

      if (!traveler || !button) {
        return;
      }

      const wasCollected = docked[slot] ?? false;
      const isCollected = collection.update(slot, collapse, visited);

      if (!wasCollected && isCollected) {
        showCollected(slot);
      }

      if (slot === 0 && collapse >= 1) {
        revealRemainingSlots();
      }

      if (collapse <= 0) {
        traveler.style.display = "none";
        return;
      }

      if (collapse >= 1) {
        traveler.style.display = "none";
        return;
      }

      // A collected frame stays on the shelf for this page load. Suppress the
      // duplicate traveler when the visitor scrolls back through its scene.
      if (docked[slot]) {
        traveler.style.display = "none";
        return;
      }

      // First approach: sample the SDK's spring-on-bezier dock path.
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
      // Ink follows condensation: near the start of the flight the traveler is
      // scaled to nearly the whole canvas, and at that size even low-opacity
      // glyphs read as a giant overlay mushed across the next scene. Squaring
      // the shrink progress keeps the glyph a ghost while it is huge and lets
      // it ink in as it approaches slot size — the dock moment itself is
      // unchanged.
      const span = Math.max(1, canvasRect.w - to.w);
      const shrink = Math.min(1, Math.max(0, (canvasRect.w - frame.w) / span));
      traveler.style.opacity = (Math.min(1, collapse * 1.4) * shrink * shrink).toFixed(3);
    },
  };
}
