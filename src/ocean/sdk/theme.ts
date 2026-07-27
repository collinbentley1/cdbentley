/**
 * Art-direction constants. These are LAW from the design brief:
 * true black, phosphor off-white ink, one accent used sparingly,
 * one monospace family, dpr capped at 2, and no CRT effects anywhere.
 */

export const OCEAN_THEME = {
  /** One accent, used sparingly. Scenes must not use it. */
  accent: "#ffb454",
  background: "#000000",
  dprCap: 2,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  /** Phosphor off-white body ink. */
  ink: "#e8e3d3",
} as const;
