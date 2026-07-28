/**
 * Tiny 5x7 letterforms for the name written in the sand, plus the mask
 * builder that stamps them into buffer-cell coordinates. Private helper of
 * the beach scene — glyph coverage is exactly the letters the name needs.
 *
 * Copy rule for this scene (from the brief): the ONLY name text rendered is
 * "Collin Bentley". Portrait viewports stack it as two lines ("Collin" /
 * "Bentley") so the letters stay large enough to read on a phone; the text
 * itself never changes. Uppercased here purely for the letterform lookup.
 */

export const NAME_TEXT = "Collin Bentley";
export const NAME_LINES_WIDE: readonly string[] = [NAME_TEXT];
export const NAME_LINES_TALL: readonly string[] = ["Collin", "Bentley"];

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const GLYPH_ADVANCE = GLYPH_WIDTH + 1;
/** Vertical gap between stacked lines, in glyph rows (scaled). */
const LINE_GAP = 2;

const GLYPHS: Record<string, readonly string[]> = {
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  I: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "#####"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  N: ["#...#", "##..#", "##..#", "#.#.#", "#..##", "#..##", "#...#"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  T: ["#####", "..#..", "..#..", "..#..", "..#..", "..#..", "..#.."],
  Y: ["#...#", "#...#", ".#.#.", "..#..", "..#..", "..#..", "..#.."],
};

/** One lit cell of the name, in buffer coordinates. */
export interface NameCell {
  /** Index of the character within the whole name (for per-letter bias). */
  readonly letter: number;
  /** Stable per-cell random in [0, 1] (erosion stagger). */
  readonly r: number;
  readonly x: number;
  readonly y: number;
}

export interface NameMask {
  readonly cells: readonly NameCell[];
  readonly height: number;
  readonly letterCount: number;
  readonly width: number;
  readonly x0: number;
  readonly y0: number;
}

/**
 * Stamps `lines` centered horizontally (each line independently), the first
 * line's letter tops at `yFrac * rows`, later lines below with a scaled gap.
 * `scale` is reduced automatically until the widest line fits the grid.
 * `rand(x, y)` supplies the deterministic per-cell random. Letter indices
 * run continuously across lines so per-letter state stays one flat array.
 */
export function buildNameMask(
  lines: readonly string[],
  cols: number,
  rows: number,
  scale: number,
  yFrac: number,
  rand: (x: number, y: number) => number,
): NameMask {
  const lineLetters = lines.map((line) => Array.from(line.toUpperCase()));
  const lineAdvance = lineLetters.map((letters) => letters.length * GLYPH_ADVANCE - 1);
  const widest = Math.max(1, ...lineAdvance);
  let fitScale = Math.max(1, Math.floor(scale));

  while (fitScale > 1 && widest * fitScale > cols - 4) {
    fitScale--;
  }

  const width = widest * fitScale;
  const lineStride = (GLYPH_HEIGHT + LINE_GAP) * fitScale;
  const height = lines.length * GLYPH_HEIGHT * fitScale + (lines.length - 1) * LINE_GAP * fitScale;
  const x0 = Math.max(0, Math.floor((cols - width) / 2));
  const y0 = Math.round(rows * yFrac);
  const cells: NameCell[] = [];
  let letterIndex = 0;
  let letterCount = 0;

  for (let li = 0; li < lineLetters.length; li++) {
    const letters = lineLetters[li] ?? [];
    const lineX0 = Math.max(0, Math.floor((cols - (lineAdvance[li] ?? 0) * fitScale) / 2));
    const lineY0 = y0 + li * lineStride;

    for (let ci = 0; ci < letters.length; ci++, letterIndex++) {
      const glyph = GLYPHS[letters[ci] ?? " "];
      letterCount = letterIndex + 1;

      if (!glyph) {
        continue;
      }

      for (let gy = 0; gy < GLYPH_HEIGHT; gy++) {
        const row = glyph[gy] ?? "";

        for (let gx = 0; gx < GLYPH_WIDTH; gx++) {
          if (row.charAt(gx) !== "#") {
            continue;
          }

          for (let sy = 0; sy < fitScale; sy++) {
            for (let sx = 0; sx < fitScale; sx++) {
              const x = lineX0 + (ci * GLYPH_ADVANCE + gx) * fitScale + sx;
              const y = lineY0 + gy * fitScale + sy;

              if (x >= 0 && x < cols && y >= 0 && y < rows) {
                cells.push({ letter: letterIndex, r: rand(x, y), x, y });
              }
            }
          }
        }
      }
    }
  }

  return { cells, height, letterCount, width, x0, y0 };
}
