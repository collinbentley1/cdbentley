/**
 * Tiny 5x7 letterforms for the name written in the sand, plus the mask
 * builder that stamps them into buffer-cell coordinates. Private helper of
 * the beach scene — glyph coverage is exactly the letters the name needs.
 *
 * Copy rule for this scene (from the brief): the ONLY name text rendered is
 * "Collin Bentley". Uppercased here purely for the letterform lookup.
 */

export const NAME_TEXT = "Collin Bentley";

const GLYPH_WIDTH = 5;
const GLYPH_HEIGHT = 7;
const GLYPH_ADVANCE = GLYPH_WIDTH + 1;

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
  /** Index of the character within the name (for per-letter wash bias). */
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
 * Stamps `text` centered horizontally, letter tops at `yFrac * rows`.
 * `scale` is reduced automatically until the name fits the grid width.
 * `rand(x, y)` supplies the deterministic per-cell random.
 */
export function buildNameMask(
  text: string,
  cols: number,
  rows: number,
  scale: number,
  yFrac: number,
  rand: (x: number, y: number) => number,
): NameMask {
  const letters = Array.from(text.toUpperCase());
  const advanceCells = letters.length * GLYPH_ADVANCE - 1;
  let fitScale = Math.max(1, Math.floor(scale));

  while (fitScale > 1 && advanceCells * fitScale > cols - 4) {
    fitScale--;
  }

  const width = advanceCells * fitScale;
  const height = GLYPH_HEIGHT * fitScale;
  const x0 = Math.max(0, Math.floor((cols - width) / 2));
  const y0 = Math.round(rows * yFrac);
  const cells: NameCell[] = [];

  for (let li = 0; li < letters.length; li++) {
    const glyph = GLYPHS[letters[li] ?? " "];

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
            const x = x0 + (li * GLYPH_ADVANCE + gx) * fitScale + sx;
            const y = y0 + gy * fitScale + sy;

            if (x >= 0 && x < cols && y >= 0 && y < rows) {
              cells.push({ letter: li, r: rand(x, y), x, y });
            }
          }
        }
      }
    }
  }

  return { cells, height, letterCount: letters.length, width, x0, y0 };
}
