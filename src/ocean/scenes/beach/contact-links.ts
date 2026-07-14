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
 * - CONTACT_LINKS carries the link set (email/GitHub/LinkedIn/resume);
 *   the integrator's DESCENT_CONTACT_LINKS mirrors it.
 */

export interface ContactLink {
  readonly href: string;
  readonly label: string;
}

export const CONTACT_LINKS: readonly ContactLink[] = [
  { href: "mailto:collin.bentley@me.com", label: "Email" },
  { href: "https://github.com/collinbentley1", label: "GitHub" },
  { href: "https://www.linkedin.com/in/collinbentley", label: "LinkedIn" },
  { href: "/resume.pdf", label: "Resume" },
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
