/**
 * Art-direction constants. These are LAW from the design brief:
 * true black, phosphor off-white ink, ONE accent reserved for epistemic
 * events (receipt dock / cure), one monospace family, dpr capped at 2,
 * and no CRT effects anywhere.
 */

export const OCEAN_THEME = {
  /** ONE accent, epistemic events only. Scenes must not use it. TODO(collin): tune the exact hue. */
  accent: "#ffb454",
  background: "#000000",
  dprCap: 2,
  fontFamily: 'ui-monospace, "SF Mono", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  /** Phosphor off-white body ink. TODO(collin): tune. */
  ink: "#e8e3d3",
} as const;
