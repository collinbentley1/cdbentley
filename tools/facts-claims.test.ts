/**
 * FACTS -> claims parser tests (WS-C Phase C). CI-safe: runs on an inline
 * fixture, never on the private FACTS.md (which is not in this repo). When a
 * local FACTS.md is reachable via FACTS_PATH, an extra live check runs.
 */

import { describe, expect, test } from "bun:test";

import { buildRenderedClaims, INCLUDED_SECTIONS, normalizeProse, parseFacts, RENDERED_SPECS, type RenderedClaimSpec } from "./facts-claims.ts";

const FIXTURE = `# FACTS.md — fixture

## Usage rules (hard)

- rules text.

---

## S — The narrative spine

**S1. Enterprise widgets inside a Fortune-50 payer, 2022–24.** — *DEFENSIBLE (employer work internal; forks/dates public).*
Body line about the payer.
Receipts: public fork June 2023.

**S2. Voice product, 2024–25.** — *NEEDS-CAVEAT (role metrics self-reported).*
Caveat that must travel with it: metrics are company-reported.

**S3. MCP and in-chat apps, 2025–26.** — *BULLETPROOF with the stated receipts.*
Production server live **July 2025, eight months after** the spec.

---

## F — The strongest facts

**F1. The three-wave trail.** Git dates + published launches. — *BULLETPROOF.*

**F2. Program facts.** Sub-1% acceptance. — *BULLETPROOF on program facts.* Caveat: self-reported until published.

---

## A — Owning the story

**A1. The frame (approved verbatim, ungraded in source):**
> quoted frame text.

---

## L — Lane-specific positioning

**L1. Fintech lane.** Receipts are real engineering — 11 domain routers. Approved framing: "Built widgets *with* institutional traders." **Binding limit: do not claim production traders used it daily; it was demo-stage.**

---

## R — Round 2 findings

**R9. Official receipts.** *(ungraded in source; receipts are public and re-runnable: example.edu.)* Approved phrasing: "President (2017) of a ~$200k/yr 501(c)(3) theater," citable.

---

## C — PROHIBITED claims and required corrections (binding on every artifact)

**C1. Museum:** reopened March 2024, not 2025. PROHIBITED framing stays out.
**C2. "Top 10% finalist": CUT.**

---

## T — Current-state technical facts

- HSTS missing on all five sites.
`;

describe("parseFacts", () => {
  const entries = parseFacts(FIXTURE);
  const ids = entries.map((entry) => entry.id);

  test("parses S/F/L/R entries", () => {
    expect(ids).toEqual(["S1", "S2", "S3", "F1", "F2", "L1", "R9"]);
  });

  test("C-section (PROHIBITED) is never parsed", () => {
    expect(ids.some((id) => id.startsWith("C"))).toBe(false);
    expect(entries.some((entry) => entry.body.includes("PROHIBITED"))).toBe(false);
    expect(INCLUDED_SECTIONS.has("C")).toBe(false);
  });

  test("A/ST/T sections are excluded", () => {
    expect(ids).not.toContain("A1");
    expect(entries.some((entry) => entry.body.includes("HSTS"))).toBe(false);
  });

  test("grades map at grade — never upgraded", () => {
    const byId = new Map(entries.map((entry) => [entry.id, entry.grade]));
    expect(byId.get("S1")).toBe("DEFENSIBLE");
    expect(byId.get("S2")).toBe("NEEDS-CAVEAT");
    expect(byId.get("S3")).toBe("BULLETPROOF");
    expect(byId.get("F1")).toBe("BULLETPROOF");
    expect(byId.get("F2")).toBe("BULLETPROOF");
    expect(byId.get("L1")).toBe("UNGRADED");
    expect(byId.get("R9")).toBe("UNGRADED");
  });
});

describe("buildRenderedClaims", () => {
  const entries = parseFacts(FIXTURE);

  test("verbatim fragments bind and carry their grade", () => {
    const specs: RenderedClaimSpec[] = [
      {
        caveat: "do not claim production traders used it daily; it was demo-stage",
        edge: "below",
        id: "L1",
        sceneId: "trading-floor",
        slot: "L1",
        text: "Built widgets with institutional traders.",
      },
    ];
    const claims = buildRenderedClaims(entries, specs);
    expect(claims).toHaveLength(1);
    expect(claims[0]?.grade).toBe("UNGRADED");
  });

  test("invented text is a hard failure", () => {
    const specs: RenderedClaimSpec[] = [{ edge: "below", id: "S1", sceneId: "corridor", slot: "S1", text: "An invented, upgraded claim." }];
    expect(() => buildRenderedClaims(entries, specs)).toThrow(/not verbatim/);
  });

  test("C-section ids are refused outright", () => {
    const specs: RenderedClaimSpec[] = [{ edge: "right", id: "C1", sceneId: "corridor", slot: "C1", text: "reopened March 2024" }];
    expect(() => buildRenderedClaims(entries, specs)).toThrow(/never rendered/);
  });

  test("missing ids flag the gap instead of inventing", () => {
    const specs: RenderedClaimSpec[] = [{ edge: "left", id: "S9", sceneId: "beach", slot: "S9", text: "anything" }];
    expect(() => buildRenderedClaims(entries, specs)).toThrow(/never invent/);
  });
});

describe("normalizeProse", () => {
  test("strips emphasis and collapses whitespace", () => {
    expect(normalizeProse("**27 days** →  first\napp")).toBe("27 days → first app");
  });
});

describe("rendered specs", () => {
  test("no spec references a C-section id and every edge is a known rail", () => {
    for (const spec of RENDERED_SPECS) {
      expect(spec.id.startsWith("C")).toBe(false);
      expect(["left", "below", "right"]).toContain(spec.edge);
    }
  });
});

// Live check against the real ledger when present (developer machine only).
const factsPath = Bun.env.FACTS_PATH ?? "";
const liveFacts = factsPath !== "" && (await Bun.file(factsPath).exists()) ? await Bun.file(factsPath).text() : null;

describe.if(liveFacts !== null)("live FACTS.md", () => {
  test("every rendered spec binds verbatim at grade", () => {
    const entries = parseFacts(liveFacts ?? "");
    const claims = buildRenderedClaims(entries, RENDERED_SPECS);
    expect(claims.length).toBe(RENDERED_SPECS.length);
    expect(entries.some((entry) => entry.id.startsWith("C"))).toBe(false);
  });
});
