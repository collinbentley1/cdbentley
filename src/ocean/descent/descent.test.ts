/**
 * Descent integration wiring tests (WS-C Phase C) — DOM-free checks of the
 * scene order, depth mapping, shelf wiring, contact links, and the generated
 * epistemic-ink claims (both the data module and the static page markup).
 */

import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { DEFAULT_RESOLUTION, DOCK_GLYPH_COLS, DOCK_GLYPH_ROWS, resolutionForDepth } from "../sdk/index.ts";
import { RENDERED_CLAIMS } from "./claims.generated.ts";
import { DESCENT_CONTACT_LINKS, depthForSectionTop, MEMORY_LINE_VH, SECTIONS, SHELF_SECTIONS } from "./content.ts";
import { createCollectionState } from "./shelf.ts";

const pageHtml = await Bun.file(join(import.meta.dir, "..", "..", "..", "public", "ocean", "index.html")).text();

describe("scene order", () => {
  test("descent order per the brief: 1-8 with the deep register before the floor", () => {
    expect(SECTIONS.map((section) => section.scene.id)).toEqual([
      "beach",
      "stage",
      "classroom",
      "corridor",
      "trading-floor",
      "airport-gate",
      "subway-platform",
      "anglerfish",
      "deep-shape",
      "ocean-floor",
    ]);
  });

  test("exactly eight shelf slots, 0..7, deep register excluded", () => {
    expect(SHELF_SECTIONS.map((section) => section.shelfSlot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(SHELF_SECTIONS.some((section) => section.scene.id === "anglerfish" || section.scene.id === "deep-shape")).toBe(false);
  });

  test("every scene ships a 12x6 dock glyph and a TODO(collin) summary chip", () => {
    for (const section of SECTIONS) {
      expect(section.scene.dockGlyph).toHaveLength(DOCK_GLYPH_ROWS);

      for (const row of section.scene.dockGlyph) {
        expect(row).toHaveLength(DOCK_GLYPH_COLS);
      }

      expect(section.scene.summaryChip ?? "TODO(collin)").toStartWith("TODO(collin)");
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
  test("no integrator placeholders remain in the live links", () => {
    for (const link of DESCENT_CONTACT_LINKS) {
      if (link.todo === undefined) {
        expect(link.href).not.toContain("TODO");
        expect(link.href.length).toBeGreaterThan(0);
      } else {
        expect(link.todo).toStartWith("TODO(collin)");
      }
    }
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

describe("epistemic ink (generated claims)", () => {
  test("claims exist and none traces to the C section", () => {
    expect(RENDERED_CLAIMS.length).toBeGreaterThanOrEqual(6);

    for (const claim of RENDERED_CLAIMS) {
      expect(claim.id.startsWith("C")).toBe(false);
      expect(["BULLETPROOF", "DEFENSIBLE", "NEEDS-CAVEAT", "UNGRADED"]).toContain(claim.grade);
      expect(["left", "below", "right"]).toContain(claim.edge);
    }
  });

  test("grades carried at grade for the wired ids", () => {
    const byId = new Map(RENDERED_CLAIMS.map((claim) => [claim.slot, claim.grade]));
    expect(byId.get("S1")).toBe("DEFENSIBLE");
    expect(byId.get("S3")).toBe("BULLETPROOF");
    expect(byId.get("F4")).toBe("BULLETPROOF");
    expect(byId.get("L1-framing")).toBe("UNGRADED");
    expect(byId.get("R9-president")).toBe("UNGRADED");
  });

  test("every generated claim is typeset in the static document", () => {
    for (const claim of RENDERED_CLAIMS) {
      expect(pageHtml).toContain(`data-slot="${claim.slot}"`);
    }
  });

  test("displayed claim text keeps intra-word underscores verbatim (FACTS L1 names)", () => {
    expect(pageHtml).toContain("collateral_sourcing");
    expect(pageHtml).toContain("sec_master_viewer");
    expect(pageHtml).not.toContain("collateralsourcing");
    expect(pageHtml).not.toContain("secmasterviewer");
  });

  test("ungrounded brief items stay visible TODO(collin) placeholders", () => {
    expect(pageHtml).toContain("2M-member refill model");
    expect(pageHtml.includes("2M-member refill model") && pageHtml.includes("never renders as fact")).toBe(true);
    // Scene 7 + beach copy are Collin's pen.
    expect(pageHtml).toContain("TODO(collin): scene 7 sign line");
    expect(pageHtml).toContain("TODO(collin): beach copy");
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

  test("landmarks, hidden identity heading, ASCII bridge canvas, and staging meta", () => {
    const headerMarkup = /<header class="site">([\s\S]*?)<\/header>/.exec(pageHtml)?.[1] ?? "missing";
    const bridgeMarkup = /<div class="bridge-cue"[^>]*>([\s\S]*?)<\/div>/.exec(pageHtml)?.[1] ?? "missing";
    expect(pageHtml).toContain('class="skip-link"');
    expect(pageHtml).toContain('<h1 class="visually-hidden">COLLIN BENTLEY</h1>');
    expect(headerMarkup).not.toBe("missing");
    expect(headerMarkup).not.toContain("<a ");
    expect(pageHtml).toContain('class="bridge-cue" aria-hidden="true"');
    expect(bridgeMarkup).not.toBe("missing");
    expect(bridgeMarkup).toContain('<canvas class="bridge-canvas" aria-hidden="true"></canvas>');
    expect(bridgeMarkup).not.toContain("<svg");
    expect(pageHtml).toContain('<canvas id="ocean-field" aria-hidden="true">');
    expect(pageHtml).toContain('<meta name="robots" content="noindex" />');
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
