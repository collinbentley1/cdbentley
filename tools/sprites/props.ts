import { blit, fillRect, fromGrid, hexToRgba, setPixel } from "./pixel.ts";
import { createImage, type Image } from "./png.ts";
import { renderText } from "./font.ts";

/** Original trail-and-cairns prop set (§4, §6.3-6.6 of the design brief). */

const INK = "#2b2b33";
const STONE_LIGHT = "#b2ac9c";
const STONE_MID = "#8c8678";
const STONE_DARK = "#5f5a4e";
const PAPER = "#fbf8ee";
const GOLD = "#d9a441";
const RED = "#c24b41";

// ---------------------------------------------------------------------------
// Cairns — stones are generated, so stack states stay consistent.
// ---------------------------------------------------------------------------

type Stone = { width: number; height: number };

const STONES: Stone[] = [
  { height: 8, width: 20 },
  { height: 7, width: 16 },
  { height: 6, width: 12 },
  { height: 5, width: 8 },
];

function drawStone(target: Image, centerX: number, topY: number, stone: Stone, seed: number): void {
  const ink = hexToRgba(INK);
  const light = hexToRgba(STONE_LIGHT);
  const mid = hexToRgba(STONE_MID);
  const dark = hexToRgba(STONE_DARK);

  for (let row = 0; row < stone.height; row += 1) {
    const t = row / (stone.height - 1);
    // Elliptical profile, slightly flat-bottomed.
    const bulge = Math.sin(Math.min(t, 0.82) * Math.PI * 0.61);
    const half = Math.max(2, Math.round((stone.width / 2) * (0.62 + 0.38 * bulge)));
    const y = topY + row;
    for (let dx = -half; dx <= half; dx += 1) {
      const x = centerX + dx;
      const edge = Math.abs(dx) >= half || row === 0 || row === stone.height - 1;
      let color = mid;
      if (edge) {
        color = ink;
      } else if (row <= 1 || (dx < -half + 3 && row <= 2)) {
        color = light;
      } else if (row >= stone.height - 3 && dx > half - 4) {
        color = dark;
      } else if ((x * 7 + y * 13 + seed) % 23 === 0) {
        color = dark;
      } else if ((x * 5 + y * 11 + seed) % 19 === 0) {
        color = light;
      }
      setPixel(target, x, y, color);
    }
  }
}

/** A cairn with `count` stones (2-4). Canvas is 28x30 with the base at the bottom. */
export function buildCairn(count: number): Image {
  const image = createImage(28, 30);
  let y = 30;
  for (let index = 0; index < count; index += 1) {
    const stone = STONES[index];
    if (!stone) {
      break;
    }
    y -= stone.height - 1;
    drawStone(image, 14 + (index % 2 === 1 ? 1 : 0), y, stone, index * 31);
  }
  return image;
}

/** Falling-stone animation: next stone dropping onto a cairn of `count` stones. */
export function buildCairnDrop(count: number): Image[] {
  const stone = STONES[count];
  if (!stone) {
    throw new Error("cairn is full");
  }
  const offsets = [-9, -4, 0];
  return offsets.map((offset) => {
    const image = createImage(28, 30);
    const base = buildCairn(count);
    blit(image, base, 0, 0);
    let y = 30;
    for (let index = 0; index <= count; index += 1) {
      const layer = STONES[index];
      if (layer) {
        y -= layer.height - 1;
      }
    }
    drawStone(image, 14 + (count % 2 === 1 ? 1 : 0), y + offset, stone, count * 31);
    return image;
  });
}

// ---------------------------------------------------------------------------
// Dust puff — 16x16, three expanding frames.
// ---------------------------------------------------------------------------

export function buildDust(): Image[] {
  const shade = hexToRgba("#cfc6a8");
  const soft = hexToRgba("#dfd7bd");
  const frames: Image[] = [];
  const rings = [
    [
      [7, 9],
      [8, 9],
      [6, 10],
      [9, 10],
      [7, 11],
      [8, 11],
    ],
    [
      [5, 8],
      [10, 8],
      [4, 10],
      [11, 10],
      [6, 12],
      [9, 12],
      [7, 7],
      [8, 13],
    ],
    [
      [3, 7],
      [12, 7],
      [2, 10],
      [13, 10],
      [5, 13],
      [10, 13],
      [7, 5],
      [8, 14],
    ],
  ];
  rings.forEach((points, index) => {
    const image = createImage(16, 16);
    for (const [x, y] of points) {
      setPixel(image, x ?? 0, y ?? 0, index === 2 ? soft : shade);
      if (index === 0) {
        setPixel(image, (x ?? 0) + 1, y ?? 0, soft);
      }
    }
    frames.push(image);
  });
  return frames;
}

// ---------------------------------------------------------------------------
// Tall grass — 24x16, 3-frame rustle (footer easter egg).
// ---------------------------------------------------------------------------

const GRASS_PALETTE = { d: "#4f5c36", g: "#6b7a4a", l: "#87966107" };

const GRASS_FRAMES = [
  `
....g......g....g.......
..g.g..g...g..g.g...g...
..g.gg.g.g.gg.g.g.g.g...
..gg.ggg.g.g.ggg..g.gg..
...g.g.gg.gg.g.g.gg.g...
...dgd.g.d.g.dg.d.g.d...
....d.dd.d.dd.d.dd.d....
....ddd.ddd.ddd.ddd.....
`,
  `
...g......g....g........
.g.g..g...g..g.g...g....
..gg.g.g.gg..g.g.g.g....
..g.gggg.g.g.ggg..ggg...
...g.g.gg.gg.g.g.gg.g...
...dgd.g.d.g.dg.d.g.d...
....d.dd.d.dd.d.dd.d....
....ddd.ddd.ddd.ddd.....
`,
  `
.....g......g....g......
..g..g..g...g g.g...g...
..g.gg.g.g.gg.g.g.g.g...
..gg.ggg.g.g.ggg..g.g...
...g.g.gg.gg.g.g.gg.g...
...dgd.g.d.g.dg.d.g.d...
....d.dd.d.dd.d.dd.d....
....ddd.ddd.ddd.ddd.....
`,
];

export function buildGrass(): Image[] {
  return GRASS_FRAMES.map((frame) => fromGrid(frame, { d: GRASS_PALETTE.d, g: GRASS_PALETTE.g }));
}

// ---------------------------------------------------------------------------
// Signpost — 30x34 wooden post with a right-pointing plank.
// ---------------------------------------------------------------------------

export function buildSignpost(): Image {
  return fromGrid(
    `
..oooooooooooooooooooo......
.oWWWWWWWWWWWWWWWWWWWWoo....
.oWwwwwwwwwwwwwwwwwwwWWWo...
.oWwwwwwwwwwwwwwwwwwwwwWWo..
.oWwwwwwwwwwwwwwwwwwwWWWo...
.oWWWWWWWWWWWWWWWWWWWWoo....
..oooooooooooooooooooo......
.........oDDWWo.............
.........oDDWWo.............
.........oDDWWo.............
.........oDDWWo.............
.........oDDWWo.............
.........oDDWWo.............
.........oDDWWo.............
.........oDDWWo.............
.........oDDWWo.............
........oDDDWWWo............
........oooooooo............
`,
    { D: "#6b4426", W: "#8a5a33", o: INK, w: "#a8743f" },
  );
}

// ---------------------------------------------------------------------------
// Speech bubble 9-slice (24x24, 8px corners) + tail.
// ---------------------------------------------------------------------------

export function buildBubble(): { bubble: Image; tail: Image } {
  const bubble = createImage(24, 24);
  const ink = hexToRgba(INK);
  const paper = hexToRgba(PAPER);
  for (let y = 0; y < 24; y += 1) {
    for (let x = 0; x < 24; x += 1) {
      const cornerX = Math.min(x, 23 - x);
      const cornerY = Math.min(y, 23 - y);
      if (cornerX + cornerY < 3) {
        continue;
      }
      if (cornerX + cornerY === 3 || ((x === 0 || x === 23) && cornerY >= 3) || ((y === 0 || y === 23) && cornerX >= 3)) {
        setPixel(bubble, x, y, ink);
      } else {
        setPixel(bubble, x, y, paper);
      }
    }
  }
  const tail = fromGrid(
    `
oWWWWWo
.oWWWo.
..oWWo.
...oWo.
....oo.
`,
    { W: PAPER, o: INK },
  );
  return { bubble, tail };
}

// ---------------------------------------------------------------------------
// Chip / badge frame 9-slice (12x12, 4px corners) with notched pixel corners.
// ---------------------------------------------------------------------------

export function buildChipFrame(): Image {
  return fromGrid(
    `
..oooooooo..
.oWWWWWWWWo.
oWWWWWWWWWWo
oWWWWWWWWWWo
oWWWWWWWWWWo
oWWWWWWWWWWo
oWWWWWWWWWWo
oWWWWWWWWWWo
oWWWWWWWWWWo
oWWWWWWWWWWo
.oWWWWWWWWo.
..oooooooo..
`,
    { W: "#f4eed8", o: INK },
  );
}

// ---------------------------------------------------------------------------
// Slider track + knob (dojo).
// ---------------------------------------------------------------------------

export function buildSlider(): { track: Image; knob: Image } {
  const track = fromGrid(
    `
.oooooooooooooooooooooo.
oSSSSSSSSSSSSSSSSSSSSSSo
oSWWWWWWWWWWWWWWWWWWWWSo
oSWWWWWWWWWWWWWWWWWWWWSo
oSSSSSSSSSSSSSSSSSSSSSSo
.oooooooooooooooooooooo.
`,
    { S: "#d8cdaf", W: "#efe8d2", o: INK },
  );
  const knob = fromGrid(
    `
..oooo..
.oGGGGo.
oGLLGGGo
oGLGGGGo
oGGGGGDo
oGGGGDDo
.oGGDDo.
..oooo..
`,
    { D: "#a87a2a", G: GOLD, L: "#ecc878", o: INK },
  );
  return { knob, track };
}

// ---------------------------------------------------------------------------
// Pixel speaker, on/off (16x16).
// ---------------------------------------------------------------------------

export function buildSpeaker(): { on: Image; off: Image } {
  const on = fromGrid(
    `
................
......oo........
.....oWo...o....
....oWWo.o..o...
.oooWWWo..o..o..
.oWWWWWo.o.o.o..
.oWWWWWo.o.o.o..
.oWWWWWo.o.o.o..
.oooWWWo..o..o..
....oWWo.o..o...
.....oWo...o....
......oo........
................
`,
    { W: "#8c8678", o: INK },
  );
  const off = fromGrid(
    `
................
......oo........
.....oWo........
....oWWo........
.oooWWWo..r..r..
.oWWWWWo...rr...
.oWWWWWo...rr...
.oWWWWWo..r..r..
.oooWWWo........
....oWWo........
.....oWo........
......oo........
................
`,
    { W: "#8c8678", o: INK, r: RED },
  );
  return { off, on };
}

// ---------------------------------------------------------------------------
// Stars (8x8, three variants) + sky gradient strips (1x512).
// ---------------------------------------------------------------------------

export function buildStars(): Image[] {
  const star = "#f4efe0";
  return [
    fromGrid(
      `
...s....
...s....
.sssss..
...s....
...s....
`,
      { s: star },
    ),
    fromGrid(
      `
.s.
sss
.s.
`,
      { s: star },
    ),
    fromGrid(
      `
..s..
.....
s.s.s
.....
..s..
`,
      { s: star },
    ),
  ];
}

export function buildSkyStrip(stops: Array<[number, string]>): Image {
  const image = createImage(1, 512);
  for (let y = 0; y < 512; y += 1) {
    const t = y / 511;
    let lower = stops[0];
    let upper = stops[stops.length - 1];
    for (let index = 0; index < stops.length - 1; index += 1) {
      const a = stops[index];
      const b = stops[index + 1];
      if (a && b && t >= a[0] && t <= b[0]) {
        lower = a;
        upper = b;
        break;
      }
    }
    if (!lower || !upper) {
      continue;
    }
    const span = upper[0] - lower[0] || 1;
    const local = (t - lower[0]) / span;
    const from = hexToRgba(lower[1]);
    const to = hexToRgba(upper[1]);
    setPixel(image, 0, y, [Math.round(from[0] + (to[0] - from[0]) * local), Math.round(from[1] + (to[1] - from[1]) * local), Math.round(from[2] + (to[2] - from[2]) * local), 255]);
  }
  return image;
}

// ---------------------------------------------------------------------------
// Dojo tiles + wall scroll ("ASK BETTER").
// ---------------------------------------------------------------------------

export function buildDojoFloor(): Image {
  const image = createImage(32, 32);
  const base = hexToRgba("#e6ddc0");
  const weave = hexToRgba("#ddd2b1");
  const seam = hexToRgba("#c2b694");
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      let color = base;
      if (y % 16 === 0 || x % 32 === 0) {
        color = seam;
      } else if ((y % 16 < 8 ? x + y : x - y + 64) % 4 < 2 && y % 4 === 2) {
        color = weave;
      }
      setPixel(image, x, y, color);
    }
  }
  return image;
}

export function buildDojoWall(): Image {
  const image = createImage(32, 32);
  const plank = hexToRgba("#c8a878");
  const plankAlt = hexToRgba("#bd9d6e");
  const seam = hexToRgba("#8a6e4c");
  const grain = hexToRgba("#b08f60");
  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      const plankIndex = Math.floor(x / 8);
      let color = plankIndex % 2 === 0 ? plank : plankAlt;
      if (x % 8 === 0) {
        color = seam;
      } else if ((x * 13 + y * 5) % 37 === 0) {
        color = grain;
      }
      setPixel(image, x, y, color);
    }
  }
  return image;
}

export function buildDojoScroll(): Image {
  const image = createImage(44, 100);
  const ink = hexToRgba(INK);
  const paper = hexToRgba("#f7f2e4");
  const rod = hexToRgba("#6b4426");
  // Hanging rod.
  fillRect(image, 2, 0, 40, 3, "#6b4426");
  setPixel(image, 1, 1, rod);
  setPixel(image, 42, 1, rod);
  // Paper with ink border.
  for (let y = 4; y < 96; y += 1) {
    for (let x = 8; x < 36; x += 1) {
      const edge = y === 4 || y === 95 || x === 8 || x === 35;
      setPixel(image, x, y, edge ? ink : paper);
    }
  }
  // Vertical "ASK BETTER".
  const lines = ["ASK", "BETTER"];
  lines.forEach((word, wordIndex) => {
    [...word].forEach((letter, letterIndex) => {
      const glyph = renderText(letter, INK, 1, 0);
      blit(image, glyph, wordIndex === 0 ? 14 : 23, 9 + letterIndex * 9 + (wordIndex === 0 ? 12 : 0));
    });
  });
  // Red seal at the bottom.
  fillRect(image, 26, 84, 7, 7, RED);
  fillRect(image, 28, 86, 3, 3, "#9a3a32");
  return image;
}
