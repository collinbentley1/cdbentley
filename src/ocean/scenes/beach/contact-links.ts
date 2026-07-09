/**
 * Contact block contract for the beach scene — the block stands ABOVE the
 * tide line and is never washed (brief, scene 1; v6 non-negotiable: contact
 * links never compacted, always solid ink).
 *
 * Scenes write luminance only, so the clickable block itself is integrator
 * DOM (Phase C). This file is the handshake:
 *
 * - CONTACT_REGION is the buffer-cell region (fractions of the scene grid)
 *   the sim keeps permanently dry at depth <= 0. The integrator positions
 *   the DOM block over it. scene.test.ts proves the tide never reaches it.
 * - CONTACT_LINKS carries clearly-marked placeholder href tokens for the
 *   integrator to fill; link set per GOALS.md WS-A (email/GitHub/LinkedIn)
 *   plus the resume slot from the brief's recruiter path. No claims here.
 */

export interface ContactLink {
  /** Placeholder token — integrator fills the real value in Phase C. */
  readonly href: string;
  readonly label: string;
}

export const CONTACT_LINKS: readonly ContactLink[] = [
  { href: "{{TODO(integrator): mailto href}}", label: "Email" },
  { href: "{{TODO(integrator): GitHub profile href}}", label: "GitHub" },
  { href: "{{TODO(integrator): LinkedIn profile href}}", label: "LinkedIn" },
  { href: "{{TODO(integrator): resume href}}", label: "TODO(collin): resume link label" },
];

/**
 * Fractions of the scene grid (cols/rows). With the default tuning this is
 * rows ~5..16, cols ~10..94 — well above the highest possible swash reach
 * at depth <= 0 (see scene.test.ts).
 */
export const CONTACT_REGION = {
  hFrac: 0.12,
  wFrac: 0.42,
  xFrac: 0.05,
  yFrac: 0.06,
} as const;
