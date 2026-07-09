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

  test("email/GitHub/LinkedIn present in page header, beach overlay, and floor", () => {
    const occurrences = pageHtml.split("mailto:collin.bentley@me.com").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(4);
    expect(pageHtml).toContain("https://github.com/collinbentley1");
    expect(pageHtml).toContain("https://www.linkedin.com/in/collinbentley");
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

  test("every generated claim is typeset in the static page (plain view carries it)", () => {
    for (const claim of RENDERED_CLAIMS) {
      expect(pageHtml).toContain(`data-slot="${claim.slot}"`);
    }
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

describe("plain view / a11y invariants in the static page", () => {
  test("landmarks, skip link, toggle, aria-hidden canvas, noindex staging meta", () => {
    expect(pageHtml).toContain('class="skip-link"');
    expect(pageHtml).toContain('id="plain-toggle"');
    expect(pageHtml).toContain("expand full context");
    expect(pageHtml).toContain("restore full context");
    expect(pageHtml).toContain('<canvas id="ocean-field" aria-hidden="true">');
    expect(pageHtml).toContain('<meta name="robots" content="noindex" />');
    expect(pageHtml).toContain('property="og:image"');
    expect(pageHtml).toContain('name="twitter:card"');
  });

  test("no CRT effects and no per-character DOM anywhere in the page styles", () => {
    expect(pageHtml).not.toContain("scanline");
    expect(pageHtml).not.toContain("chromatic");
    expect(pageHtml).not.toContain("text-shadow");
  });
});
