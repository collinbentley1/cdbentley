export type Pixel = 0 | 1;

export type Lesson = {
  readonly seed: string;
  readonly name: "Collin Bentley";
  readonly note: string;
  readonly facts: readonly string[];
  readonly glyph: readonly (readonly Pixel[])[];
  readonly start: readonly (readonly Pixel[])[];
};

export type Score = {
  readonly matches: number;
  readonly total: number;
  readonly solved: boolean;
  readonly line: string;
};

const WIDTH = 11;
const HEIGHT = 11;

const FACTS = [
  "Yale CS 2019",
  "PearVC PearX founder",
  "former teacher",
  "AI builder",
] as const;

const NOTES = [
  "chalk",
  "compiler",
  "pear",
  "lesson",
  "model",
  "spark",
] as const;

const SHAPES = [
  [
    "00001100000",
    "00011100000",
    "00001000000",
    "00011100000",
    "00111110000",
    "01111111000",
    "01111111000",
    "01111111000",
    "00111110000",
    "00011100000",
    "00000000000",
  ],
  [
    "00000000000",
    "00111111000",
    "00100001000",
    "00101101000",
    "00100001000",
    "00111111000",
    "00001000000",
    "00001000000",
    "00011100000",
    "00000000000",
    "00000000000",
  ],
  [
    "00000000000",
    "00001000000",
    "00011100000",
    "00111110000",
    "01111111000",
    "00011100000",
    "00101010000",
    "01001001000",
    "00001000000",
    "00000000000",
    "00000000000",
  ],
] as const;

export function buildLesson(seedInput = todaySeed()): Lesson {
  const seed = normalizeSeed(seedInput);
  const random = mulberry32(hashSeed(seed));
  const shape = SHAPES[Math.floor(random() * SHAPES.length)] ?? SHAPES[0];
  const glyph = shape.map((row) => [...row].map((value) => (value === "1" ? 1 : 0) as Pixel));
  const start = glyph.map((row, y) =>
    row.map((value, x) => {
      const shouldFlip = ((x * 13 + y * 17 + Math.floor(random() * 100)) % 4) === 0;
      return (shouldFlip ? invert(value) : value) as Pixel;
    }),
  );

  return {
    seed,
    name: "Collin Bentley",
    note: NOTES[Math.floor(random() * NOTES.length)] ?? "spark",
    facts: rotateFacts(Math.floor(random() * FACTS.length)),
    glyph,
    start,
  };
}

export function scoreBoard(board: readonly (readonly Pixel[])[], target: readonly (readonly Pixel[])[]): Score {
  const height = Math.min(board.length, target.length);
  let matches = 0;
  let total = 0;

  for (let y = 0; y < height; y += 1) {
    const boardRow = board[y] ?? [];
    const targetRow = target[y] ?? [];
    const width = Math.min(boardRow.length, targetRow.length);

    for (let x = 0; x < width; x += 1) {
      total += 1;
      if (boardRow[x] === targetRow[x]) {
        matches += 1;
      }
    }
  }

  return {
    matches,
    total,
    solved: matches === total && total > 0,
    line: matches === total && total > 0 ? "class dismissed" : `${matches}/${total}`,
  };
}

export function parseBoard(value: string | null): Pixel[][] | null {
  if (!value) {
    return null;
  }

  const rows = value.split(".");
  if (rows.length !== HEIGHT) {
    return null;
  }

  const board = rows.map((row) => {
    if (row.length !== WIDTH || /[^01]/.test(row)) {
      return null;
    }

    return [...row].map((cell) => (cell === "1" ? 1 : 0) as Pixel);
  });

  if (board.some((row) => row === null)) {
    return null;
  }

  return board as Pixel[][];
}

export function serializeBoard(board: readonly (readonly Pixel[])[]): string {
  return board.map((row) => row.join("")).join(".");
}

function rotateFacts(offset: number): readonly string[] {
  return [...FACTS.slice(offset), ...FACTS.slice(0, offset)];
}

function invert(value: Pixel): Pixel {
  return value === 1 ? 0 : 1;
}

function normalizeSeed(seedInput: string): string {
  return seedInput.trim().slice(0, 48) || todaySeed();
}

function todaySeed(): string {
  return new Date().toISOString().slice(0, 10);
}

function hashSeed(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let value = seed;

  return () => {
    value += 0x6d2b79f5;
    let mix = value;
    mix = Math.imul(mix ^ (mix >>> 15), mix | 1);
    mix ^= mix + Math.imul(mix ^ (mix >>> 7), mix | 61);
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}
