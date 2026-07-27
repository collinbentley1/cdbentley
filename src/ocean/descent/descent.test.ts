/**
 * Descent integration wiring tests (WS-C Phase C) — DOM-free checks of the
 * scene order, depth mapping, shelf wiring, contact links, and the final
 * chapter copy in the static page markup.
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { DEFAULT_RESOLUTION, DOCK_GLYPH_COLS, DOCK_GLYPH_ROWS, resolutionForDepth } from "../sdk/index.ts";
import { DESCENT_CONTACT_LINKS, depthForSectionTop, MEMORY_LINE_VH, SECTIONS, SHELF_SECTIONS } from "./content.ts";
import { createCollectionState } from "./shelf.ts";

const pageHtml = await Bun.file(join(import.meta.dir, "..", "..", "..", "public", "index.html")).text();

/** First sentence of each chapter, per the final copy (POLISH-SPEC §2.3). */
const CHAPTER_OPENERS: Record<string, string> = {
  "airport-gate": "In 2026 we went zero to one a second time, with US local government customers",
  beach: "The water takes the name and the sand writes it back.",
  classroom: "After Yale I moved to Beijing and taught STEM at AndKids",
  corridor: "From 2020 to 2024 I was a senior product manager in Humana's incubation lab",
  "kitchen-table": "From 2024 to 2025 I was the principal product engineer at Healthyr",
  "ocean-floor": "I don't remember most of what I've learned, especially facts",
  stage: "I studied computer science at Yale and produced mainstage musicals there from 2016 to 2019",
  "subway-platform": "It's July 2026 and I'm between things, building.",
  "trading-floor": "In November 2025 I co-founded OTseek in Pear's PearX W26 batch",
};

/** Words that must never appear user-facing (POLISH-SPEC §6 ban list). */
const BANNED_USER_FACING = [
  "proof",
  "receipt",
  "evidence",
  "bulletproof",
  "defensible",
  "ungraded",
  "claim grade",
  "provenance",
  "epistemic",
  "staging preview",
  "todo(collin)",
] as const;

describe("scene order", () => {
  test("resume-chronological descent with the deep register before the floor", () => {
    expect(SECTIONS.map((section) => section.scene.id)).toEqual([
      "beach",
      "stage",
      "classroom",
      "corridor",
      "kitchen-table",
      "trading-floor",
      "airport-gate",
      "subway-platform",
      "anglerfish",
      "deep-shape",
      "ocean-floor",
    ]);
  });

  test("exactly nine shelf slots, 0..8, deep register excluded", () => {
    expect(SHELF_SECTIONS.map((section) => section.shelfSlot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(SHELF_SECTIONS.some((section) => section.scene.id === "anglerfish" || section.scene.id === "deep-shape")).toBe(false);
  });

  test("the static shelf list follows the same chronology", () => {
    const staticList = /<nav id="shelf"[^>]*>[\s\S]*?<ul>([\s\S]*?)<\/ul>/.exec(pageHtml)?.[1] ?? "missing";
    const hrefs = [...staticList.matchAll(/href="#scene-([a-z-]+)"/g)].map((m) => m[1]);
    expect(hrefs).toEqual(SHELF_SECTIONS.map((section) => section.scene.id));
  });

  test("every scene ships a 12x6 dock glyph and a final summary chip", () => {
    for (const section of SECTIONS) {
      expect(section.scene.dockGlyph).toHaveLength(DOCK_GLYPH_ROWS);

      for (const row of section.scene.dockGlyph) {
        expect(row).toHaveLength(DOCK_GLYPH_COLS);
      }

      const chip = section.scene.summaryChip ?? "";
      expect(chip.length).toBeGreaterThan(0);
      expect(chip).not.toContain("TODO");
    }
  });

  test("every section has static markup in the page", () => {
    for (const section of SECTIONS) {
      expect(pageHtml).toContain(`data-scene="${section.scene.id}"`);
    }
  });
});

describe("memory line / depth mapping", () => {
  test("depth is pure, bidirectional, and in viewport-heights past the memory line", () => {
    const vh = 900;
    expect(depthForSectionTop(0, vh)).toBe(-MEMORY_LINE_VH);
    expect(depthForSectionTop(-vh * MEMORY_LINE_VH, vh)).toBe(0);
    expect(depthForSectionTop(-vh * 1.5, vh)).toBeCloseTo(1.5 - MEMORY_LINE_VH, 10);
    // Bidirectional: same input, same output, no hysteresis.
    expect(depthForSectionTop(-450, vh)).toBe(depthForSectionTop(-450, vh));
  });

  test("first compaction lands within two scrolls of the top", () => {
    const vh = 900;
    // After two viewport-heights of scroll the beach section top is at -2vh.
    const depthAtTwoScrolls = depthForSectionTop(-2 * vh, vh);
    const resolution = resolutionForDepth(depthAtTwoScrolls, {});
    expect(resolution.bin).toBeGreaterThan(1);
    // And the first bin threshold is crossed well before that.
    const depthAtOneScroll = depthForSectionTop(-1 * vh, vh);
    expect(resolutionForDepth(depthAtOneScroll, {}).bin).toBeGreaterThan(1);
    expect(depthAtOneScroll).toBeGreaterThanOrEqual(DEFAULT_RESOLUTION.binDepths[0]);
  });
});

describe("contact links (from the WS-A verified set)", () => {
  test("every link is live — no placeholders, resume wired to the PDF", () => {
    for (const link of DESCENT_CONTACT_LINKS) {
      expect(link.href).not.toContain("TODO");
      expect(link.href.length).toBeGreaterThan(0);
    }

    const resume = DESCENT_CONTACT_LINKS.find((link) => link.label === "Resume");
    expect(resume?.href).toBe("/resume.pdf");
  });

  test("only the untargeted floor email remains and social profiles use one icon-only top rail", () => {
    const occurrences = pageHtml.split("mailto:collin.bentley@me.com").length - 1;
    expect(occurrences).toBe(1);
    expect(pageHtml).not.toContain('class="beach-contacts"');
    expect(pageHtml).not.toContain('class="contact-row"');
    expect(pageHtml).toContain('class="floor-links"');
    expect(pageHtml).toContain("https://github.com/collinbentley1");
    expect(pageHtml).toContain("https://www.linkedin.com/in/collinbentley");
    expect(pageHtml).toContain('aria-label="Collin Bentley on GitHub"');
    expect(pageHtml).toContain('aria-label="Collin Bentley on LinkedIn"');
    expect(pageHtml).toContain('<svg viewBox="0 0 98 96" aria-hidden="true" focusable="false">');
    expect(pageHtml).toContain('<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">');
    expect(pageHtml).not.toMatch(/<a[^>]*>GitHub<\/a>/);
    expect(pageHtml).not.toMatch(/<a[^>]*>LinkedIn<\/a>/);
  });
});

describe("final copy (the chapters are plain prose — no grading system)", () => {
  test("each chapter's opening sentence is typeset in the static document", () => {
    for (const section of SECTIONS) {
      const opener = CHAPTER_OPENERS[section.scene.id];

      if (section.scene.id === "anglerfish" || section.scene.id === "deep-shape") {
        expect(opener).toBeUndefined();
        continue;
      }

      expect(opener).toBeDefined();
      expect(pageHtml.replace(/\s+/g, " ")).toContain(opener ?? "");
    }
  });

  test("no TODO(collin) marker survives anywhere user-facing", () => {
    expect(pageHtml).not.toContain("TODO(collin)");
    expect(pageHtml).not.toContain("TODO");

    for (const section of SECTIONS) {
      expect(section.scene.summaryChip ?? "").not.toContain("TODO");
    }
  });

  test("the banned vocabulary appears nowhere in the page", () => {
    const lower = pageHtml.toLowerCase();

    for (const banned of BANNED_USER_FACING) {
      expect(lower).not.toContain(banned);
    }
  });

  test("shelf chips match the static scene-summary lines, word for word", () => {
    for (const section of SECTIONS) {
      if (section.shelfSlot === null) {
        continue;
      }

      expect(pageHtml).toContain(`<p class="scene-summary">${section.scene.summaryChip}</p>`);
    }
  });

  test("the subway sign line ships verbatim", () => {
    expect(pageHtml).toContain("Up Next &gt; NYRR Midnight Run &gt; NYE 2026");
  });

  test("the receipts system is gone from the page and the bundle sources", async () => {
    const descentSource = await Bun.file(join(import.meta.dir, "descent.ts")).text();
    expect(pageHtml).not.toContain("claim");
    expect(pageHtml).not.toContain("data-claim");
    expect(descentSource).not.toContain("bindProvenancePackets");
    expect(await Bun.file(join(import.meta.dir, "provenance.ts")).exists()).toBe(false);
    expect(await Bun.file(join(import.meta.dir, "claims.generated.ts")).exists()).toBe(false);
  });

  test("the deep register carries no copy at all — its sections are canvas-only", () => {
    // Identity rule: the deep-register sections stay unnamed and unexplained.
    // (The name/IP grep audit itself runs outside the repo, per the work
    // order, so no audit term ever lands in committed code.)
    const deepSection = /<section data-scene="deep-shape"[^>]*>([\s\S]*?)<\/section>/.exec(pageHtml)?.[1] ?? "missing";
    expect(deepSection).not.toBe("missing");
    expect(deepSection.replace(/<[^>]+>/g, "").trim()).toBe("");
  });
});

describe("single-layout / a11y invariants in the static page", () => {
  test("the rejected full-context state and every global restore surface are absent", async () => {
    const descentSource = await Bun.file(join(import.meta.dir, "descent.ts")).text();
    const shelfSource = await Bun.file(join(import.meta.dir, "shelf.ts")).text();
    const floorSource = await Bun.file(join(import.meta.dir, "..", "scenes", "ocean-floor", "scene.ts")).text();
    const surface = [pageHtml, descentSource, shelfSource, floorSource].join("\n");

    expect(surface).not.toContain("expand full context");
    expect(surface).not.toContain("restore full context");
    expect(surface).not.toContain("ocean.plain");
    expect(surface).not.toContain("plain-toggle");
    expect(surface).not.toContain("floor-restore");
    expect(surface).not.toContain("shelf-restore-all");
  });

  test("landmarks, hidden identity heading, header intro + resume link, ASCII bridge canvas, and meta", () => {
    const headerMarkup = /<header class="site">([\s\S]*?)<\/header>/.exec(pageHtml)?.[1] ?? "missing";
    const bridgeMarkup = /<div class="bridge-cue"[^>]*>([\s\S]*?)<\/div>/.exec(pageHtml)?.[1] ?? "missing";
    expect(pageHtml).toContain('class="skip-link"');
    expect(pageHtml).toContain('<h1 class="visually-hidden">COLLIN BENTLEY</h1>');
    expect(headerMarkup).not.toBe("missing");
    expect(headerMarkup).toContain("I'm Collin Bentley, a builder in New York.");
    expect(headerMarkup).toContain('<a href="/resume.pdf">Resume (PDF)</a>');
    expect(pageHtml).toContain('class="bridge-cue" aria-hidden="true"');
    expect(bridgeMarkup).not.toBe("missing");
    expect(bridgeMarkup).toContain('<canvas class="bridge-canvas" aria-hidden="true"></canvas>');
    expect(bridgeMarkup).not.toContain("<svg");
    expect(pageHtml).toContain('<canvas id="ocean-field" aria-hidden="true">');
    // The site is live at the root: it must be indexable.
    expect(pageHtml).not.toContain("noindex");
    expect(pageHtml).toContain('<meta property="og:url" content="https://cdbentley.com/" />');
    expect(pageHtml).toContain('property="og:image"');
    expect(pageHtml).toContain('name="twitter:card"');
  });

  test("the memory shelf starts with Collin and reveals later slots only after the first docks", async () => {
    const shelfSource = await Bun.file(join(import.meta.dir, "shelf.ts")).text();
    expect(pageHtml).toContain('<li><a href="#scene-beach">Collin Bentley</a></li>');
    expect(shelfSource).toContain('item.className = "shelf-item"');
    expect(shelfSource).toContain('slot === 0 && collapse >= 1');
    expect(shelfSource).toContain('const isTerminal = slot === sections.length - 1');
    expect(shelfSource).toContain("collection.update(slot, collapse, visited, isTerminal)");
    expect(shelfSource).toContain('nav.classList.add("shelf-expanded")');
    expect(shelfSource).not.toContain("sessionStorage");
    expect(shelfSource).not.toContain("localStorage");
    expect(shelfSource).not.toContain("document.cookie");
    expect(pageHtml).toContain("right: 0;");
    expect(pageHtml).toContain("padding: 0 calc(98px + env(safe-area-inset-right)) 0 0;");
    expect(pageHtml).toContain('#shelf:not(.shelf-expanded) .shelf-item:not([data-slot="0"])');
    expect(pageHtml).toContain('transition-delay: calc(var(--reveal-index) * 65ms)');
  });

  test("collected frames are monotonic for one page-load state and reset with a new state", () => {
    const firstLoad = createCollectionState(8);
    expect(firstLoad.flags).toEqual([false, false, false, false, false, false, false, false]);

    // Passing a scene without ever making it the active frame is not a visit.
    firstLoad.update(0, 1, false, false);
    expect(firstLoad.flags[0]).toBe(false);

    firstLoad.update(0, 0, true, false);
    firstLoad.update(0, 1, false, false);
    firstLoad.update(3, 0, true, false);
    firstLoad.update(3, 1, false, false);
    firstLoad.update(0, 0, false, false);
    expect(firstLoad.flags).toEqual([true, false, false, true, false, false, false, false]);
    expect(firstLoad.visited).toEqual([true, false, false, true, false, false, false, false]);

    // The terminal floor collects as soon as its active frame is reached.
    firstLoad.update(7, 0, true, true);
    expect(firstLoad.flags[7]).toBe(true);

    const reload = createCollectionState(8);
    expect(reload.flags).toEqual([false, false, false, false, false, false, false, false]);
    expect(reload.visited).toEqual([false, false, false, false, false, false, false, false]);
  });

  test("the top rail uses inline white vector marks with distinct optical sizes", () => {
    expect(pageHtml).toContain('<svg viewBox="0 0 98 96" aria-hidden="true" focusable="false">');
    expect(pageHtml).toContain('<svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">');
    expect(pageHtml).toContain('fill="#fff"');
    expect(pageHtml).toContain(".social-link--github svg");
    expect(pageHtml).toContain("height: 22px");
    expect(pageHtml).toContain(".social-link--linkedin svg");
    expect(pageHtml).toContain("height: 21px");
  });

  test("no CRT effects and no per-character DOM anywhere in the page styles", () => {
    expect(pageHtml).not.toContain("scanline");
    expect(pageHtml).not.toContain("chromatic");
    expect(pageHtml).not.toContain("text-shadow");
  });
});
