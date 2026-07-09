/**
 * FACTS.md -> claims pipeline (WS-C Phase C, "The Ocean Remembers").
 *
 * Build-time generator. Reads the PRIVATE claims ledger (FACTS.md — not
 * committed to this repo; path via FACTS_PATH, default <repo>/FACTS.md) and
 * emits:
 *
 *   1. src/ocean/descent/claims.generated.ts — the claims data the descent
 *      page renders (id, text, grade, receipt chip, caveat, provenance edge).
 *   2. The epistemic-ink markup in public/ocean/index.html, replacing the
 *      blocks between `<!-- ink:<sceneId>:begin -->` / `<!-- ink:<sceneId>:end -->`
 *      markers, so the plain (no-JS) document carries the same claims.
 *
 * Hard rules encoded here, mechanically:
 *   - The C section (PROHIBITED claims / required corrections) is NEVER
 *     parsed into claims. Section letters outside S/F/L/R are excluded too
 *     (A/ST/T are interview and ops material, not site claims — conservative).
 *   - Every rendered `text` and `caveat` MUST be a verbatim substring of the
 *     source entry (whitespace-normalized, markdown emphasis stripped). If it
 *     is not, generation THROWS — inventing or upgrading a claim is a hard
 *     failure, so the tool makes it mechanically impossible.
 *   - Grades are carried at grade: BULLETPROOF | DEFENSIBLE | NEEDS-CAVEAT,
 *     and anything the source marks (or leaves) ungraded is UNGRADED — the
 *     page renders UNGRADED dimmer than DEFENSIBLE, never heavier.
 *
 * Run:  FACTS_PATH=/path/to/FACTS.md bun tools/facts-claims.ts
 * Check (CI-safe, no FACTS.md needed): bun test tools/facts-claims.test.ts
 */

import { createHash } from "node:crypto";
import { join } from "node:path";

export type Grade = "BULLETPROOF" | "DEFENSIBLE" | "NEEDS-CAVEAT" | "UNGRADED";

export type ProvenanceEdge = "left" | "below" | "right";

export interface FactEntry {
  /** Claim id, e.g. "S1", "F4", "R9". Never a C id. */
  id: string;
  /** Section letter(s): S, F, L, R. */
  section: string;
  /** First line of the entry (heading + grade marker). */
  heading: string;
  /** Grade at grade. Ungraded-in-source entries stay UNGRADED. */
  grade: Grade;
  /** The italic grade annotation, verbatim, for traceability. */
  gradeNote: string;
  /** Full entry body (heading + following lines), raw markdown. */
  body: string;
}

export interface RenderedClaimSpec {
  /** FACTS id this claim traces to. */
  id: string;
  /** Unique slot key (an id may feed more than one typeset fragment). */
  slot: string;
  /** Scene section the claim typesets beside. */
  sceneId: string;
  /** Verbatim fragment of the FACTS entry (checked mechanically). */
  text: string;
  /** Verbatim caveat fragment, rendered inline in dim ink. */
  caveat?: string;
  /** Receipt chip label (mechanical, names the receipt). */
  chipLabel?: string;
  /** Receipt chip link — only URLs verified live tonight. */
  chipHref?: string;
  /** Edge the provenance packet swims in from (yale left, GitHub below, press right). */
  edge: ProvenanceEdge;
}

export interface RenderedClaim extends RenderedClaimSpec {
  grade: Grade;
  gradeNote: string;
}

/** Sections whose entries may become claims. C is binding-excluded; A/ST/T excluded conservatively. */
export const INCLUDED_SECTIONS: ReadonlySet<string> = new Set(["S", "F", "L", "R"]);

/**
 * The claim slots the descent actually renders — the public surface equals
 * the rendered surface, nothing more. Edges per the brief: yale.edu from the
 * left rail, GitHub/commits/live endpoints from below, press from the right.
 */
export const RENDERED_SPECS: readonly RenderedClaimSpec[] = [
  {
    chipLabel: "receipt: Humana Studio H press · Fierce Healthcare",
    edge: "right",
    id: "S1",
    sceneId: "corridor",
    slot: "S1",
    text: "Enterprise LLM products inside a Fortune-50 payer, 2022–24.",
  },
  {
    chipHref: "https://collegearts.yale.edu/events/shows-screenings/reverie",
    chipLabel: "receipt: collegearts.yale.edu (Reverie, Apr 2017)",
    edge: "left",
    id: "R9",
    sceneId: "stage",
    slot: "R9-president",
    text: "President (2017) of a ~$200k/yr 501(c)(3) theater",
  },
  {
    caveat: "ungraded in source; receipts are public and re-runnable: yale.edu, Yale Daily News, IRS 990s",
    edge: "left",
    id: "R9",
    sceneId: "stage",
    slot: "R9-credits",
    text: "Yale College Arts biography page (yale.edu) lists 9 production credits 2016–19",
  },
  {
    caveat: "do not claim production traders used it daily; it was demo-stage with production-grade plumbing",
    edge: "below",
    id: "L1",
    sceneId: "trading-floor",
    slot: "L1-framing",
    text: "Built Agency MBS workflow products with institutional traders (co-founder was an ex-SquarePoint MBS quant); I know the blotter, BWIC, and TRACE workflows first-hand — and I ship at 14 PRs/week.",
  },
  {
    chipLabel: "receipt: v1 repo (private; routers/utilities enumerable on request)",
    edge: "below",
    id: "L1",
    sceneId: "trading-floor",
    slot: "L1-receipts",
    text: "11 domain routers (bwic, collateral_sourcing, prepay, sec_master_viewer…), a layered ELT data platform with ETF retrievers and SharePoint ingestion, SIFMA calendar/settlement utils, OAS/cheapness scoring, guarded prepay query building with server-rendered plots",
  },
  {
    caveat: "Withdrawn at dissolution; receipts = Collin's screenshots and demo videos",
    chipHref: "https://medlock.ai/",
    chipLabel: "live: medlock.ai (MCP endpoint at /api/mcp)",
    edge: "below",
    id: "S3",
    sceneId: "airport-gate",
    slot: "S3",
    text: "Production MCP server (medlock.ai) live July 2025, eight months after Anthropic shipped MCP and ~4 months after the Streamable HTTP transport entered the spec. Then the Visit Emery ChatGPT app approved by OpenAI and published to the app directory within ~5 months of the directory opening (Dec 17, 2025)",
  },
  {
    chipLabel: "receipt: commit dates (git history)",
    edge: "below",
    id: "F4",
    sceneId: "airport-gate",
    slot: "F4",
    text: "Pivot merged Mar 7, 2026 → first ChatGPT app merged in 27 days → first live destination tenant in 31 days → live booking-vendor integration (Ventrata/OCTO) in 48 days → app-store submission packet in 66 days. 132 PRs in 9.5 weeks (14/week; 10 merged on May 12 alone).",
  },
  {
    chipLabel: "receipt: commit dates (git history)",
    edge: "below",
    id: "S4",
    sceneId: "colophon",
    slot: "S4",
    text: "I've been early three times in a row — enterprise LLMs in 2022, voice-LLM health in 2024, MCP apps in 2025 — and I have the commit dates to prove it.",
  },
];

/**
 * Collapse whitespace and strip markdown emphasis/quotes so verbatim checks
 * compare prose, not markup. Underscores are stripped only at word edges
 * (emphasis delimiters like `_word_`); intra-word underscores are literal
 * text (identifiers like `collateral_sourcing`) and must survive — the same
 * function feeds the DISPLAYED claim text, which must stay verbatim.
 */
export function normalizeProse(value: string): string {
  return value
    .replace(/[*`]/g, "")
    .replace(/(?<![A-Za-z0-9])_+|_+(?![A-Za-z0-9])/g, "")
    .replace(/[""]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function gradeFromHeading(heading: string): { grade: Grade; gradeNote: string } {
  const note = /\*([^*]+)\*/.exec(heading.replace(/\*\*[^*]*\*\*/g, ""));
  const gradeNote = note?.[1]?.trim() ?? "";
  const scan = gradeNote !== "" ? gradeNote : heading;

  if (/NEEDS-CAVEAT/.test(scan)) {
    return { grade: "NEEDS-CAVEAT", gradeNote };
  }

  if (/DEFENSIBLE/.test(scan)) {
    return { grade: "DEFENSIBLE", gradeNote };
  }

  if (/BULLETPROOF/.test(scan)) {
    return { grade: "BULLETPROOF", gradeNote };
  }

  return { grade: "UNGRADED", gradeNote };
}

/** Parse FACTS.md into claim entries. C-section (PROHIBITED) is never parsed; only S/F/L/R are. */
export function parseFacts(markdown: string): FactEntry[] {
  const entries: FactEntry[] = [];
  let section = "";
  let current: { id: string; lines: string[]; section: string } | null = null;

  const flush = (): void => {
    if (!current) {
      return;
    }

    const heading = current.lines[0] ?? "";
    const { grade, gradeNote } = gradeFromHeading(heading);
    entries.push({
      body: current.lines.join("\n").trim(),
      grade,
      gradeNote,
      heading,
      id: current.id,
      section: current.section,
    });
    current = null;
  };

  for (const line of markdown.split("\n")) {
    const sectionMatch = /^## ([A-Z]{1,2}) — /.exec(line);

    if (sectionMatch?.[1] !== undefined) {
      flush();
      section = sectionMatch[1];
      continue;
    }

    if (line.startsWith("## ")) {
      flush();
      section = "";
      continue;
    }

    if (!INCLUDED_SECTIONS.has(section)) {
      continue;
    }

    const entryMatch = /^\*\*([A-Z]{1,2})(\d+)\./.exec(line);

    if (entryMatch && entryMatch[1] === section) {
      flush();
      current = { id: `${entryMatch[1]}${entryMatch[2]}`, lines: [line], section };
      continue;
    }

    if (current && line.trim() === "---") {
      flush();
      continue;
    }

    if (current) {
      current.lines.push(line);
    }
  }

  flush();
  return entries;
}

/**
 * Bind rendered specs to parsed entries. Throws when a spec references a
 * missing/prohibited id or when text/caveat is not verbatim in the source —
 * the mechanical no-invention guarantee.
 */
export function buildRenderedClaims(entries: readonly FactEntry[], specs: readonly RenderedClaimSpec[] = RENDERED_SPECS): RenderedClaim[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const rendered: RenderedClaim[] = [];

  for (const spec of specs) {
    if (spec.id.startsWith("C")) {
      throw new Error(`facts-claims: ${spec.id} is a C-section id — C-section claims are never rendered`);
    }

    const entry = byId.get(spec.id);

    if (!entry) {
      throw new Error(`facts-claims: no FACTS entry for id ${spec.id} — flag the gap, never invent`);
    }

    const body = normalizeProse(entry.body);

    if (!body.includes(normalizeProse(spec.text))) {
      throw new Error(`facts-claims: rendered text for ${spec.slot} is not verbatim in FACTS ${spec.id}`);
    }

    if (spec.caveat !== undefined && !body.includes(normalizeProse(spec.caveat))) {
      throw new Error(`facts-claims: caveat for ${spec.slot} is not verbatim in FACTS ${spec.id}`);
    }

    rendered.push({ ...spec, grade: entry.grade, gradeNote: entry.gradeNote });
  }

  return rendered;
}

const GRADE_CLASS: Readonly<Record<Grade, string>> = {
  BULLETPROOF: "claim--bulletproof",
  DEFENSIBLE: "claim--defensible",
  "NEEDS-CAVEAT": "claim--needs-caveat",
  UNGRADED: "claim--ungraded",
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Epistemic-ink markup for one claim (static, searchable, keyboard-reachable). */
export function claimHtml(claim: RenderedClaim): string {
  const parts: string[] = [];
  parts.push(`<div class="claim ${GRADE_CLASS[claim.grade]}" data-claim="${claim.id}" data-slot="${claim.slot}" data-edge="${claim.edge}">`);
  parts.push(`  <p class="claim-text">${escapeHtml(normalizeProse(claim.text))}</p>`);

  if (claim.caveat !== undefined) {
    parts.push(`  <p class="claim-caveat">${escapeHtml(normalizeProse(claim.caveat))}</p>`);
  }

  const chipBody = claim.chipLabel !== undefined ? escapeHtml(claim.chipLabel) : "";

  if (claim.chipHref !== undefined) {
    parts.push(`  <a class="receipt-chip" href="${escapeHtml(claim.chipHref)}" rel="noopener">${chipBody}</a>`);
  } else if (chipBody !== "") {
    parts.push(`  <span class="receipt-chip" tabindex="0">${chipBody}</span>`);
  }

  parts.push(`  <span class="claim-grade" aria-label="claim grade">${claim.grade}${claim.grade === "UNGRADED" ? " (receipt-carried)" : ""}</span>`);
  parts.push("</div>");
  return parts.join("\n");
}

/** Replace the generated ink block for a scene inside the page HTML. */
export function injectInk(html: string, sceneId: string, claims: readonly RenderedClaim[]): string {
  const begin = `<!-- ink:${sceneId}:begin -->`;
  const end = `<!-- ink:${sceneId}:end -->`;
  const beginIndex = html.indexOf(begin);
  const endIndex = html.indexOf(end);

  if (beginIndex < 0 || endIndex < 0 || endIndex < beginIndex) {
    throw new Error(`facts-claims: ink markers for ${sceneId} missing from page html`);
  }

  const block = claims.map((claim) => claimHtml(claim)).join("\n");
  return `${html.slice(0, beginIndex + begin.length)}\n${block}\n${html.slice(endIndex)}`;
}

function generatedModule(claims: readonly RenderedClaim[], sourceSha: string): string {
  const data = JSON.stringify(claims, null, 2);
  return [
    "/**",
    " * GENERATED by tools/facts-claims.ts — DO NOT EDIT.",
    " *",
    " * Claims data for the descent page, extracted verbatim (machine-checked)",
    " * from the private FACTS.md ledger at grade. C-section (prohibited)",
    " * claims are excluded by construction; UNGRADED entries render dimmer",
    " * than DEFENSIBLE, never heavier.",
    " *",
    ` * source: FACTS.md sha256 ${sourceSha}`,
    " */",
    "",
    'import type { RenderedClaim } from "../../../tools/facts-claims.ts";',
    "",
    `export const RENDERED_CLAIMS: readonly RenderedClaim[] = ${data} as const;`,
    "",
    `export const FACTS_SOURCE_SHA256 = "${sourceSha}";`,
    "",
  ].join("\n");
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..");
  const factsPath = Bun.env.FACTS_PATH ?? join(root, "FACTS.md");
  const factsFile = Bun.file(factsPath);

  if (!(await factsFile.exists())) {
    console.error(`facts-claims: FACTS.md not found at ${factsPath} (set FACTS_PATH). Committed outputs left untouched.`);
    process.exit(1);
  }

  const markdown = await factsFile.text();
  const entries = parseFacts(markdown);
  const claims = buildRenderedClaims(entries);
  const sha = createHash("sha256").update(markdown).digest("hex");

  const generatedPath = join(root, "src", "ocean", "descent", "claims.generated.ts");
  await Bun.write(generatedPath, generatedModule(claims, sha));

  const pagePath = join(root, "public", "ocean", "index.html");
  const page = Bun.file(pagePath);

  if (await page.exists()) {
    let html = await page.text();
    const scenes = new Set(claims.map((claim) => claim.sceneId));

    for (const sceneId of scenes) {
      html = injectInk(
        html,
        sceneId,
        claims.filter((claim) => claim.sceneId === sceneId),
      );
    }

    await Bun.write(pagePath, html);
  }

  console.log(`facts-claims: ${entries.length} entries parsed (sections S/F/L/R), ${claims.length} claims rendered.`);
  console.log(`facts-claims: wrote ${generatedPath}`);
}
